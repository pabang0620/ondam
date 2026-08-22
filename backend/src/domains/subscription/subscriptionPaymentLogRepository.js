/**
 * 구독 결제 로그 Repository
 * subscription_payment_logs 테이블 접근 전용
 */

import { v4 as uuidv4 } from 'uuid'
import pool from '../../config/db.js'
import { toSafeLimit, toSafeOffset } from '../../utils/pagination.js'

/**
 * 결제 로그 생성 - pending 상태로 선기록 (결제 실행 전)
 * @param {{ subscriptionId, userId, billingCycleDate, attemptNo, attemptType, tossOrderId, amountKrw }} params
 * @returns {Promise<object>}
 */
export const createLog = async (
  {
    subscriptionId,
    userId,
    billingCycleDate,
    attemptNo,
    attemptType,
    tossOrderId,
    amountKrw,
  },
  conn = null
) => {
  const executor = conn ?? pool
  const logId = uuidv4()
  await executor.execute(
    `INSERT INTO subscription_payment_logs
       (log_id, subscription_id, user_id, billing_cycle_date,
        attempt_no, attempt_type, toss_order_id, amount_krw,
        log_status, attempted_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
    [
      logId,
      subscriptionId,
      userId,
      billingCycleDate,
      attemptNo,
      attemptType,
      tossOrderId,
      amountKrw,
    ]
  )
  return findLogById(logId, conn)
}

/**
 * log_id로 단건 조회
 * @param {string} logId
 * @param {import('mysql2/promise').PoolConnection|null} conn - 트랜잭션 내에서 읽어야 할 때 전달
 * @returns {Promise<object|null>}
 */
export const findLogById = async (logId, conn = null) => {
  const executor = conn ?? pool
  const [rows] = await executor.execute(
    `SELECT log_id, subscription_id, user_id, billing_cycle_date,
            attempt_no, attempt_type, toss_order_id, toss_payment_key,
            amount_krw, log_status, attempted_at, succeeded_at, failed_at,
            fail_code, fail_category, fail_reason, next_retry_at, created_at
     FROM subscription_payment_logs
     WHERE log_id = ?
     LIMIT 1`,
    [logId]
  )
  return rows[0] ?? null
}

/**
 * 결제 결과 업데이트 (성공/실패)
 * @param {string} logId
 * @param {{ logStatus, tossPaymentKey?, succeededAt?, failedAt?, failCode?, failCategory?, failReason?, nextRetryAt? }} fields
 * @returns {Promise<object>}
 */
export const updateLogResult = async (
  logId,
  {
    logStatus,
    tossPaymentKey,
    succeededAt,
    failedAt,
    failCode,
    failCategory,
    failReason,
    nextRetryAt,
  },
  conn = null
) => {
  const ALLOWED_STATUS = ['success', 'failed', 'retry_scheduled', 'abandoned', 'pending']
  if (!ALLOWED_STATUS.includes(logStatus)) {
    throw Object.assign(new Error(`유효하지 않은 log_status: ${logStatus}`), { status: 500 })
  }

  const executor = conn ?? pool
  await executor.execute(
    `UPDATE subscription_payment_logs
     SET log_status     = ?,
         toss_payment_key = COALESCE(?, toss_payment_key),
         succeeded_at   = COALESCE(?, succeeded_at),
         failed_at      = COALESCE(?, failed_at),
         fail_code      = COALESCE(?, fail_code),
         fail_category  = COALESCE(?, fail_category),
         fail_reason    = COALESCE(?, fail_reason),
         next_retry_at  = COALESCE(?, next_retry_at)
     WHERE log_id = ?`,
    [
      logStatus,
      tossPaymentKey ?? null,
      succeededAt ?? null,
      failedAt ?? null,
      failCode ?? null,
      failCategory ?? null,
      failReason ?? null,
      nextRetryAt ?? null,
      logId,
    ]
  )
  return findLogById(logId, conn)
}

/**
 * 구독별 결제 로그 조회 (최신순)
 * @param {string} subscriptionId
 * @param {{ limit?: number, offset?: number }} options
 * @returns {Promise<{ logs: object[], total: number }>}
 */
export const findLogsBySubscriptionId = async (subscriptionId, { limit = 20, offset = 0 } = {}) => {
  // mysql2 execute()는 LIMIT/OFFSET 플레이스홀더를 지원하지 않는다(utils/pagination.js
  // 참고) - 검증된 정수로 클램프한 뒤 SQL 문자열에 직접 삽입한다.
  const safeLimit = toSafeLimit(limit)
  const safeOffset = toSafeOffset(offset)
  const [rows] = await pool.execute(
    `SELECT log_id, subscription_id, user_id, billing_cycle_date,
            attempt_no, attempt_type, toss_order_id, toss_payment_key,
            amount_krw, log_status, attempted_at, succeeded_at, failed_at,
            fail_code, fail_category, fail_reason, next_retry_at, created_at
     FROM subscription_payment_logs
     WHERE subscription_id = ?
     ORDER BY attempted_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    [subscriptionId]
  )
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM subscription_payment_logs
     WHERE subscription_id = ?`,
    [subscriptionId]
  )
  return { logs: rows, total: Number(total) }
}

/**
 * 오늘 billing_cycle_date에 이미 성공/pending 로그가 있는지 확인 (멱등성 체크)
 *
 * [DEV-26 수정] pending 로그는 attempted_at 기준 BILLING_PENDING_STALE_MINUTES(기본 15분)
 * 이내인 것만 "처리 중"으로 간주한다. 프로세스 크래시로 pending이 영구히 남으면
 * 그 이후로 해당 사이클의 결제가 영구 skip되는 고아 상태가 되므로, 오래된 pending은
 * 멱등성 체크에서 제외해 재시도를 허용한다. 15분은 토스 빌링 API 호출이 정상적으로는
 * 수 초 내 끝나는 것을 감안한 여유값 - 그보다 오래 pending이면 크래시로 판단한다.
 * @param {string} subscriptionId
 * @param {string} billingCycleDate - 'YYYY-MM-DD' 형식
 * @param {import('mysql2/promise').PoolConnection|null} conn - 락을 쥔 트랜잭션 내에서 확인할 때 전달
 * @returns {Promise<object|null>}
 */
export const findTodayLog = async (subscriptionId, billingCycleDate, conn = null) => {
  const executor = conn ?? pool
  // Number.isFinite로 검증한다 - 환경변수에 빈 문자열/공백/숫자 아닌 값이 들어오면
  // Number()가 NaN을 반환하고, NaN이 prepared statement 파라미터로 들어가면 쿼리
  // 자체가 실패한다. '??'만으로는 "설정은 됐지만 잘못된 문자열"인 경우를 걸러내지
  // 못한다.
  const rawStaleMinutes = Number(process.env.BILLING_PENDING_STALE_MINUTES)
  const staleMinutes = Number.isFinite(rawStaleMinutes) && rawStaleMinutes > 0 ? rawStaleMinutes : 15
  const [rows] = await executor.execute(
    `SELECT log_id, log_status, toss_payment_key, attempted_at
     FROM subscription_payment_logs
     WHERE subscription_id = ?
       AND billing_cycle_date = ?
       AND (
         log_status = 'success'
         OR (log_status = 'pending' AND attempted_at > DATE_SUB(NOW(), INTERVAL ? MINUTE))
       )
     LIMIT 1`,
    [subscriptionId, billingCycleDate, staleMinutes]
  )
  return rows[0] ?? null
}

/**
 * 구독별 마지막 시도 번호 조회 (attempt_no 채번용)
 *
 * [CRITICAL #2 수정] conn 파라미터를 추가한다. 이전에는 항상 pool로 직접 호출해
 * FOR UPDATE 락 밖에서 채번했다 - 재시도 버튼 더블클릭 시 두 요청이 서로 다른
 * 시점에 이 함수를 (락 없이) 호출해 각자 다른 attempt_no/orderId를 만들고, 결국
 * 둘 다 토스 결제를 실행해 실결제 2건이 되는 경로가 있었다. 호출자가 FOR UPDATE로
 * 잠근 트랜잭션의 conn을 넘기면 채번 자체가 락 보호를 받는다.
 * @param {string} subscriptionId
 * @param {string} billingCycleDate
 * @param {import('mysql2/promise').PoolConnection|null} conn
 * @returns {Promise<number>}
 */
export const getLastAttemptNo = async (subscriptionId, billingCycleDate, conn = null) => {
  const executor = conn ?? pool
  const [rows] = await executor.execute(
    `SELECT COALESCE(MAX(attempt_no), 0) AS last_no
     FROM subscription_payment_logs
     WHERE subscription_id = ?
       AND billing_cycle_date = ?`,
    [subscriptionId, billingCycleDate]
  )
  return Number(rows[0]?.last_no ?? 0)
}

/**
 * [B-1] toss_order_id(UNIQUE)로 단건 조회. 최초 결제(subscribe) 예약 시 동시
 * 요청이 같은 orderId로 먼저 INSERT에 성공했을 때(ER_DUP_ENTRY) 그 로그를
 * 재조회하는 용도.
 * @param {string} orderId
 * @param {import('mysql2/promise').PoolConnection|null} conn
 * @returns {Promise<object|null>}
 */
export const findLogByOrderId = async (orderId, conn = null) => {
  const executor = conn ?? pool
  const [rows] = await executor.execute(
    `SELECT log_id, subscription_id, user_id, billing_cycle_date,
            attempt_no, attempt_type, toss_order_id, toss_payment_key,
            amount_krw, log_status, attempted_at, succeeded_at, failed_at,
            fail_code, fail_category, fail_reason, next_retry_at, created_at
     FROM subscription_payment_logs
     WHERE toss_order_id = ?
     LIMIT 1`,
    [orderId]
  )
  return rows[0] ?? null
}

/**
 * [B-1] 최초 결제(initial) 오늘자 "블로킹" 로그 조회. subscription_id가 아직 없는
 * 상태이므로 user_id + billing_cycle_date + amount_krw(플랜 가격)로 식별한다.
 *
 * [#2 수정] success 로그는 그 로그가 만든 subscription이 이후 취소(canceled)됐다면
 * 더 이상 블로킹 대상이 아니다 - LEFT JOIN으로 subscriptions.sub_status를 함께
 * 확인해, 같은 날 해지 후 재구독 시 옛 success 로그가 새 결제를 가로막지
 * 않게 한다(구독 행이 아직 없는 pending 상태에서는 애초에 취소될 대상이 없으므로
 * 이 조건은 success에만 적용한다).
 *
 * [#3 수정] pending 로그는 findTodayLog(정기결제)와 동일하게
 * BILLING_PENDING_STALE_MINUTES(기본 15분) 이내인 "신선한" 것만 블로킹 대상으로
 * 본다. 방치된(stale) pending까지 무조건 블로킹하면 재선점 판단을 여기서 끝내버려
 * reserveInitialBillingAttempt가 신선/방치를 구분하지 못한다 - 그 구분은
 * findInitialPendingLogRaw가 별도로 담당한다.
 * @param {string} userId
 * @param {string} billingCycleDate - 'YYYY-MM-DD'
 * @param {number} amountKrw
 * @param {import('mysql2/promise').PoolConnection|null} conn
 * @returns {Promise<object|null>}
 */
export const findInitialTodayLog = async (userId, billingCycleDate, amountKrw, conn = null) => {
  const executor = conn ?? pool
  const rawStaleMinutes = Number(process.env.BILLING_PENDING_STALE_MINUTES)
  const staleMinutes = Number.isFinite(rawStaleMinutes) && rawStaleMinutes > 0 ? rawStaleMinutes : 15
  const [rows] = await executor.execute(
    `SELECT l.log_id, l.subscription_id, l.user_id, l.billing_cycle_date,
            l.attempt_no, l.attempt_type, l.toss_order_id, l.toss_payment_key,
            l.amount_krw, l.log_status, l.attempted_at, l.succeeded_at, l.failed_at,
            l.fail_code, l.fail_category, l.fail_reason, l.next_retry_at, l.created_at
     FROM subscription_payment_logs l
     LEFT JOIN subscriptions s ON s.subscription_id = l.subscription_id
     WHERE l.user_id = ?
       AND l.billing_cycle_date = ?
       AND l.amount_krw = ?
       AND l.attempt_type = 'initial'
       AND (
         (l.log_status = 'success' AND (s.subscription_id IS NULL OR s.sub_status != 'canceled'))
         OR (l.log_status = 'pending' AND l.attempted_at > DATE_SUB(NOW(), INTERVAL ? MINUTE))
       )
     ORDER BY l.attempt_no DESC
     LIMIT 1`,
    [userId, billingCycleDate, amountKrw, staleMinutes]
  )
  return rows[0] ?? null
}

/**
 * [#3] 최초 결제(initial) 오늘자 pending 로그를 신선/방치 여부와 무관하게 원본
 * 그대로 조회한다 (재선점 판단용). findInitialTodayLog가 신선한 pending만 블로킹
 * 대상으로 보고 null을 반환했을 때, 그 방치된(stale) pending을 재사용할 수 있게
 * 한다 - findPendingLogRaw(정기결제)의 initial 버전.
 * @param {string} userId
 * @param {string} billingCycleDate - 'YYYY-MM-DD'
 * @param {number} amountKrw
 * @param {import('mysql2/promise').PoolConnection|null} conn
 * @returns {Promise<object|null>}
 */
export const findInitialPendingLogRaw = async (userId, billingCycleDate, amountKrw, conn = null) => {
  const executor = conn ?? pool
  const [rows] = await executor.execute(
    `SELECT log_id, subscription_id, user_id, billing_cycle_date,
            attempt_no, attempt_type, toss_order_id, toss_payment_key,
            amount_krw, log_status, attempted_at, succeeded_at, failed_at,
            fail_code, fail_category, fail_reason, next_retry_at, created_at
     FROM subscription_payment_logs
     WHERE user_id = ?
       AND billing_cycle_date = ?
       AND amount_krw = ?
       AND attempt_type = 'initial'
       AND log_status = 'pending'
     ORDER BY attempt_no DESC
     LIMIT 1`,
    [userId, billingCycleDate, amountKrw]
  )
  return rows[0] ?? null
}

/**
 * [B-1] 최초 결제(initial) 오늘자 마지막 attempt_no 조회 (subscription_id 없이
 * user_id + amount_krw 기준 채번).
 * @param {string} userId
 * @param {string} billingCycleDate
 * @param {number} amountKrw
 * @param {import('mysql2/promise').PoolConnection|null} conn
 * @returns {Promise<number>}
 */
export const getInitialLastAttemptNo = async (userId, billingCycleDate, amountKrw, conn = null) => {
  const executor = conn ?? pool
  const [rows] = await executor.execute(
    `SELECT COALESCE(MAX(attempt_no), 0) AS last_no
     FROM subscription_payment_logs
     WHERE user_id = ?
       AND billing_cycle_date = ?
       AND amount_krw = ?
       AND attempt_type = 'initial'`,
    [userId, billingCycleDate, amountKrw]
  )
  return Number(rows[0]?.last_no ?? 0)
}

/**
 * 오늘 pending 로그를 신선/방치 여부와 무관하게 원본 그대로 조회한다 (재선점 판단용).
 *
 * findTodayLog는 신선한(BILLING_PENDING_STALE_MINUTES 이내) pending만 "처리 중"으로
 * 간주해 반환하고, 방치된(stale) pending은 null로 취급해 호출자가 "막을 로그 없음"으로
 * 오인하게 한다. 이 함수는 그 방치된 pending도 그대로 돌려줘, 호출자가 새 로그를
 * INSERT하는 대신 기존 로그(및 그 toss_order_id)를 재사용할 수 있게 한다 (CRITICAL #1).
 * @param {string} subscriptionId
 * @param {string} billingCycleDate - 'YYYY-MM-DD' 형식
 * @param {import('mysql2/promise').PoolConnection|null} conn - 락을 쥔 트랜잭션 내에서 확인할 때 전달
 * @returns {Promise<object|null>}
 */
export const findPendingLogRaw = async (subscriptionId, billingCycleDate, conn = null) => {
  const executor = conn ?? pool
  const [rows] = await executor.execute(
    `SELECT log_id, subscription_id, user_id, billing_cycle_date,
            attempt_no, attempt_type, toss_order_id, toss_payment_key,
            amount_krw, log_status, attempted_at, succeeded_at, failed_at,
            fail_code, fail_category, fail_reason, next_retry_at, created_at
     FROM subscription_payment_logs
     WHERE subscription_id = ?
       AND billing_cycle_date = ?
       AND log_status = 'pending'
     ORDER BY attempt_no DESC
     LIMIT 1`,
    [subscriptionId, billingCycleDate]
  )
  return rows[0] ?? null
}
