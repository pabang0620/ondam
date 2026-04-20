import pool from '../../config/db.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * 구독 생성
 */
export const createSubscription = async ({
  subscriptionId,
  userId,
  plan,
  billingKeyEncrypted,
  billingKmsKeyId,
  priceKrw,
  nextBillingAt,
  lastBilledAt,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO subscriptions
       (subscription_id, user_id, plan, sub_status,
        toss_billing_key_encrypted, billing_kms_key_id,
        price_krw, next_billing_at, last_billed_at)
     SELECT ?, ?, ?, 'active', ?, ?, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM subscriptions
       WHERE user_id = ? AND plan = ? AND sub_status = 'active' AND deleted_at IS NULL
     )`,
    [
      subscriptionId,
      userId,
      plan,
      billingKeyEncrypted,
      billingKmsKeyId,
      priceKrw,
      nextBillingAt,
      lastBilledAt ?? new Date(),
      userId,
      plan,
    ]
  )
  if (result.affectedRows === 0) {
    throw Object.assign(new Error('이미 구독 중인 플랜입니다'), { status: 409 })
  }
  return findSubscriptionById(subscriptionId)
}

/**
 * subscription_id(UUID)로 단건 조회
 */
export const findSubscriptionById = async (subscriptionId) => {
  const [rows] = await pool.execute(
    `SELECT subscription_id, user_id, plan, sub_status,
            billing_kms_key_id, price_krw,
            next_billing_at, last_billed_at,
            fail_count, grace_period_until, suspended_at, last_failed_at,
            canceled_at, cancel_reason,
            created_at, updated_at
     FROM subscriptions
     WHERE subscription_id = ? AND deleted_at IS NULL`,
    [subscriptionId]
  )
  return rows[0] ?? null
}

/**
 * 활성 구독 단건 조회 (중복 구독 확인용)
 */
export const findActiveSubscription = async (userId, plan) => {
  const [rows] = await pool.execute(
    `SELECT subscription_id, user_id, plan, sub_status,
            price_krw, next_billing_at, last_billed_at,
            created_at
     FROM subscriptions
     WHERE user_id = ? AND plan = ? AND sub_status = 'active' AND deleted_at IS NULL
     LIMIT 1`,
    [userId, plan]
  )
  return rows[0] ?? null
}

/**
 * 사용자 구독 목록 조회
 */
export const findSubscriptionsByUserId = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT subscription_id, user_id, plan, sub_status,
            price_krw, next_billing_at, last_billed_at,
            canceled_at, cancel_reason, created_at, updated_at
     FROM subscriptions
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [userId]
  )
  return rows
}

/**
 * 구독 상태 변경 + subscription_logs INSERT (트랜잭션)
 */
export const updateSubscriptionStatus = async (
  subscriptionId,
  { subStatus, prevStatus, changedBy, changedByType, reason }
) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    await conn.execute(
      `UPDATE subscriptions
       SET sub_status = ?, updated_at = NOW()
       WHERE subscription_id = ? AND deleted_at IS NULL`,
      [subStatus, subscriptionId]
    )

    const logId = uuidv4()
    await conn.execute(
      `INSERT INTO subscription_logs
         (log_id, subscription_id, prev_status, next_status,
          changed_by, changed_by_type, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [logId, subscriptionId, prevStatus, subStatus, changedBy, changedByType, reason ?? null]
    )

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  return findSubscriptionById(subscriptionId)
}

/**
 * 다음 결제일 + 마지막 결제일 업데이트 (정기 결제 처리 후)
 */
export const updateNextBilling = async (subscriptionId, { nextBillingAt, lastBilledAt }) => {
  await pool.execute(
    `UPDATE subscriptions
     SET next_billing_at = ?,
         last_billed_at = ?,
         updated_at = NOW()
     WHERE subscription_id = ? AND deleted_at IS NULL`,
    [nextBillingAt, lastBilledAt ?? new Date(), subscriptionId]
  )
  return findSubscriptionById(subscriptionId)
}

/**
 * 구독 취소 — sub_status='canceled', canceled_at, cancel_reason 업데이트
 */
export const cancelSubscription = async (subscriptionId, { cancelReason }) => {
  await pool.execute(
    `UPDATE subscriptions
     SET sub_status = 'canceled',
         canceled_at = NOW(),
         cancel_reason = ?,
         toss_billing_key_encrypted = NULL,
         billing_kms_key_id = NULL,
         updated_at = NOW()
     WHERE subscription_id = ? AND deleted_at IS NULL`,
    [cancelReason ?? '사용자 취소', subscriptionId]
  )
  return findSubscriptionById(subscriptionId)
}

/**
 * 구독 결제 관련 필드 업데이트 (워커/서비스에서 사용)
 * 허용 필드: subStatus, failCount, lastBilledAt, nextBillingAt, gracePeriodUntil, suspendedAt, lastFailedAt
 * @param {string} subscriptionId
 * @param {object} fields
 * @returns {Promise<object>}
 */
export const updateSubscriptionBilling = async (subscriptionId, fields) => {
  const FIELD_MAP = {
    subStatus: 'sub_status',
    failCount: 'fail_count',
    lastBilledAt: 'last_billed_at',
    nextBillingAt: 'next_billing_at',
    gracePeriodUntil: 'grace_period_until',
    suspendedAt: 'suspended_at',
    lastFailedAt: 'last_failed_at',
  }

  const entries = Object.entries(fields).filter(([k]) => FIELD_MAP[k] !== undefined)
  if (entries.length === 0) return findSubscriptionById(subscriptionId)

  const setClauses = entries.map(([k]) => `${FIELD_MAP[k]} = ?`).join(', ')
  const values = entries.map(([, v]) => v)

  await pool.execute(
    `UPDATE subscriptions
     SET ${setClauses}, updated_at = NOW()
     WHERE subscription_id = ? AND deleted_at IS NULL`,
    [...values, subscriptionId]
  )
  return findSubscriptionById(subscriptionId)
}

/**
 * 구독 단건 조회 (빌링키 포함) — 결제 처리용 FOR UPDATE 버전
 * 반드시 트랜잭션 커넥션 안에서 사용할 것
 * @param {string} subscriptionId
 * @returns {Promise<object|null>}
 */
export const findSubscriptionForBilling = async (subscriptionId) => {
  const [rows] = await pool.execute(
    `SELECT subscription_id, user_id, plan, sub_status,
            toss_billing_key_encrypted, billing_kms_key_id,
            price_krw, next_billing_at, last_billed_at,
            fail_count, grace_period_until, suspended_at,
            created_at, updated_at
     FROM subscriptions
     WHERE subscription_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [subscriptionId]
  )
  return rows[0] ?? null
}

/**
 * 결제 대상 구독 목록 조회
 * sub_status IN ('active','past_due') AND next_billing_at <= NOW()
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
export const findDueSubscriptions = async (limit = 500) => {
  const [rows] = await pool.execute(
    `SELECT subscription_id, user_id, plan, sub_status,
            toss_billing_key_encrypted, billing_kms_key_id,
            price_krw, next_billing_at, fail_count
     FROM subscriptions
     WHERE sub_status IN ('active', 'past_due')
       AND next_billing_at <= NOW()
       AND deleted_at IS NULL
     LIMIT ?`,
    [limit]
  )
  return rows
}
