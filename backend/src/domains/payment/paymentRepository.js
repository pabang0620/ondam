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
 * target_type + target_id로 가장 최근 결제 1건 조회 (시스템 자동 환불용 -
 * paymentService.refundForAiFailure 전용). 사용자 소유권 검증 없이 대상 기준으로만
 * 찾는다 - 호출자(워커)가 이미 시스템 주체이기 때문.
 */
export const findLatestPaymentByTarget = async (targetType, targetId) => {
  const [rows] = await pool.execute(
    `SELECT payment_id, user_id, target_type, target_id,
            toss_payment_key, toss_order_id, amount_krw, status,
            paid_at, canceled_at, cancel_reason, fail_reason,
            created_at, updated_at
     FROM payments
     WHERE target_type = ? AND target_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [targetType, targetId]
  )
  return rows[0] ?? null
}

/**
 * FOR UPDATE 락을 걸어 toss_order_id로 결제 행 조회 - 트랜잭션 내에서만 사용
 * 동일 orderId에 대한 동시 confirm 요청을 직렬화하기 위한 비관적 락
 * @param {object} conn - pool.getConnection()으로 획득한 커넥션
 * @param {string} tossOrderId
 */
export const findPaymentByOrderIdForUpdate = async (conn, tossOrderId) => {
  const [rows] = await conn.execute(
    `SELECT payment_id, user_id, target_type, target_id,
            toss_payment_key, toss_order_id, amount_krw, status,
            paid_at, canceled_at, cancel_reason, fail_reason,
            created_at, updated_at
     FROM payments
     WHERE toss_order_id = ? AND deleted_at IS NULL
     FOR UPDATE`,
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
 *
 * [HIGH #3 수정] toss_payment_key를 임시값(payment_id)으로 원복한다. 원복하지
 * 않으면 confirmPayment의 선점(claim) 판정(`toss_payment_key !== payment_id`)이
 * 계속 "이미 선점됨"으로 남아, status='failed'와 맞물려 사용자가 같은 결제 건으로
 * 다시는 재시도할 수 없는 영구 데드엔드가 된다.
 */
export const updatePaymentFailed = async (paymentId, { failReason }) => {
  await pool.execute(
    `UPDATE payments
     SET status = 'failed',
         toss_payment_key = payment_id,
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
