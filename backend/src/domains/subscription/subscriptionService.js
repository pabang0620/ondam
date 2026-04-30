import { v4 as uuidv4 } from 'uuid'
import { encryptString, decryptString } from '../../utils/kms.js'
import * as subscriptionRepository from './subscriptionRepository.js'
import * as subscriptionPaymentLogRepository from './subscriptionPaymentLogRepository.js'
import * as subscriptionTossClient from './subscriptionTossClient.js'
import {
  runBilling,
  addOneMonth,
  todayKST,
} from './subscriptionBillingService.js'
import { billingQueue } from '../../queues/billingQueue.js'
import pool from '../../config/db.js'

/**
 * 구독 플랜 상수
 */
export const PLANS = {
  pet_archive: { price: 4900, name: '반려동물 스탠다드' },
  will_premium: { price: 1900, name: '유언장 보관' },
  all: { price: 9900, name: '전체' },
}

/**
 * 구독 플랜 목록 반환 (비인증 접근 가능)
 */
export const getPlans = () => {
  return Object.entries(PLANS).map(([planKey, info]) => ({
    plan: planKey,
    name: info.name,
    priceKrw: info.price,
  }))
}

/**
 * 사용자 구독 목록 조회
 */
export const getSubscriptions = async (userId) => {
  const rows = await subscriptionRepository.findSubscriptionsByUserId(userId)
  return rows.map((row) => ({
    ...row,
    subStatus: row.sub_status,
  }))
}

/**
 * 구독 시작
 * 1. 중복 활성 구독 체크
 * 2. authKey → billingKey 교환 (토스)
 * 3. 빌링키 KMS 암호화
 * 4. 즉시 첫 결제 실행 (attempt_type='initial')
 * 5. 결제 성공 시에만 subscriptions INSERT
 * 6. 결제 실패 시 402 throw
 * 7. scan-due repeat job 등록 (최초 1회)
 */
export const subscribe = async (userId, { plan, authKey, customerKey }) => {
  if (!PLANS[plan]) {
    throw Object.assign(new Error('유효하지 않은 구독 플랜입니다'), { status: 400 })
  }
  if (!authKey) {
    throw Object.assign(new Error('authKey는 필수입니다'), { status: 400 })
  }
  if (!customerKey) {
    throw Object.assign(new Error('customerKey는 필수입니다'), { status: 400 })
  }

  // 중복 활성 구독 확인
  const existing = await subscriptionRepository.findActiveSubscription(userId, plan)
  if (existing) {
    throw Object.assign(new Error('이미 활성 중인 구독이 있습니다'), { status: 409 })
  }

  // authKey → billingKey 교환
  const issueResult = await subscriptionTossClient.issueBillingKey({ authKey, customerKey })
  if (!issueResult.ok) {
    throw Object.assign(
      new Error(issueResult.errorMessage ?? '빌링키 발급에 실패했습니다'),
      { status: 400 }
    )
  }
  const billingKey = issueResult.data?.billingKey
  if (!billingKey) {
    throw Object.assign(new Error('빌링키를 받아오지 못했습니다'), { status: 502 })
  }

  // 빌링키 KMS 암호화
  const { encrypted, kmsKeyId } = await encryptString(billingKey)

  // 사용자 이메일 조회
  const [[userRow]] = await pool.execute(
    'SELECT email FROM users WHERE user_id = ? LIMIT 1',
    [userId]
  )
  const customerEmail = userRow?.email ?? ''

  const planInfo = PLANS[plan]
  const amount = planInfo.price
  const orderName = `온담 ${planInfo.name} 정기구독`
  const orderId = `ondam_sub_init_${userId.slice(0, 8)}_${Date.now()}`
  const billingCycleDate = todayKST()

  // 즉시 첫 결제 실행 (subscriptions 미존재 상태이므로 임시 ID 사용)
  // 첫 결제는 subscriptions INSERT 전이므로 직접 토스 API 호출
  const tossResult = await subscriptionTossClient.executeBilling({
    billingKey,
    customerKey: userId,
    amount,
    orderId,
    orderName,
    customerEmail,
  })

  if (!tossResult.ok) {
    throw Object.assign(
      new Error(tossResult.errorMessage ?? '첫 결제에 실패했습니다'),
      { status: 402 }
    )
  }

  const tossPaymentKey = tossResult.data?.paymentKey ?? null
  const subscriptionId = uuidv4()
  const nextBillingAt = addOneMonth(new Date())

  // 결제 성공 후 DB 작업 실패 시 보상 환불
  try {
    // 결제 성공 시에만 subscriptions INSERT
    const subscription = await subscriptionRepository.createSubscription({
      subscriptionId,
      userId,
      plan,
      billingKeyEncrypted: encrypted,
      billingKmsKeyId: kmsKeyId,
      priceKrw: amount,
      nextBillingAt,
      lastBilledAt: new Date(),
    })

    // 결제 로그 INSERT (success)
    const log = await subscriptionPaymentLogRepository.createLog({
      subscriptionId,
      userId,
      billingCycleDate,
      attemptNo: 1,
      attemptType: 'initial',
      tossOrderId: orderId,
      amountKrw: amount,
    })
    await subscriptionPaymentLogRepository.updateLogResult(log.log_id, {
      logStatus: 'success',
      tossPaymentKey,
      succeededAt: new Date(),
    })

    // payments INSERT
    const paymentId = uuidv4()
    await pool.execute(
      `INSERT INTO payments
         (payment_id, user_id, target_type, target_id, toss_payment_key,
          toss_order_id, amount_krw, status, paid_at)
       VALUES (?, ?, 'subscription', ?, ?, ?, ?, 'done', NOW())`,
      [paymentId, userId, subscriptionId, tossPaymentKey ?? paymentId, orderId, amount]
    )

    // scan-due repeat job 최초 1회 등록 (이미 있으면 BullMQ가 skip)
    await billingQueue.add(
      'scan-due',
      {},
      {
        repeat: { cron: process.env.BILLING_SCAN_CRON || '0 3 * * *' },
        jobId: 'billing-scan-due-repeat',
      }
    ).catch((err) => {
      console.warn('[subscriptionService] scan-due 반복 job 등록 실패 (무시):', err.message)
    })

    return {
      subscriptionId: subscription.subscription_id,
      plan: subscription.plan,
      subStatus: 'active',
      priceKrw: subscription.price_krw,
      nextBillingAt: subscription.next_billing_at,
      lastBilledAt: subscription.last_billed_at,
    }
  } catch (dbErr) {
    if (tossPaymentKey) {
      await subscriptionTossClient.cancelPayment({
        paymentKey: tossPaymentKey,
        cancelReason: 'DB 저장 실패로 인한 자동 환불',
      }).catch((e) => console.error('[subscribe] 보상 환불 실패 - 수동 처리 필요:', tossPaymentKey, e.message))
    }
    throw Object.assign(new Error('구독 등록 중 오류가 발생했습니다'), { status: 500 })
  }
}

/**
 * 구독 취소
 * 1. 소유권 + 상태 확인
 * 2. 빌링키 복호화 → deleteBillingKey 호출 (실패해도 DB는 취소)
 * 3. sub_status='canceled', toss_billing_key_encrypted/billing_kms_key_id=NULL
 * 4. subscription_logs INSERT
 * 5. notifications INSERT
 */
export const cancelSubscription = async (userId, subscriptionId) => {
  const subscription = await subscriptionRepository.findSubscriptionForBilling(subscriptionId)
  if (!subscription) {
    throw Object.assign(new Error('구독 정보를 찾을 수 없습니다'), { status: 404 })
  }
  if (subscription.user_id !== userId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  if (subscription.sub_status === 'canceled') {
    throw Object.assign(new Error('이미 취소된 구독입니다'), { status: 400 })
  }

  // 빌링키 복호화 → 토스 측 빌링키 삭제 시도 (실패해도 DB 취소 진행)
  if (subscription.toss_billing_key_encrypted) {
    try {
      const billingKey = await decryptString(
        subscription.toss_billing_key_encrypted,
        subscription.billing_kms_key_id
      )
      const deleteResult = await subscriptionTossClient.deleteBillingKey({ billingKey })
      if (!deleteResult.ok) {
        console.warn(
          `[subscriptionService] 빌링키 삭제 실패 (무시하고 DB 취소 진행): ${deleteResult.errorCode} - ${deleteResult.errorMessage}`
        )
      }
    } catch (err) {
      console.warn('[subscriptionService] 빌링키 복호화/삭제 실패 (무시):', err.message)
    }
  }

  // DB 상태 변경 + 로그 + 알림 - 단일 트랜잭션으로 원자 처리
  let updated
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    await subscriptionRepository.updateSubscriptionStatus(subscriptionId, {
      subStatus: 'canceled',
      prevStatus: subscription.sub_status,
      changedBy: userId,
      changedByType: 'user',
      reason: '사용자 취소',
      conn,
    })

    updated = await subscriptionRepository.cancelSubscription(subscriptionId, {
      cancelReason: '사용자 취소',
      conn,
    })

    const notificationId = uuidv4()
    await conn.execute(
      `INSERT INTO notifications
         (notification_id, user_id, notification_type, target_type, target_id, title, message, created_at)
       VALUES (?, ?, 'subscription_canceled', 'subscription', ?, '구독 취소 완료', ?, NOW())`,
      [
        notificationId,
        userId,
        subscriptionId,
        `${PLANS[subscription.plan]?.name ?? subscription.plan} 구독이 취소되었습니다.`,
      ],
    )

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  return updated
}

/**
 * 결제 수동 재시도 (past_due, suspended 상태에서 사용자가 직접 재시도)
 */
export const retryPayment = async (userId, subscriptionId) => {
  const subscription = await subscriptionRepository.findSubscriptionForBilling(subscriptionId)
  if (!subscription) {
    throw Object.assign(new Error('구독 정보를 찾을 수 없습니다'), { status: 404 })
  }
  if (subscription.user_id !== userId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  if (!['past_due', 'suspended'].includes(subscription.sub_status)) {
    throw Object.assign(
      new Error('결제 재시도는 연체 또는 정지 상태에서만 가능합니다'),
      { status: 400 }
    )
  }
  if (!subscription.toss_billing_key_encrypted) {
    throw Object.assign(new Error('빌링키가 없어 결제를 진행할 수 없습니다'), { status: 400 })
  }

  // 빌링키 복호화
  const billingKey = await decryptString(
    subscription.toss_billing_key_encrypted,
    subscription.billing_kms_key_id
  )

  // 사용자 이메일 조회
  const [[userRow]] = await pool.execute(
    'SELECT email FROM users WHERE user_id = ? LIMIT 1',
    [userId]
  )
  const customerEmail = userRow?.email ?? ''

  const planInfo = PLANS[subscription.plan]
  const amount = planInfo?.price ?? subscription.price_krw
  const orderName = `온담 ${planInfo?.name ?? subscription.plan} 정기구독`
  const orderId = `ondam_sub_retry_${subscriptionId.slice(0, 8)}_${Date.now()}`
  const billingCycleDate = todayKST()

  const lastAttemptNo = await subscriptionPaymentLogRepository.getLastAttemptNo(
    subscriptionId,
    billingCycleDate
  )

  const result = await runBilling({
    subscriptionId,
    userId,
    billingKey,
    amount,
    orderId,
    orderName,
    customerEmail,
    attemptType: 'retry',
    billingCycleDate,
    attemptNo: lastAttemptNo + 1,
  })

  if (!result.success) {
    throw Object.assign(
      new Error(result.failReason ?? '결제 재시도에 실패했습니다'),
      { status: 402 }
    )
  }

  // 성공 시 알림
  const notificationId = uuidv4()
  await pool.execute(
    `INSERT INTO notifications
       (notification_id, user_id, notification_type, target_type, target_id, title, message, created_at)
     VALUES (?, ?, 'payment_success', 'subscription', ?, '구독 결제 완료', ?, NOW())`,
    [
      notificationId,
      userId,
      subscriptionId,
      `${orderName} ${amount.toLocaleString()}원 결제가 완료되었습니다.`,
    ]
  )

  const updated = await subscriptionRepository.findSubscriptionById(subscriptionId)
  return {
    subscriptionId: updated.subscription_id,
    plan: updated.plan,
    subStatus: updated.sub_status,
    nextBillingAt: updated.next_billing_at,
    lastBilledAt: updated.last_billed_at,
  }
}

/**
 * 구독 결제 로그 조회 (소유권 검증 포함)
 */
export const getPaymentLogs = async (userId, subscriptionId, { page = 1, limit = 20 } = {}) => {
  const subscription = await subscriptionRepository.findSubscriptionById(subscriptionId)
  if (!subscription) {
    throw Object.assign(new Error('구독 정보를 찾을 수 없습니다'), { status: 404 })
  }
  if (subscription.user_id !== userId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }

  const safeLimit = Math.min(Number(limit), 100)
  const offset = (Number(page) - 1) * safeLimit

  const { logs, total } = await subscriptionPaymentLogRepository.findLogsBySubscriptionId(
    subscriptionId,
    { limit: safeLimit, offset }
  )

  return {
    logs,
    meta: {
      total,
      page: Number(page),
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
  }
}
