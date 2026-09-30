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
 * [#1/#5 수정] 다음 청구일이 항상 "미래"가 되도록 보장하며 anchorDate에 +1개월씩
 * 반복 적용한다.
 *
 * 배경: scan-due는 sub_status IN ('active','past_due') AND next_billing_at <= NOW()인
 * 구독을 즉시 재청구 대상으로 삼는다. suspended 상태로 오래 방치된 구독을
 * retryPayment로 복구하면 anchorDate(이번 사이클의 원래 예정일)가 이미 몇 주~몇 달
 * 전일 수 있는데, 여기에 단순히 +1개월만 하면 여전히 과거일 수 있다 - 그 결과
 * active 전환 직후 그날 밤 scan-due가 카드를 즉시 재청구하는 사고로 이어진다
 * (완료 보고 1번 참조).
 *
 * anchorDate에 계속 +1개월을 적용해 미래를 찾으면, 원래 청구 주기의 "일자"(예:
 * 매월 2일)를 그대로 유지한 채 다음 정상 청구일을 복원할 수 있다 - 단순히
 * addOneMonth(NOW())로 리셋하는 것보다 사용자의 청구 주기 일관성을 지킨다.
 * @param {Date} anchorDate
 * @returns {Date}
 */
export const computeNextBillingAt = (anchorDate) => {
  const now = new Date()
  let next = addOneMonth(anchorDate)
  while (next <= now) {
    next = addOneMonth(next)
  }
  return next
}

/**
 * [#6 수정] payments.toss_payment_key UNIQUE 충돌 여부를 에러 메시지 문자열이
 * 아니라 실제 데이터 조회로 판별한다.
 *
 * payments.toss_payment_key와 subscription_payment_logs.toss_payment_key는 둘 다
 * 컬럼명 그대로 자동 명명된 UNIQUE 인덱스(`toss_payment_key`)를 갖는다 - MySQL의
 * ER_DUP_ENTRY 메시지는 이 인덱스명을 포함하므로 `.includes('toss_payment_key')`
 * 같은 문자열 매칭은 어느 테이블에서 충돌이 났는지 구분하지 못한다. 지금은 우연히
 * 두 인덱스명이 같아 동작하지만, 인덱스명이 바뀌면(예: 명시적 KEY 이름 부여) 조용히
 * 오판해 정상 결제를 환불해버리거나 반대로 진짜 정합성 파손을 놓칠 수 있다.
 * payments 테이블에 이 tossPaymentKey가 실제로 존재하는지 직접 조회하는 것이
 * 유일하게 신뢰할 수 있는 판별 기준이다.
 * @param {string|null} tossPaymentKey
 * @returns {Promise<boolean>}
 */
export const isPaymentAlreadyRecorded = async (tossPaymentKey) => {
  if (!tossPaymentKey) return false
  const [[row]] = await pool.execute(
    'SELECT payment_id FROM payments WHERE toss_payment_key = ? LIMIT 1',
    [tossPaymentKey]
  )
  return !!row
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
 * [B-1] 최초 구독 결제(subscribe) 전용 예약. reserveBillingAttempt와 동일한 구조
 * (pending 로그 선기록 → 방치분 재선점 → 없으면 신규 발급)이지만, 아직
 * subscriptions 레코드가 존재하지 않으므로 subscription_id로 조회할 수 없다.
 * 대신 (user_id + billing_cycle_date + amount_krw + attempt_type='initial')로
 * 오늘자 시도를 식별한다 - amount_krw는 플랜 가격과 1:1이므로 같은 날 서로 다른
 * 플랜에 최초가입을 시도해도 섞이지 않는다(가격이 동일한 두 플랜이 생기면 이
 * 가정이 깨지므로, 그런 변경 시 이 함수도 함께 재검토해야 한다).
 *
 * 동시 이중 클릭 등으로 두 요청이 동시에 "예약 없음"을 보고 신규 INSERT를
 * 시도하는 경합은 subscription_payment_logs.toss_order_id UNIQUE 제약으로 막는다
 * - 진 쪽은 ER_DUP_ENTRY를 받고 방금 이긴 쪽이 만든 로그를 재조회해 그대로
 * 재사용(isReclaim)한다. FOR UPDATE 락을 쓰지 않는 이유는 잠글 대상 행(구독
 * 레코드)이 아직 없기 때문이다 - UNIQUE 제약이 사실상의 락 역할을 한다.
 *
 * [#3 수정] findInitialTodayLog는 이제 success 또는 "신선한"(BILLING_PENDING_STALE_MINUTES
 * 이내) pending만 반환한다. 신선한 pending은 다른 탭/요청이 지금 진행 중(in-flight)이라는
 * 뜻이므로 reserveBillingAttempt(정기결제)와 동일하게 재선점하지 않고 null을 반환해
 * 이번 호출을 건너뛴다 - 그러지 않으면 두 탭이 같은 orderId로 동시에 진행하다 한쪽이
 * 성공 커밋한 직후 다른 쪽이 그 orderId를 재조회해 DONE을 보고 createSubscription을
 * 시도 → UNIQUE 제약 위반 → 에러 메시지에 toss_payment_key가 없어 정상 결제를
 * 잘못 보상 환불하는 사고로 이어진다(완료 보고 3번 참조). 방치된(stale) pending은
 * findInitialPendingLogRaw로 별도 재선점한다.
 *
 * @param {{ userId: string, plan: string, amount: number, billingCycleDate: string }} params
 * @returns {Promise<
 *   { log: object, orderId: string, subscriptionId: string, isReclaim: true, alreadySucceeded: true } |
 *   { log: object, orderId: string, subscriptionId: string, isReclaim: true, alreadySucceeded?: false } |
 *   { log: object, orderId: string, subscriptionId: string, isReclaim: false } |
 *   null
 * >}
 *   null이면 신선한(fresh) pending이 진행 중이라 이번 시도를 건너뛰어야 함을 의미
 */
export const reserveInitialBillingAttempt = async ({ userId, plan: _plan, amount, billingCycleDate }) => {
  const existing = await subscriptionPaymentLogRepository.findInitialTodayLog(userId, billingCycleDate, amount)
  if (existing) {
    if (existing.log_status === 'pending') {
      // 신선한(fresh) pending - 다른 요청이 지금 처리 중이다. 재선점하지 않는다.
      return null
    }
    return {
      log: existing,
      orderId: existing.toss_order_id,
      subscriptionId: existing.subscription_id,
      isReclaim: true,
      alreadySucceeded: true, // findInitialTodayLog는 이제 success만 non-pending으로 반환
    }
  }

  const stalePending = await subscriptionPaymentLogRepository.findInitialPendingLogRaw(userId, billingCycleDate, amount)
  if (stalePending) {
    // 방치된(stale) pending - 크래시 등으로 확정되지 못한 이전 시도를 같은
    // orderId로 재선점한다 (CRITICAL #1과 동일 원칙).
    return {
      log: stalePending,
      orderId: stalePending.toss_order_id,
      subscriptionId: stalePending.subscription_id,
      isReclaim: true,
      alreadySucceeded: false,
    }
  }

  const subscriptionId = uuidv4()
  const lastAttemptNo = await subscriptionPaymentLogRepository.getInitialLastAttemptNo(userId, billingCycleDate, amount)
  const attemptNo = lastAttemptNo + 1
  const orderId = `ondam_sub_init_${userId.slice(0, 8)}_${billingCycleDate.replace(/-/g, '')}_${attemptNo}`

  try {
    const log = await subscriptionPaymentLogRepository.createLog({
      subscriptionId,
      userId,
      billingCycleDate,
      attemptNo,
      attemptType: 'initial',
      tossOrderId: orderId,
      amountKrw: amount,
    })
    return { log, orderId, subscriptionId, isReclaim: false }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      // 동시 요청이 먼저 같은 orderId로 INSERT에 성공한 경우 - 그 로그를 그대로
      // 재선점한다.
      const raced = await subscriptionPaymentLogRepository.findLogByOrderId(orderId)
      if (raced) {
        return {
          log: raced,
          orderId: raced.toss_order_id,
          subscriptionId: raced.subscription_id,
          isReclaim: true,
          alreadySucceeded: raced.log_status === 'success',
        }
      }
    }
    throw err
  }
}

/**
 * 결제 성공 반영 - 로그 업데이트 + payments INSERT + subscriptions 상태 업데이트를
 * 하나의 트랜잭션으로 묶는다 (G4).
 *
 * [C-2/#5 수정] currentNextBillingAt - 다음 청구일 계산 기준일. subscriptions.next_billing_at을
 * 그대로 넘기면 안 된다 - _finalizeFailure가 재시도 스케줄용으로 그 컬럼을
 * 덮어쓰기 때문에, 실패가 한 번이라도 끼면 이 값이 "원래 예정일"이 아니라
 * "마지막 재시도일"이 된다. 반드시 호출자(retryPayment/billingWorker)가
 * `addOneMonth(subscription.last_billed_at)`으로 재구성한 값 - 즉 "이번
 * 사이클이 원래 청구됐어야 할 날짜" - 을 넘겨야 한다. last_billed_at은 성공
 * 시에만 갱신되므로 재시도 중에는 불변이라 안전한 앵커다.
 * "오늘"을 기준으로 계산하면 재시도로 며칠 밀린 사이클마다 청구일이 앞으로
 * 드리프트한다 - 원래 예정일을 그대로 다음 달로 넘기는 것이 올바른 앵커다.
 * computeNextBillingAt이 그 결과가 과거/현재이면 미래가 될 때까지 추가로
 * +1개월씩 적용한다 (#1 - suspended 장기 방치 후 복구 시 즉시 재청구 방지).
 */
const _finalizeSuccess = async ({ log, subscriptionId, userId, orderId, amount, tossData, currentNextBillingAt }) => {
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

    // subscriptions 상태 업데이트 - 성공. 다음 청구일은 "오늘"이 아니라 이번
    // 사이클의 원래 예정일(currentNextBillingAt - 호출자가 last_billed_at 기준으로
    // 재구성해 넘긴 값, #5 참조)을 앵커로 +1개월 하되, 그 결과가 과거/현재라면
    // 미래가 될 때까지 계속 +1개월 한다 (#1 - suspended 장기 방치 후 복구 시 즉시
    // 재청구 방지).
    await subscriptionRepository.updateSubscriptionBilling(subscriptionId, {
      subStatus: 'active',
      failCount: 0,
      lastBilledAt: new Date(),
      nextBillingAt: computeNextBillingAt(currentNextBillingAt ?? new Date()),
    }, conn)

    await conn.commit()
  } catch (dbErr) {
    await conn.rollback()

    // [C-3/#6 수정] ER_DUP_ENTRY(특히 payments.toss_payment_key UNIQUE 충돌)는 "이
    // 결제가 이미 다른 시도(동시 실행·재시도 경합)로 정상 기록됐다"는 신호일
    // 가능성이 높다 - 이 카드 결제 자체는 유효하다. 이걸 "DB 쓰기 실패로 정합성이
    // 깨진 경우"와 동일하게 취급해 보상 환불하면, 정상 결제를 스스로 취소해버리는
    // 사고가 된다. 어느 테이블의 어떤 제약이 충돌했는지는 payments 테이블을 직접
    // 조회해 판별한다(isPaymentAlreadyRecorded, #6 - 에러 메시지의 인덱스명 문자열
    // 매칭은 두 테이블이 같은 이름의 UNIQUE 인덱스를 가져 신뢰할 수 없다). 그 외
    // 예외(연결 끊김, subscription_payment_logs.toss_payment_key 충돌 등 진짜
    // 정합성 파손)는 기존대로 보상 환불한다.
    const isDupEntry = dbErr.code === 'ER_DUP_ENTRY'
    const isPaymentKeyDuplicate = isDupEntry && await isPaymentAlreadyRecorded(tossPaymentKey)

    if (isPaymentKeyDuplicate) {
      console.warn(
        '[runBilling] payments.toss_payment_key 이미 존재 - 다른 시도가 정상 기록한 결제로 판단, 보상 환불 생략:',
        subscriptionId, tossPaymentKey, dbErr.message,
      )

      // [#4 수정] 위 트랜잭션이 롤백되어 로그는 pending, next_billing_at도
      // 미갱신 상태로 남는다. 이 결제(tossPaymentKey)는 이미 다른 시도가
      // payments에 정상 기록했으므로 payments를 다시 쓰지 않되, 로그·구독
      // 상태는 별도 트랜잭션으로 반드시 전진시켜야 한다 - 그러지 않으면 다음
      // scan-due가 매일 같은 구독을 다시 집어 "성공" 응답만 반복하고 사이클을
      // 영원히 못 넘긴다(완료 보고 4번 참조).
      try {
        const advanceConn = await pool.getConnection()
        try {
          await advanceConn.beginTransaction()
          await subscriptionPaymentLogRepository.updateLogResult(log.log_id, {
            logStatus: 'success',
            tossPaymentKey,
            succeededAt: new Date(),
          }, advanceConn)
          await subscriptionRepository.updateSubscriptionBilling(subscriptionId, {
            subStatus: 'active',
            failCount: 0,
            lastBilledAt: new Date(),
            nextBillingAt: computeNextBillingAt(currentNextBillingAt ?? new Date()),
          }, advanceConn)
          await advanceConn.commit()
        } catch (advanceErr) {
          await advanceConn.rollback()
          throw advanceErr
        } finally {
          advanceConn.release()
        }
      } catch (advanceErr) {
        console.error(
          '[runBilling] duplicateWrite 이후 로그/구독 상태 전진 실패 - 수동 확인 필요(다음 사이클 미전진 위험):',
          subscriptionId, tossPaymentKey, advanceErr.message,
        )
      }

      return { success: true, tossPaymentKey, duplicateWrite: true }
    }

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
    // [C-2 수정] next_billing_at을 nextRetryAt으로 갱신해야 실제 스캔(scan-due:
    // next_billing_at <= NOW())이 재시도를 찾는다. 이전에는 로그의 next_retry_at만
    // 기록되고 subscriptions.next_billing_at은 그대로 남아 있어, 원래 예정일이
    // 이미 지난 상태라면 재시도 간격(BILLING_RETRY_INTERVAL_DAYS)과 무관하게 매일
    // 재시도 대상으로 잡히거나(간격 무시), 원래 예정일이 미래라면 오히려 재시도가
    // 그 날짜까지 미뤄지는 등 실제 스케줄과 어긋났다. suspended 전이 시에는
    // nextRetryAt이 null이라 이 필드가 추가되지 않는다(어차피 scan-due는
    // sub_status IN ('active','past_due')만 대상으로 하므로 suspended는 next_billing_at과
    // 무관하게 자동 스캔에서 제외된다).
    //
    // [#5 수정] 여기서 next_billing_at을 nextRetryAt으로 덮어쓰면, 이 사이클의
    // "원래 청구 예정일"이라는 의미는 사라지고 순전히 "다음 스캔 대상일"이라는
    // 의미만 남는다 - next_billing_at은 이제 재시도 스케줄 전용이다. 이후 결제가
    // 성공하면(_finalizeSuccess) 다음 청구일을 계산할 앵커는 이 필드가 아니라
    // subscriptions.last_billed_at(성공 시에만 갱신되므로 재시도 중에도 불변)에서
    // 호출자(retryPayment/billingWorker)가 addOneMonth로 재구성해 넘긴다. 즉
    // "재시도 스케줄(next_billing_at)"과 "청구 앵커(last_billed_at 기반 복원값)"를
    // 서로 다른 컬럼으로 분리해, 실패가 몇 번 끼어도 원래 청구 주기가 드리프트하지
    // 않는다(완료 보고 5번 참조 - 새 컬럼 없이 기존 last_billed_at을 앵커로 재해석).
    await subscriptionRepository.updateSubscriptionBilling(subscriptionId, {
      subStatus: newSubStatus,
      gracePeriodUntil: newGracePeriodUntil,
      suspendedAt: newSuspendedAt,
      ...(nextRetryAt ? { nextBillingAt: nextRetryAt } : {}),
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
 * [B-1 수정] executeBilling 응답을 성공/실패/불확정으로 판정하는 순수 로직
 * (DB 쓰기 없음). runBilling(정기결제·재시도)과 subscribeService.subscribe(최초
 * 결제)가 동일한 판정 기준을 공유하기 위해 분리했다 - 두 경로가 "이미 처리됨"·
 * "불확정" 코드 목록을 각자 유지하면 drift가 생겨 한쪽만 이중청구 방어가 되는
 * 사고로 이어질 수 있다.
 * @param {{ tossResult: object, orderId: string, subscriptionId: string }} params
 * @returns {Promise<
 *   { outcome: 'success', tossData: object } |
 *   { outcome: 'failed', tossResult: object } |
 *   { outcome: 'indeterminate', failReason: string }
 * >}
 */
export const resolveBillingOutcome = async ({ tossResult, orderId, subscriptionId }) => {
  if (tossResult.ok) {
    return { outcome: 'success', tossData: tossResult.data }
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
      return { outcome: 'success', tossData: lookup.data }
    }

    if (isIndeterminateCode) {
      const lookupFailedByNetwork = lookup.errorCode === 'TIMEOUT' || lookup.errorCode === 'NETWORK_ERROR'
      if (!lookup.ok && lookupFailedByNetwork) {
        // [CRITICAL #1] 조회 자체도 실패 - 결제가 실제로 됐는지 안 됐는지 알 방법이
        // 없다. 여기서 실패로 확정하면 로그가 retry_scheduled/abandoned로 굳어버려
        // findPendingLogRaw가 더 이상 이 로그를 찾지 못하고, 다음 시도가 새
        // attempt_no + 새 orderId를 발급해 토스가 신규 주문으로 오인해 이중청구한다.
        // 아무 것도 확정하지 않고 로그를 pending 그대로 둔 채 리턴한다 - 다음 시도는
        // findPendingLogRaw가 이 pending을 stale로 판단해 같은 orderId를 재사용
        // (reclaim)하게 되고, 토스의 orderId 유일성 보장이 이중청구를 막는 최후
        // 방어선으로 작동한다.
        console.warn('[resolveBillingOutcome] 결제 결과 불확정 - 실패 확정을 보류하고 pending 유지:', {
          subscriptionId,
          orderId,
          executeErrorCode: errorCode,
          lookupErrorCode: lookup.errorCode,
        })
        return {
          outcome: 'indeterminate',
          failReason: '결제 결과를 확인하는 중입니다. 잠시 후 자동으로 재확인됩니다.',
        }
      }
      // 조회는 됐지만 DONE이 아니거나(READY/CANCELED/EXPIRED 등) 주문 자체가 없음 -
      // 명확히 미결제로 확인된 경우이므로 아래에서 진짜 실패로 확정한다.
    }
  }

  return { outcome: 'failed', tossResult }
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
 *   currentNextBillingAt: Date,
 *     - 반드시 addOneMonth(subscription.last_billed_at)로 재구성해 넘길 것.
 *       subscription.next_billing_at을 그대로 넘기지 말 것(#5 참조 - 재시도
 *       스케줄로 덮어써져 있을 수 있음).
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
  currentNextBillingAt,
}) => {
  if (isReclaim) {
    // [CRITICAL #1] 응답 유실로 방치된(stale) pending을 재시도하는 경우, 같은
    // orderId로 실제 결제가 이미 이뤄졌는지 먼저 조회한다. 조회 없이 바로
    // executeBilling을 다시 부르면, 이전 요청이 실제로는 성공했고 응답만
    // 유실됐을 뿐인 상황에서 두 번째 청구가 될 수 있다.
    const lookup = await subscriptionTossClient.getPaymentByOrderId({ orderId })
    if (lookup.ok && lookup.data?.status === 'DONE') {
      return _finalizeSuccess({ log, subscriptionId, userId, orderId, amount, tossData: lookup.data, currentNextBillingAt })
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

  const decision = await resolveBillingOutcome({ tossResult, orderId, subscriptionId })

  if (decision.outcome === 'success') {
    return _finalizeSuccess({
      log, subscriptionId, userId, orderId, amount, tossData: decision.tossData, currentNextBillingAt,
    })
  }
  if (decision.outcome === 'indeterminate') {
    return { success: false, indeterminate: true, failReason: decision.failReason }
  }
  return _finalizeFailure({ log, subscriptionId, tossResult: decision.tossResult })
}
