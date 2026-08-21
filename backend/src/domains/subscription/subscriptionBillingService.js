/**
 * 구독 결제 실행 공통 서비스
 * subscribe(초기 결제), retryPayment(수동 재시도), billingWorker(자동 결제) 에서 재사용
 */

import { v4 as uuidv4 } from 'uuid'
import pool from '../../config/db.js'
import * as subscriptionPaymentLogRepository from './subscriptionPaymentLogRepository.js'
import * as subscriptionRepository from './subscriptionRepository.js'
import * as subscriptionTossClient from './subscriptionTossClient.js'

// [CRITICAL #1] executeBilling 에러 코드가 "이미 처리된 결제"류일 때 판별하는 목록.
// 재선점(reclaim) 경로의 사전 조회가 실패(네트워크 등)해 그대로 executeBilling을
// 다시 호출했는데, 사실 이전 시도가 이미 성공했던 경우 토스가 이 계열 에러를
// 돌려줄 수 있다. 이를 무조건 실패로 확정하면 이미 승인된 결제를 실패로
// 오기록하게 되므로, 실패 확정 전에 한 번 더 실상태를 조회해 판정한다.
const ALREADY_PROCESSED_ERROR_CODES = new Set([
  'ALREADY_PROCESSED_PAYMENT',
  'PROVIDER_INCONSISTENCY',
  'DUPLICATED_ORDER_ID',
])

/**
 * 날짜에 1개월 추가 (월말 자연 처리 - JS Date 기본 동작 활용)
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

// [CRITICAL #1] executeBilling이 "결제가 실제로 성공했는지 실패했는지 알 수 없는"
// 응답을 돌려준 경우의 코드 목록이다.
// - TIMEOUT / NETWORK_ERROR: subscriptionTossClient의 fetchToss가 fetch 예외(타임아웃
//   포함)를 잡아 정규화한 값. 토스에 요청이 도달했는지, 카드가 승인됐는지조차 알 수 없다.
// - UNKNOWN: 토스가 code 없는 에러 바디를 준 경우 normalizeResponse가 붙이는 기본값.
// - NETWORK_CODES(FAILED_INTERNAL_SYSTEM_PROCESSING 등): 토스 내부 처리 예외 계열 -
//   응답 자체는 받았지만 승인 결과가 실제로 확정됐는지는 불확실하다.
// 이 계열을 곧장 _finalizeFailure로 보내면 로그가 retry_scheduled/abandoned로
// "확정"되어 findPendingLogRaw가 더 이상 이 로그를 찾지 못하고, 다음 시도가 새
// attempt_no + 새 orderId를 발급해 토스에 신규 주문으로 재청구된다(이중청구).
// runBilling은 이 계열을 만나면 getPaymentByOrderId로 먼저 실상태를 조회하고,
// 조회 자체도 실패하면 로그를 pending으로 남긴 채 리턴해 다음 시도가 stale pending
// 재선점(동일 orderId 재사용) 경로를 타게 한다.
const INDETERMINATE_ERROR_CODES = new Set([
  'TIMEOUT',
  'NETWORK_ERROR',
  'UNKNOWN',
  ...NETWORK_CODES,
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
 * 결제 시도 예약 (pending 로그 선기록).
 *
 * [CRITICAL #2 수정] 반드시 호출자가 FOR UPDATE로 구독 행을 잠근 트랜잭션의 conn을
 * 넘겨 호출해야 한다. "상태확인 → 멱등성 판정 → pending 예약"을 전부 같은 락 구간
 * 안에서 끝내야, 재시도 버튼 더블클릭 같은 동시 요청이 둘 다 findTodayLog를
 * 통과해 실결제 2건이 되는 경로를 막을 수 있다. 이 함수는 절대 외부 API(토스)를
 * 호출하지 않는다 - 그건 호출자가 커밋 이후(락 밖)에서 한다 (G4-4).
 *
 * [CRITICAL #1] 오늘자로 방치된(stale) pending 로그가 있으면 새 로그를 만들지
 * 않고 그 로그(및 orderId)를 그대로 재사용한다(isReclaim: true). 이전에는
 * orderId에 attemptNo를 넣어 재시도마다 값이 달라지게 했는데, 그게 사실상
 * 유일한 멱등키였다 - 응답만 유실되고 카드는 이미 승인된 상황에서 재시도가 새
 * orderId로 토스에 재청구되어 이중결제가 났다. orderId를 재사용하면 토스 자체의
 * 주문번호 유일성 보장이 이중청구를 막아주는 최후 방어선이 된다.
 *
 * @param {{
 *   subscriptionId: string, userId: string, billingCycleDate: string,
 *   attemptType: 'recurring'|'retry', amount: number,
 *   conn: import('mysql2/promise').PoolConnection,
 * }} params
 * @returns {Promise<{ log: object, orderId: string, isReclaim: boolean } | null>}
 *   null이면 이미 성공했거나 신선한(fresh) pending이 진행 중이라 이번 시도를 건너뛰어야 함을 의미
 */
export const reserveBillingAttempt = async ({
  subscriptionId,
  userId,
  billingCycleDate,
  attemptType,
  amount,
  conn,
}) => {
  const blockingLog = await subscriptionPaymentLogRepository.findTodayLog(
    subscriptionId,
    billingCycleDate,
    conn
  )
  if (blockingLog) return null

  const stalePending = await subscriptionPaymentLogRepository.findPendingLogRaw(
    subscriptionId,
    billingCycleDate,
    conn
  )
  if (stalePending) {
    return { log: stalePending, orderId: stalePending.toss_order_id, isReclaim: true }
  }

  const lastAttemptNo = await subscriptionPaymentLogRepository.getLastAttemptNo(
    subscriptionId,
    billingCycleDate,
    conn
  )
  const attemptNo = lastAttemptNo + 1
  // 토스 orderId는 영문/숫자/-_= 6~64자 제약 - attemptNo(1~2자리) 추가는 안전하다.
  // 이 브랜치는 이전 시도가 성공도 방치도 아닌 "확정적으로 종료"된 상태(failed 등)
  // 에서만 도달하므로, 새 orderId를 발급해도 이중청구 위험이 없다(토스가 이전
  // orderId에 대해 결제를 만든 적이 없다는 것이 이미 확정됐기 때문).
  const orderId = `sub_${subscriptionId.slice(0, 8)}_${billingCycleDate.replace(/-/g, '')}_${attemptNo}`
  const log = await subscriptionPaymentLogRepository.createLog(
    {
      subscriptionId,
      userId,
      billingCycleDate,
      attemptNo,
      attemptType,
      tossOrderId: orderId,
      amountKrw: amount,
    },
    conn
  )
  return { log, orderId, isReclaim: false }
}

/**
 * 결제 성공 반영 - 로그 업데이트 + payments INSERT + subscriptions 상태 업데이트를
 * 하나의 트랜잭션으로 묶는다 (G4).
 */
const _finalizeSuccess = async ({ log, subscriptionId, userId, orderId, amount, tossData }) => {
  const tossPaymentKey = tossData?.paymentKey ?? null
  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    await subscriptionPaymentLogRepository.updateLogResult(log.log_id, {
      logStatus: 'success',
      tossPaymentKey,
      succeededAt: new Date(),
    }, conn)

    // payments INSERT
    const paymentId = uuidv4()
    await conn.execute(
      `INSERT INTO payments
         (payment_id, user_id, target_type, target_id, toss_payment_key,
          toss_order_id, amount_krw, status, paid_at)
       VALUES (?, ?, 'subscription', ?, ?, ?, ?, 'done', NOW())`,
      [paymentId, userId, subscriptionId, tossPaymentKey ?? paymentId, orderId, amount]
    )

    // subscriptions 상태 업데이트 - 성공
    await subscriptionRepository.updateSubscriptionBilling(subscriptionId, {
      subStatus: 'active',
      failCount: 0,
      lastBilledAt: new Date(),
      nextBillingAt: addOneMonth(new Date()),
    }, conn)

    await conn.commit()
  } catch (dbErr) {
    await conn.rollback()
    // 실제 카드 결제는 이미 성공했으므로 DB 트랜잭션이 롤백됐다면 토스 결제를
    // 보상 환불한다. 커밋 이후(트랜잭션 밖)의 후속 작업(알림 등)은 이 보상
    // 대상이 아니다 - 그건 실패해도 결제 자체는 성공 처리해야 한다(G6, 비차단).
    if (tossPaymentKey) {
      await subscriptionTossClient.cancelPayment({
        paymentKey: tossPaymentKey,
        cancelReason: 'DB 저장 실패로 인한 자동 환불',
      }).catch((e) => console.error('[runBilling] 보상 환불 실패 - 수동 처리 필요:', tossPaymentKey, e.message))
    }
    throw Object.assign(new Error('결제 처리 중 오류가 발생했습니다'), { status: 500 })
  } finally {
    conn.release()
  }

  return { success: true, tossPaymentKey }
}

/**
 * 결제 실패 반영 - 로그 업데이트 + fail_count 증가/상태 전이를 하나의 트랜잭션으로 묶는다.
 */
const _finalizeFailure = async ({ log, subscriptionId, tossResult }) => {
  const maxRetries = Number(process.env.BILLING_MAX_RETRIES ?? 3)
  const graceDays = Number(process.env.BILLING_GRACE_DAYS ?? 3)
  const retryIntervalDays = Number(process.env.BILLING_RETRY_INTERVAL_DAYS ?? 1)

  const failCode = tossResult.errorCode
  const failCategory = categorizeFailCode(failCode)
  const failReason = tossResult.errorMessage ?? '결제 실패'

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // fail_count 아토믹 증가 (SELECT 후 +1 동시성 문제 방지) 후 최신 값 조회
    const updatedSub = await subscriptionRepository.updateSubscriptionBilling(subscriptionId, {
      incrementFailCount: true,
      lastFailedAt: new Date(),
    }, conn)
    const newFailCount = updatedSub?.fail_count ?? maxRetries

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
    }, conn)

    // subscriptions 상태 업데이트 - 실패 (fail_count는 이미 위에서 아토믹 증가)
    await subscriptionRepository.updateSubscriptionBilling(subscriptionId, {
      subStatus: newSubStatus,
      gracePeriodUntil: newGracePeriodUntil,
      suspendedAt: newSuspendedAt,
    }, conn)

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  return { success: false, failReason }
}

/**
 * 빌링키로 토스 결제 실행 + DB 반영 (로그, payments, subscriptions 상태)
 *
 * 호출 전 반드시 reserveBillingAttempt로 pending 로그를 락 구간 안에서 예약해야
 * 한다(CRITICAL #2). 이 함수 자체는 락을 쥐지 않은 상태에서 호출된다 - 외부 API
 * 호출(토스)이 필요하기 때문이다 (G4-4).
 *
 * @param {{
 *   subscriptionId: string,
 *   userId: string,
 *   billingKey: string,
 *   amount: number,
 *   orderId: string,
 *   orderName: string,
 *   customerEmail: string,
 *   log: object,
 *   isReclaim: boolean,
 * }} params
 * @returns {Promise<{ success: boolean, tossPaymentKey?: string, failReason?: string, indeterminate?: boolean }>}
 *   indeterminate:true 인 경우 success는 항상 false이지만 "확정 실패"가 아니다 -
 *   로그를 pending으로 남긴 채 리턴한 것이므로, 호출부는 이를 past_due/suspended
 *   전이나 "결제 실패" 확정 알림의 근거로 쓰면 안 된다 (완료 보고 3번 참조).
 */
export const runBilling = async ({
  subscriptionId,
  userId,
  billingKey,
  amount,
  orderId,
  orderName,
  customerEmail,
  log,
  isReclaim = false,
}) => {
  if (isReclaim) {
    // [CRITICAL #1] 응답 유실로 방치된(stale) pending을 재시도하는 경우, 같은
    // orderId로 실제 결제가 이미 이뤄졌는지 먼저 조회한다. 조회 없이 바로
    // executeBilling을 다시 부르면, 이전 요청이 실제로는 성공했고 응답만
    // 유실됐을 뿐인 상황에서 두 번째 청구가 될 수 있다.
    const lookup = await subscriptionTossClient.getPaymentByOrderId({ orderId })
    if (lookup.ok && lookup.data?.status === 'DONE') {
      return _finalizeSuccess({ log, subscriptionId, userId, orderId, amount, tossData: lookup.data })
    }
    // 조회 결과 미결제로 확인됐거나(주문 없음 등) 조회 자체가 실패한 경우 - 어느
    // 쪽이든 같은 orderId로 재청구한다. 실제로 결제가 있었다면 토스가 동일
    // 주문번호를 거부하므로, 이 재청구 자체가 이중청구를 막는 최후 방어선이 된다.
  }

  const tossResult = await subscriptionTossClient.executeBilling({
    billingKey,
    customerKey: userId,
    amount,
    orderId,
    orderName,
    customerEmail,
  })

  if (tossResult.ok) {
    return _finalizeSuccess({
      log, subscriptionId, userId, orderId, amount, tossData: tossResult.data,
    })
  }

  // [CRITICAL #1] 실패로 확정하기 전에 한 번 더 안전장치 - executeBilling 자체가
  // "이미 처리됨"류 에러를 반환했다면(재선점 사전 조회가 네트워크 오류로 실패했던
  // 경우 등), 실패로 기록하기 전에 실상태를 조회해 재확인한다. 그러지 않으면 실제로
  // 성공한 결제를 subscription_payment_logs에 실패로 오기록하고 구독을
  // past_due/suspended로 잘못 전이시킬 수 있다.
  const errorCode = tossResult.errorCode
  const isAlreadyProcessedCode =
    typeof errorCode === 'string' && ALREADY_PROCESSED_ERROR_CODES.has(errorCode)
  // [CRITICAL #1] executeBilling이 불확정 코드(타임아웃/네트워크 오류 등)를 반환한
  // 경우도 같은 조회 절차를 거친다. 위 ALREADY_PROCESSED와의 차이는 조회 자체가
  // 실패했을 때의 처리 - ALREADY_PROCESSED 판정은 "실제로는 성공했을 가능성이 높다"는
  // 전제이므로 조회가 안 되면 그냥 실패로 넘어가도 안전하지만(원래도 실패로 갈
  // 코드였음), 불확정 코드는 애초에 "성공인지 실패인지 전혀 모른다"는 뜻이므로
  // 조회조차 실패하면 실패 확정을 보류해야 한다.
  const isIndeterminateCode =
    typeof errorCode === 'string' && INDETERMINATE_ERROR_CODES.has(errorCode)

  if (isAlreadyProcessedCode || isIndeterminateCode) {
    const lookup = await subscriptionTossClient.getPaymentByOrderId({ orderId })

    if (lookup.ok && lookup.data?.status === 'DONE') {
      return _finalizeSuccess({ log, subscriptionId, userId, orderId, amount, tossData: lookup.data })
    }

    if (isIndeterminateCode) {
      const lookupFailedByNetwork = lookup.errorCode === 'TIMEOUT' || lookup.errorCode === 'NETWORK_ERROR'
      if (!lookup.ok && lookupFailedByNetwork) {
        // [CRITICAL #1] 조회 자체도 실패 - 결제가 실제로 됐는지 안 됐는지 알 방법이
        // 없다. 여기서 _finalizeFailure를 부르면 로그가 retry_scheduled/abandoned로
        // 굳어버려 findPendingLogRaw가 더 이상 이 로그를 찾지 못하고, 다음 시도가
        // 새 attempt_no + 새 orderId를 발급해 토스가 신규 주문으로 오인해 이중청구
        // 한다. 아무 것도 확정하지 않고 로그를 pending 그대로 둔 채 리턴한다 - 다음
        // 시도는 findPendingLogRaw가 이 pending을 stale로 판단해 같은 orderId를
        // 재사용(reclaim)하게 되고, 토스의 orderId 유일성 보장이 이중청구를 막는
        // 최후 방어선으로 작동한다.
        console.warn('[runBilling] 결제 결과 불확정 - 실패 확정을 보류하고 pending 유지:', {
          subscriptionId,
          orderId,
          executeErrorCode: errorCode,
          lookupErrorCode: lookup.errorCode,
        })
        return {
          success: false,
          indeterminate: true,
          failReason: '결제 결과를 확인하는 중입니다. 잠시 후 자동으로 재확인됩니다.',
        }
      }
      // 조회는 됐지만 DONE이 아니거나(READY/CANCELED/EXPIRED 등) 주문 자체가 없음 -
      // 명확히 미결제로 확인된 경우이므로 아래에서 진짜 실패로 확정한다.
    }
  }

  return _finalizeFailure({ log, subscriptionId, tossResult })
}
