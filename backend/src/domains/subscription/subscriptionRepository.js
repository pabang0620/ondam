import pool from '../../config/db.js'
import { v4 as uuidv4 } from 'uuid'
import { toSafeLimit } from '../../utils/pagination.js'

/**
 * 구독 생성
 * @param {object} params
 * @param {import('mysql2/promise').PoolConnection|null} conn - 트랜잭션 내에서 실행할 때 전달 (DEV-26)
 */
export const createSubscription = async (
  {
    subscriptionId,
    userId,
    plan,
    billingKeyEncrypted,
    billingKmsKeyId,
    priceKrw,
    nextBillingAt,
    lastBilledAt,
  },
  conn = null
) => {
  const executor = conn ?? pool
  const [result] = await executor.execute(
    `INSERT INTO subscriptions
       (subscription_id, user_id, plan, sub_status,
        toss_billing_key_encrypted, billing_kms_key_id,
        price_krw, next_billing_at, last_billed_at)
     SELECT ?, ?, ?, 'active', ?, ?, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM subscriptions
       WHERE user_id = ? AND plan = ?
         AND sub_status IN ('active', 'past_due', 'suspended')
         AND deleted_at IS NULL
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
    throw Object.assign(new Error('이미 구독 중이거나(연체/정지 포함) 진행 중인 플랜입니다'), { status: 409 })
  }
  return findSubscriptionById(subscriptionId, conn)
}

/**
 * subscription_id(UUID)로 단건 조회
 * @param {string} subscriptionId
 * @param {import('mysql2/promise').PoolConnection|null} conn - 트랜잭션 내에서 읽어야 할 때 전달
 */
export const findSubscriptionById = async (subscriptionId, conn = null) => {
  const executor = conn ?? pool
  const [rows] = await executor.execute(
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
 * 중복 구독 판정용 조회 (신규 구독 생성 전 차단 목적)
 * active뿐 아니라 past_due/suspended도 포함한다 - 연체·정지 구독을 그대로 둔 채
 * 재구독하면 구독이 2개가 되고, 연체 건은 계속 과금 대상으로 남는다 (DEV-26 task 7)
 */
export const findBlockingSubscription = async (userId, plan) => {
  const [rows] = await pool.execute(
    `SELECT subscription_id, user_id, plan, sub_status,
            price_krw, next_billing_at, last_billed_at,
            created_at
     FROM subscriptions
     WHERE user_id = ? AND plan = ?
       AND sub_status IN ('active', 'past_due', 'suspended')
       AND deleted_at IS NULL
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
 * 구독 상태 변경 + subscription_logs INSERT
 *
 * [DEV-26 수정] 이전에는 params.conn을 받아놓고 실제로는 무시한 채 매번 자체
 * pool.getConnection()으로 별도 트랜잭션을 열었다("트랜잭션 주석이 거짓" 사고 -
 * G4-3). 호출자가 conn을 넘기면 그 커넥션/트랜잭션을 그대로 사용해 실행만 하고
 * commit/rollback/release는 호출자가 책임진다. conn이 없으면(하위호환) 이 함수가
 * 자체 트랜잭션을 관리한다.
 * @param {string} subscriptionId
 * @param {{subStatus, prevStatus, changedBy, changedByType, reason, conn?}} params
 */
export const updateSubscriptionStatus = async (
  subscriptionId,
  { subStatus, prevStatus, changedBy, changedByType, reason, conn: externalConn }
) => {
  const ownsTransaction = !externalConn
  const conn = externalConn ?? await pool.getConnection()
  try {
    if (ownsTransaction) await conn.beginTransaction()

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

    if (ownsTransaction) await conn.commit()
  } catch (err) {
    if (ownsTransaction) await conn.rollback()
    throw err
  } finally {
    if (ownsTransaction) conn.release()
  }

  return findSubscriptionById(subscriptionId, externalConn)
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
 * 구독 취소 - sub_status='canceled', canceled_at, cancel_reason 업데이트
 * [DEV-26 수정] conn을 받아놓고 무시하던 버그 수정 - 전달받으면 그 커넥션으로 실행
 */
export const cancelSubscription = async (subscriptionId, { cancelReason, conn = null } = {}) => {
  const executor = conn ?? pool
  await executor.execute(
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
  return findSubscriptionById(subscriptionId, conn)
}

/**
 * 구독 결제 관련 필드 업데이트 (워커/서비스에서 사용)
 * 허용 필드: subStatus, failCount, lastBilledAt, nextBillingAt, gracePeriodUntil, suspendedAt, lastFailedAt
 * @param {string} subscriptionId
 * @param {object} fields
 * @param {import('mysql2/promise').PoolConnection|null} conn - 트랜잭션 내에서 실행할 때 전달 (DEV-26)
 * @returns {Promise<object>}
 */
export const updateSubscriptionBilling = async (subscriptionId, fields, conn = null) => {
  const executor = conn ?? pool
  const FIELD_MAP = {
    subStatus: 'sub_status',
    failCount: 'fail_count',
    lastBilledAt: 'last_billed_at',
    nextBillingAt: 'next_billing_at',
    gracePeriodUntil: 'grace_period_until',
    suspendedAt: 'suspended_at',
    lastFailedAt: 'last_failed_at',
  }

  // incrementFailCount 플래그 분리 (아토믹 연산 처리)
  const { incrementFailCount, ...rest } = fields
  const entries = Object.entries(rest).filter(([k]) => FIELD_MAP[k] !== undefined)

  const setClauses = entries.map(([k]) => `${FIELD_MAP[k]} = ?`)
  const values = entries.map(([, v]) => v)

  // incrementFailCount: true 이면 fail_count = fail_count + 1 아토믹 증가
  if (incrementFailCount) {
    setClauses.push('fail_count = fail_count + 1')
  }

  if (setClauses.length === 0) return findSubscriptionById(subscriptionId, conn)

  await executor.execute(
    `UPDATE subscriptions
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE subscription_id = ? AND deleted_at IS NULL`,
    [...values, subscriptionId]
  )
  return findSubscriptionById(subscriptionId, conn)
}

/**
 * 구독 단건 조회 (빌링키 포함) - 결제 처리용 FOR UPDATE 버전
 * 트랜잭션 커넥션(conn)을 전달하면 FOR UPDATE 락이 실제로 동작함
 * @param {string} subscriptionId
 * @param {import('mysql2/promise').PoolConnection|null} conn
 * @returns {Promise<object|null>}
 */
export const findSubscriptionForBilling = async (subscriptionId, conn = null) => {
  const executor = conn ?? pool
  const [rows] = await executor.execute(
    `SELECT subscription_id, user_id, plan, sub_status,
            toss_billing_key_encrypted, billing_kms_key_id,
            price_krw, next_billing_at, last_billed_at,
            fail_count, grace_period_until, suspended_at,
            created_at, updated_at
     FROM subscriptions
     WHERE subscription_id = ? AND deleted_at IS NULL
     LIMIT 1
     FOR UPDATE`,
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
  // mysql2 execute()는 LIMIT 플레이스홀더를 지원하지 않는다(utils/pagination.js
  // 참고) - 검증된 정수로 클램프한 뒤 SQL 문자열에 직접 삽입한다. 이 함수는 워커
  // 내부에서만 호출되는 배치 스캔이라 사용자 페이지네이션(max 100)보다 큰 상한을 둔다.
  const safeLimit = toSafeLimit(limit, { max: 1000, fallback: 500 })
  const [rows] = await pool.execute(
    `SELECT subscription_id, user_id, plan, sub_status,
            toss_billing_key_encrypted, billing_kms_key_id,
            price_krw, next_billing_at, fail_count
     FROM subscriptions
     WHERE sub_status IN ('active', 'past_due')
       AND next_billing_at <= NOW()
       AND deleted_at IS NULL
     LIMIT ${safeLimit}`,
  )
  return rows
}
