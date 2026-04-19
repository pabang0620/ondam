import pool from '../../config/db.js'

/**
 * 결제 레코드 생성 (status='ready')
 * toss_payment_key 는 토스 승인 콜백(updatePaymentDone) 에서 실제 키로 업데이트됨
 * 생성 시점에는 toss_order_id 를 임시 식별자로 사용하며, payment_id(UUID) 를 toss_payment_key 초기값으로 활용해 UNIQUE 제약 준수
 */
export const createPayment = async ({ paymentId, userId, targetType, targetId, tossOrderId, amountKrw }) => {
  const [result] = await pool.execute(
    `INSERT INTO payments
       (payment_id, user_id, target_type, target_id, toss_payment_key,
        toss_order_id, amount_krw, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ready')`,
    [paymentId, userId, targetType, targetId, paymentId, tossOrderId, amountKrw]
  )
  return findPaymentById(paymentId)
}

/**
 * payment_id(UUID)로 단건 조회
 */
export const findPaymentById = async (paymentId) => {
  const [rows] = await pool.execute(
    `SELECT payment_id, user_id, target_type, target_id,
            toss_payment_key, toss_order_id, amount_krw, status,
            paid_at, canceled_at, cancel_reason, fail_reason,
            created_at, updated_at
     FROM payments
     WHERE payment_id = ? AND deleted_at IS NULL`,
    [paymentId]
  )
  return rows[0] ?? null
}

/**
 * 사용자 결제 목록 페이지네이션 조회
 */
export const findPaymentsByUserId = async (userId, { limit = 20, offset = 0 }) => {
  const [rows] = await pool.execute(
    `SELECT payment_id, user_id, target_type, target_id,
            toss_payment_key, toss_order_id, amount_krw, status,
            paid_at, canceled_at, created_at
     FROM payments
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  )
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM payments WHERE user_id = ? AND deleted_at IS NULL`,
    [userId]
  )
  return { payments: rows, total }
}

/**
 * toss_payment_key로 조회 (멱등성 확인)
 */
export const findPaymentByTossKey = async (tossPaymentKey) => {
  const [rows] = await pool.execute(
    `SELECT payment_id, user_id, target_type, target_id,
            toss_payment_key, toss_order_id, amount_krw, status,
            paid_at, canceled_at, cancel_reason, fail_reason,
            created_at, updated_at
     FROM payments
     WHERE toss_payment_key = ? AND deleted_at IS NULL`,
    [tossPaymentKey]
  )
  return rows[0] ?? null
}

/**
 * toss_order_id로 조회 (승인 콜백 매핑용)
 */
export const findPaymentByOrderId = async (tossOrderId) => {
  const [rows] = await pool.execute(
    `SELECT payment_id, user_id, target_type, target_id,
            toss_payment_key, toss_order_id, amount_krw, status,
            paid_at, canceled_at, cancel_reason, fail_reason,
            created_at, updated_at
     FROM payments
     WHERE toss_order_id = ? AND deleted_at IS NULL`,
    [tossOrderId]
  )
  return rows[0] ?? null
}

/**
 * 결제 완료 처리: status='done', toss_payment_key, paid_at 업데이트
 */
export const updatePaymentDone = async (paymentId, { tossPaymentKey, paidAt }) => {
  await pool.execute(
    `UPDATE payments
     SET status = 'done',
         toss_payment_key = ?,
         paid_at = ?,
         updated_at = NOW()
     WHERE payment_id = ? AND deleted_at IS NULL`,
    [tossPaymentKey, paidAt ?? new Date(), paymentId]
  )
  return findPaymentById(paymentId)
}

/**
 * 결제 실패 처리: status='failed', fail_reason 업데이트
 */
export const updatePaymentFailed = async (paymentId, { failReason }) => {
  await pool.execute(
    `UPDATE payments
     SET status = 'failed',
         fail_reason = ?,
         updated_at = NOW()
     WHERE payment_id = ? AND deleted_at IS NULL`,
    [failReason ?? '결제 실패', paymentId]
  )
  return findPaymentById(paymentId)
}

/**
 * 결제 취소 처리: status='canceled', cancel_reason, canceled_at 업데이트
 */
export const updatePaymentCanceled = async (paymentId, { cancelReason }) => {
  await pool.execute(
    `UPDATE payments
     SET status = 'canceled',
         cancel_reason = ?,
         canceled_at = NOW(),
         updated_at = NOW()
     WHERE payment_id = ? AND deleted_at IS NULL`,
    [cancelReason ?? '사용자 취소', paymentId]
  )
  return findPaymentById(paymentId)
}
