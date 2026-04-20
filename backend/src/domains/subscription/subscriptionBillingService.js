/**
 * 구독 결제 실행 공통 서비스
 * subscribe(초기 결제), retryPayment(수동 재시도), billingWorker(자동 결제) 에서 재사용
 */

import { v4 as uuidv4 } from 'uuid'
import pool from '../../config/db.js'
import * as subscriptionPaymentLogRepository from './subscriptionPaymentLogRepository.js'
import * as subscriptionRepository from './subscriptionRepository.js'
import * as subscriptionTossClient from './subscriptionTossClient.js'

/**
 * 날짜에 1개월 추가 (월말 자연 처리 — JS Date 기본 동작 활용)
 * @param {Date} date
 * @returns {Date}
 */
export const addOneMonth = (date) => {
  const result = new Date(date)
  const originalDay = result.getDate()
  result.setMonth(result.getMonth() + 1)
  // JS는 1/31+1개월 → 3/2로 overflow. 월이 2개 앞으로 가면 전월 말일로 고정
  if (result.getDate() !== originalDay) {
    result.setDate(0) // 해당 월 마지막 날
  }
  return result
}

/**
 * 오늘 날짜 KST 기준 'YYYY-MM-DD' 반환
 * process.env.TZ = 'Asia/Seoul' 세팅이 선행되어야 함
 * @returns {string}
 */
export const todayKST = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 토스 에러코드로 fail_category 분류
 * @param {string|null} code
 * @returns {string}
 */
const CARD_EXPIRED_CODES = new Set([
  'INVALID_CARD_EXPIRATION', 'EXPIRED_CARD', 'EXCEED_MAX_CARD_INSTALLMENT_PLAN',
])
const INSUFFICIENT_CODES = new Set([
  'REJECT_CARD_PAYMENT', 'CARD_PROCESSING_ERROR', 'EXCEED_MAX_DAILY_PAYMENT_COUNT',
  'EXCEED_MAX_AMOUNT', 'EXCEED_MAX_CARD_INSTALLMENT_PLAN',
])
const BLOCKED_CODES = new Set([
  'REJECT_CARD_COMPANY', 'INVALID_STOPPED_CARD', 'INVALID_REJECT_CARD',
  'INVALID_CARD_NUMBER', 'INVALID_UNREGISTERED_CARD', 'BELOW_MINIMUM_AMOUNT',
])
const NETWORK_CODES = new Set([
  'FAILED_INTERNAL_SYSTEM_PROCESSING', 'FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING',
  'FAILED_UNKNOWN_PAYMENT', 'UNKNOWN_PAYMENT_ERROR',
])

export const categorizeFailCode = (code) => {
  if (!code) return 'unknown'
  if (CARD_EXPIRED_CODES.has(code)) return 'card_expired'
  if (INSUFFICIENT_CODES.has(code)) return 'insufficient_funds'
  if (BLOCKED_CODES.has(code)) return 'card_blocked'
  if (NETWORK_CODES.has(code)) return 'network_error'
  return 'unknown'
}

/**
 * 빌링키로 토스 결제 실행 + DB 반영 (로그, payments, subscriptions 상태)
 *
 * @param {{
 *   subscriptionId: string,
 *   userId: string,
 *   billingKey: string,
 *   amount: number,
 *   orderId: string,
 *   orderName: string,
 *   customerEmail: string,
 *   attemptType: 'initial'|'recurring'|'retry',
 *   billingCycleDate: string,
 *   attemptNo: number,
 * }} params
 * @returns {Promise<{ success: boolean, tossPaymentKey?: string, failReason?: string }>}
 */
export const runBilling = async ({
  subscriptionId,
  userId,
  billingKey,
  amount,
  orderId,
  orderName,
  customerEmail,
  attemptType,
  billingCycleDate,
  attemptNo,
}) => {
  // 1. pending 로그 선기록
  const log = await subscriptionPaymentLogRepository.createLog({
    subscriptionId,
    userId,
    billingCycleDate,
    attemptNo,
    attemptType,
    tossOrderId: orderId,
    amountKrw: amount,
  })

  // 2. 토스 빌링 API 호출
  const tossResult = await subscriptionTossClient.executeBilling({
    billingKey,
    customerKey: userId,
    amount,
    orderId,
    orderName,
    customerEmail,
  })

  if (tossResult.ok) {
    // 3-성공: 로그 업데이트
    const tossPaymentKey = tossResult.data?.paymentKey ?? null
    await subscriptionPaymentLogRepository.updateLogResult(log.log_id, {
      logStatus: 'success',
      tossPaymentKey,
      succeededAt: new Date(),
    })

    // 4. payments INSERT
    const paymentId = uuidv4()
    await pool.execute(
      `INSERT INTO payments
         (payment_id, user_id, target_type, target_id, toss_payment_key,
          toss_order_id, amount_krw, status, paid_at)
       VALUES (?, ?, 'subscription', ?, ?, ?, ?, 'done', NOW())`,
      [paymentId, userId, subscriptionId, tossPaymentKey ?? paymentId, orderId, amount]
    )

    // 5. subscriptions 상태 업데이트 — 성공
    await subscriptionRepository.updateSubscriptionBilling(subscriptionId, {
      subStatus: 'active',
      failCount: 0,
      lastBilledAt: new Date(),
      nextBillingAt: addOneMonth(new Date()),
    })

    return { success: true, tossPaymentKey }
  } else {
    // 3-실패: 현재 fail_count 조회
    const sub = await subscriptionRepository.findSubscriptionById(subscriptionId)
    const newFailCount = (sub?.fail_count ?? 0) + 1
    const maxRetries = Number(process.env.BILLING_MAX_RETRIES ?? 3)
    const graceDays = Number(process.env.BILLING_GRACE_DAYS ?? 3)
    const retryIntervalDays = Number(process.env.BILLING_RETRY_INTERVAL_DAYS ?? 1)

    const failCode = tossResult.errorCode
    const failCategory = categorizeFailCode(failCode)
    const failReason = tossResult.errorMessage ?? '결제 실패'

    let nextRetryAt = null
    let newSubStatus
    let newGracePeriodUntil = null
    let newSuspendedAt = null

    if (newFailCount < maxRetries) {
      newSubStatus = 'past_due'
      const gracePeriod = new Date()
      gracePeriod.setDate(gracePeriod.getDate() + graceDays)
      newGracePeriodUntil = gracePeriod

      nextRetryAt = new Date()
      nextRetryAt.setDate(nextRetryAt.getDate() + retryIntervalDays)
    } else {
      newSubStatus = 'suspended'
      newSuspendedAt = new Date()
    }

    // 로그 업데이트
    await subscriptionPaymentLogRepository.updateLogResult(log.log_id, {
      logStatus: newFailCount >= maxRetries ? 'abandoned' : 'retry_scheduled',
      failCode,
      failCategory,
      failReason,
      failedAt: new Date(),
      nextRetryAt,
    })

    // subscriptions 상태 업데이트 — 실패
    await subscriptionRepository.updateSubscriptionBilling(subscriptionId, {
      subStatus: newSubStatus,
      failCount: newFailCount,
      lastFailedAt: new Date(),
      gracePeriodUntil: newGracePeriodUntil,
      suspendedAt: newSuspendedAt,
    })

    return { success: false, failReason }
  }
}
