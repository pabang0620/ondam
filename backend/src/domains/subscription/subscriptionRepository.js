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
}) => {
  const [result] = await pool.execute(
    `INSERT INTO subscriptions
       (subscription_id, user_id, plan, sub_status,
        toss_billing_key_encrypted, billing_kms_key_id,
        price_krw, next_billing_at)
     SELECT ?, ?, ?, 'active', ?, ?, ?, ?
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
          changed_by, changed_by_type, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
         updated_at = NOW()
     WHERE subscription_id = ? AND deleted_at IS NULL`,
    [cancelReason ?? '사용자 취소', subscriptionId]
  )
  return findSubscriptionById(subscriptionId)
}
