/**
 * 구독 결제 로그 Repository
 * subscription_payment_logs 테이블 접근 전용
 */

import { v4 as uuidv4 } from 'uuid'
import pool from '../../config/db.js'

/**
 * 결제 로그 생성 - pending 상태로 선기록 (결제 실행 전)
 * @param {{ subscriptionId, userId, billingCycleDate, attemptNo, attemptType, tossOrderId, amountKrw }} params
 * @returns {Promise<object>}
 */
export const createLog = async ({
  subscriptionId,
  userId,
  billingCycleDate,
  attemptNo,
  attemptType,
  tossOrderId,
  amountKrw,
}) => {
  const logId = uuidv4()
  await pool.execute(
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
  return findLogById(logId)
}

/**
 * log_id로 단건 조회
 * @param {string} logId
 * @returns {Promise<object|null>}
 */
export const findLogById = async (logId) => {
  const [rows] = await pool.execute(
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
  }
) => {
  const ALLOWED_STATUS = ['success', 'failed', 'retry_scheduled', 'abandoned', 'pending']
  if (!ALLOWED_STATUS.includes(logStatus)) {
    throw Object.assign(new Error(`유효하지 않은 log_status: ${logStatus}`), { status: 500 })
  }

  await pool.execute(
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
  return findLogById(logId)
}

/**
 * 구독별 결제 로그 조회 (최신순)
 * @param {string} subscriptionId
 * @param {{ limit?: number, offset?: number }} options
 * @returns {Promise<{ logs: object[], total: number }>}
 */
export const findLogsBySubscriptionId = async (subscriptionId, { limit = 20, offset = 0 } = {}) => {
  const [rows] = await pool.execute(
    `SELECT log_id, subscription_id, user_id, billing_cycle_date,
            attempt_no, attempt_type, toss_order_id, toss_payment_key,
            amount_krw, log_status, attempted_at, succeeded_at, failed_at,
            fail_code, fail_category, fail_reason, next_retry_at, created_at
     FROM subscription_payment_logs
     WHERE subscription_id = ?
     ORDER BY attempted_at DESC
     LIMIT ? OFFSET ?`,
    [subscriptionId, limit, offset]
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
 * @param {string} subscriptionId
 * @param {string} billingCycleDate - 'YYYY-MM-DD' 형식
 * @returns {Promise<object|null>}
 */
export const findTodayLog = async (subscriptionId, billingCycleDate) => {
  const [rows] = await pool.execute(
    `SELECT log_id, log_status, toss_payment_key
     FROM subscription_payment_logs
     WHERE subscription_id = ?
       AND billing_cycle_date = ?
       AND log_status IN ('success', 'pending')
     LIMIT 1`,
    [subscriptionId, billingCycleDate]
  )
  return rows[0] ?? null
}

/**
 * 구독별 마지막 시도 번호 조회 (attempt_no 채번용)
 * @param {string} subscriptionId
 * @param {string} billingCycleDate
 * @returns {Promise<number>}
 */
export const getLastAttemptNo = async (subscriptionId, billingCycleDate) => {
  const [rows] = await pool.execute(
    `SELECT COALESCE(MAX(attempt_no), 0) AS last_no
     FROM subscription_payment_logs
     WHERE subscription_id = ?
       AND billing_cycle_date = ?`,
    [subscriptionId, billingCycleDate]
  )
  return Number(rows[0]?.last_no ?? 0)
}
