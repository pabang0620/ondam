/**
 * Gift Repository - DB(gift_orders/gift_order_logs) + Redis(수행자 본인확인 시도/잠금)
 * 접근 전용
 *
 * 확정 스키마(ondam_schema.sql, db-schema-architect 통합 완료 - 코디네이터 확정 공유):
 *   gift_orders(id, gift_id CHAR(36) UNIQUE, giver_user_id, product_type ENUM('photo','will'),
 *     payment_id CHAR(36) NULL COMMENT '결제 준비 단계에서는 NULL 가능', recipient_name,
 *     recipient_phone, perform_token_hash CHAR(64) UNIQUE NOT NULL, token_expires_at DATETIME
 *     NOT NULL, status ENUM('paid','link_sent','opened','in_progress','completed','declined',
 *     'refunded','expired') NOT NULL DEFAULT 'paid', recipient_user_id NULL, created_at,
 *     updated_at, deleted_at)
 *   gift_order_logs(id, log_id CHAR(36) UNIQUE, gift_id, prev_status, next_status,
 *     changed_by CHAR(36) NULL, changed_by_type ENUM('user','admin','system'), reason,
 *     created_at)
 *
 * 결제 연동 설계 결정(완료 보고 2절 참고):
 * gift_orders는 photo_orders(pending_payment)/wills(draft)와 달리 "결제 전" 상태를
 * status ENUM에 별도로 두지 않는다(DEFAULT가 이미 'paid'). 스키마의 실제 신호는
 * `payment_id` 컬럼이다 - NULL이면 "결제 대기"(결제 준비는 됐지만 아직 완료 안 됨),
 * NOT NULL이면 결제가 실제로 연결된 것이다. 그래서:
 *   1) POST /api/gifts 시점에 gift_orders 행을 payment_id=NULL로 먼저 INSERT한다
 *      (perform_token_hash/token_expires_at은 NOT NULL이라 이 시점에 함께 발급 -
 *      단 수행 가능 여부 게이트는 payment_id NOT NULL을 반드시 함께 확인한다).
 *   2) paymentService.preparePayment의 _resolveServerPrice('gift_order' 분기)는
 *      giver_user_id 소유권 + payment_id IS NULL(아직 결제 안 붙음)을 게이트로 쓴다.
 *   3) paymentService.confirmPayment 성공 시 _updateTargetStatus('gift_order' 분기)가
 *      attachPayment()로 payment_id를 채우고 status를 'link_sent'로 전이한다.
 * gift 생성(giftService.createGiftOrder)은 이 INSERT 이후 paymentService.preparePayment를
 * 별도 트랜잭션으로 순차 호출한다(단일 트랜잭션으로 묶지 않음) - preparePayment가
 * 실패해도 gift_orders 행은 "결제 대기"(payment_id NULL) 상태로 정직하게 남을 뿐,
 * 거짓으로 완료된 것처럼 보이는 상태가 아니므로 G4가 우려하는 "일부만 커밋된 완료
 * 상태"에 해당하지 않는다(완료 보고에 근거 명시).
 */

import { v4 as uuidv4 } from 'uuid'
import pool from '../../config/db.js'
import redis from '../../config/redis.js'

// ─── 가격 정본 (photo=photoService.js:12, will=willService.js:50 과 동일 정책값) ──────
// 선물 결제 시점에는 실제 photo_orders/wills 레코드가 아직 없어(수행자가 나중에 만든다)
// 거기서 가격을 조회할 수 없다. 이 정적 맵이 gift 결제의 가격 정본이다(G3) - 클라이언트
// 입력을 받지 않고 서버가 product_type만으로 금액을 확정한다.
export const GIFT_PRICE_KRW = {
  photo: 9900,
  will: 49000,
}

// 수행 링크 유효기간 - SPEC-01 4-1 "발급 후 90일"
export const GIFT_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000

// ─── Redis: 수행자 본인확인 시도/잠금 (will watch-verify와 동일 패턴, 5회/24시간) ──────
export const VERIFY_MAX_ATTEMPTS = 5
const VERIFY_LOCK_TTL_SEC = 24 * 60 * 60
const VERIFY_ATTEMPTS_TTL_SEC = 24 * 60 * 60
// 본인확인 통과 후 "계정 연결/가입" 단계까지 재확인 없이 진행할 수 있는 유예 시간
const VERIFIED_TTL_SEC = 20 * 60

const attemptsKey = (token) => `gift:perform:attempts:${token}`
const lockKey = (token) => `gift:perform:locked:${token}`
const verifiedKey = (token) => `gift:perform:verified:${token}`

export const isLocked = async (token) => Boolean(await redis.get(lockKey(token)))

export const incrAttempts = async (token) => {
  const attempts = await redis.incr(attemptsKey(token))
  if (attempts === 1) await redis.expire(attemptsKey(token), VERIFY_ATTEMPTS_TTL_SEC)
  return attempts
}

export const resetAttempts = async (token) => redis.del(attemptsKey(token))

export const setLocked = async (token) => redis.set(lockKey(token), '1', 'EX', VERIFY_LOCK_TTL_SEC)

export const markVerified = async (token) => redis.set(verifiedKey(token), '1', 'EX', VERIFIED_TTL_SEC)

export const isVerified = async (token) => Boolean(await redis.get(verifiedKey(token)))

export const clearVerified = async (token) => redis.del(verifiedKey(token))

// ─── gift_orders ──────────────────────────────────────────────────────────────

const GIFT_ORDER_COLS = `
  gift_id, giver_user_id, product_type, payment_id, recipient_name, recipient_phone,
  token_expires_at, status, recipient_user_id, photo_order_id, will_id, created_at, updated_at
`

/**
 * 선물 주문 생성 - "결제 대기" 상태(payment_id=NULL)로 최초 INSERT
 * perform_token_hash/token_expires_at은 NOT NULL이라 이 시점에 함께 발급한다.
 * 수행 가능 여부는 이 행의 존재가 아니라 payment_id NOT NULL로 별도 게이트한다.
 */
export const insertGiftOrder = async ({
  giftId,
  giverUserId,
  productType,
  recipientName,
  recipientPhone,
  performTokenHash,
  tokenExpiresAt,
}) => {
  await pool.execute(
    `INSERT INTO gift_orders
       (gift_id, giver_user_id, product_type, payment_id, recipient_name, recipient_phone,
        perform_token_hash, token_expires_at, status, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'paid', NOW(), NOW())`,
    [giftId, giverUserId, productType, recipientName, recipientPhone, performTokenHash, tokenExpiresAt],
  )
}

export const findByGiftId = async (giftId) => {
  const [rows] = await pool.execute(
    `SELECT id, ${GIFT_ORDER_COLS} FROM gift_orders WHERE gift_id = ? AND deleted_at IS NULL`,
    [giftId],
  )
  return rows[0] ?? null
}

export const findByGiftIdForUpdate = async (conn, giftId) => {
  const [rows] = await conn.execute(
    `SELECT id, ${GIFT_ORDER_COLS} FROM gift_orders WHERE gift_id = ? AND deleted_at IS NULL FOR UPDATE`,
    [giftId],
  )
  return rows[0] ?? null
}

/**
 * perform_token_hash로 조회 - 무인증 수행 링크 진입점
 */
export const findByPerformTokenHash = async (hash) => {
  const [rows] = await pool.execute(
    `SELECT id, ${GIFT_ORDER_COLS} FROM gift_orders WHERE perform_token_hash = ? AND deleted_at IS NULL`,
    [hash],
  )
  return rows[0] ?? null
}

export const findGiftsByGiverUserId = async (giverUserId, { limit, offset }) => {
  const [rows] = await pool.execute(
    `SELECT id, ${GIFT_ORDER_COLS} FROM gift_orders
     WHERE giver_user_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [giverUserId, limit, offset],
  )
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM gift_orders WHERE giver_user_id = ? AND deleted_at IS NULL`,
    [giverUserId],
  )
  return { gifts: rows, total }
}

/**
 * 결제 확정 시 payment_id를 채우고 link_sent로 전이 (paymentService._updateTargetStatus가
 * 결제 트랜잭션 커넥션을 넘겨 원자적으로 실행 - G4). WHERE절의 payment_id IS NULL이
 * claim(선점) 가드 역할을 해 중복 attach를 막는다(멱등).
 * @returns {Promise<boolean>} 실제로 이 호출에서 전이가 일어났으면 true(최초 1회),
 *   이미 붙어있었으면 false(멱등 재호출)
 */
export const attachPayment = async (giftId, paymentId, conn) => {
  const executor = conn ?? pool
  const [result] = await executor.execute(
    `UPDATE gift_orders SET payment_id = ?, status = 'link_sent', updated_at = NOW()
     WHERE gift_id = ? AND payment_id IS NULL AND deleted_at IS NULL`,
    [paymentId, giftId],
  )
  return result.affectedRows > 0
}

/**
 * 상태 전이 (트랜잭션 conn 선택적 참여 - G4-3)
 */
export const updateStatus = async (giftId, status, conn) => {
  const executor = conn ?? pool
  await executor.execute(
    `UPDATE gift_orders SET status = ?, updated_at = NOW() WHERE gift_id = ? AND deleted_at IS NULL`,
    [status, giftId],
  )
}

/**
 * 4-3: 기존/신규 계정을 수행자(recipient)로 연결
 */
export const updateRecipientUserId = async (giftId, recipientUserId) => {
  await pool.execute(
    `UPDATE gift_orders SET recipient_user_id = ?, updated_at = NOW()
     WHERE gift_id = ? AND deleted_at IS NULL`,
    [recipientUserId, giftId],
  )
}

/**
 * 4-1: 링크 재발급 - 새 토큰 해시로 교체하고 상태를 link_sent로 되돌린다
 * (완료/거절/환불 등 종결 상태에서는 giftService가 사전에 막는다)
 */
export const reissueToken = async (giftId, { performTokenHash, tokenExpiresAt }) => {
  await pool.execute(
    `UPDATE gift_orders
     SET perform_token_hash = ?, token_expires_at = ?, status = 'link_sent', updated_at = NOW()
     WHERE gift_id = ? AND deleted_at IS NULL`,
    [performTokenHash, tokenExpiresAt, giftId],
  )
}

/**
 * gift ↔ photo_orders 연결 영속화 (완료 보고 1절 - 기존에는 attach-photo-order가
 * 소유권만 검증하고 저장하지 않던 공백). WHERE절의 "IS NULL OR = orderId"가 멱등
 * 가드 - 같은 orderId로 재시도하면 계속 성공(affectedRows>0)하고, 이미 다른 orderId가
 * 채워진 상태에서 다른 값으로 부르면 WHERE에 걸려 0행 - 호출자(giftPerformService)가
 * 이 경우를 사전에 gift.photo_order_id 비교로 걸러 409를 던진다(멱등 판정은 서비스
 * 레이어 책임, 여기는 원자적 쓰기만 담당).
 */
export const setPhotoOrderId = async (giftId, orderId) => {
  const [result] = await pool.execute(
    `UPDATE gift_orders SET photo_order_id = ?, updated_at = NOW()
     WHERE gift_id = ? AND (photo_order_id IS NULL OR photo_order_id = ?) AND deleted_at IS NULL`,
    [orderId, giftId, orderId],
  )
  return result.affectedRows > 0
}

/**
 * gift ↔ wills 연결 영속화 (setPhotoOrderId와 동일 패턴)
 */
export const setWillId = async (giftId, willId) => {
  const [result] = await pool.execute(
    `UPDATE gift_orders SET will_id = ?, updated_at = NOW()
     WHERE gift_id = ? AND (will_id IS NULL OR will_id = ?) AND deleted_at IS NULL`,
    [willId, giftId, willId],
  )
  return result.affectedRows > 0
}

/**
 * 역조회 - AI 처리 실패 시 photoWorker/videoWorker가 target_type='photo_order'/
 * 'will_order' 경로로 결제를 못 찾았을 때(no_completed_payment), 이 콘텐츠가 선물로
 * 결제된 것인지 확인하는 용도 (완료 보고 2절)
 */
export const findByPhotoOrderId = async (orderId) => {
  const [rows] = await pool.execute(
    `SELECT id, ${GIFT_ORDER_COLS} FROM gift_orders WHERE photo_order_id = ? AND deleted_at IS NULL`,
    [orderId],
  )
  return rows[0] ?? null
}

export const findByWillId = async (willId) => {
  const [rows] = await pool.execute(
    `SELECT id, ${GIFT_ORDER_COLS} FROM gift_orders WHERE will_id = ? AND deleted_at IS NULL`,
    [willId],
  )
  return rows[0] ?? null
}

// ─── 미수행 리마인드 (SPEC-01 3-3/4-6, PK 커서 배치 - LIMIT/OFFSET 금지) ────────────

/**
 * 아직 종결되지 않았고(link_sent/opened/in_progress) 토큰이 아직 살아있는 선물을
 * PK 커서로 스캔한다. willRepository.findReminderCandidatesBatch와 동일 패턴.
 */
export const findActiveReminderCandidatesBatch = async ({ cursorId, batchSize }) => {
  const [rows] = await pool.execute(
    `SELECT id, ${GIFT_ORDER_COLS} FROM gift_orders
     WHERE id > ?
       AND status IN ('link_sent', 'opened', 'in_progress')
       AND token_expires_at > NOW()
       AND deleted_at IS NULL
     ORDER BY id ASC
     LIMIT ?`,
    [cursorId, batchSize],
  )
  return rows
}

/**
 * 토큰이 이미 만료됐는데도 아직 종결 상태로 전이되지 않은 선물 (4-6 자동 만료 처리
 * 대상) - getPerformInfo의 지연 전이(수행자가 링크를 다시 열어야만 발생)와 달리,
 * 아무도 링크를 열지 않아도 리마인드 워커가 능동적으로 스캔해 전이시킨다.
 */
export const findExpiredCandidatesBatch = async ({ cursorId, batchSize }) => {
  const [rows] = await pool.execute(
    `SELECT id, ${GIFT_ORDER_COLS} FROM gift_orders
     WHERE id > ?
       AND status IN ('link_sent', 'opened', 'in_progress')
       AND token_expires_at <= NOW()
       AND deleted_at IS NULL
     ORDER BY id ASC
     LIMIT ?`,
    [cursorId, batchSize],
  )
  return rows
}

/**
 * 리마인드 1회/마일스톤 제한 판정 (willRepository.hasReminderBeenSent와 동일 사유 -
 * 스키마에 별도 컬럼을 추가하지 않고 audit_logs를 발송 이력 대장으로 재사용한다).
 * action은 마일스톤별로 다른 문자열을 써서(예: gift_reminder_recipient_30d) 같은
 * gift_id라도 마일스톤마다 독립적으로 1회 제한이 걸리게 한다.
 */
export const hasGiftReminderBeenSent = async (giftId, action) => {
  const [rows] = await pool.execute(
    `SELECT 1 FROM audit_logs WHERE target_type = 'gift_order' AND target_id = ? AND action = ? LIMIT 1`,
    [giftId, action],
  )
  return rows.length > 0
}

export const recordGiftReminderSent = async (giftId, action, detail) => {
  await pool.execute(
    `INSERT INTO audit_logs
       (log_id, actor_id, actor_type, action, target_type, target_id, detail, created_at)
     VALUES (?, ?, 'system', ?, 'gift_order', ?, ?, NOW())`,
    [uuidv4(), giftId, action, giftId, detail ? JSON.stringify(detail) : null],
  )
}

// ─── gift_order_logs ──────────────────────────────────────────────────────────

export const addLog = async ({ logId, giftId, prevStatus, nextStatus, changedBy, changedByType, reason }) => {
  await pool.execute(
    `INSERT INTO gift_order_logs
       (log_id, gift_id, prev_status, next_status, changed_by, changed_by_type, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [logId, giftId, prevStatus ?? null, nextStatus, changedBy ?? null, changedByType, reason ?? null],
  )
}
