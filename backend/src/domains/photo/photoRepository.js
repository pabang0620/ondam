import { v4 as uuidv4 } from 'uuid'
import pool from '../../config/db.js'

// ─── user_consents (동의 확인 전용) ────────────────────────────────────────────
// willRepository.findVoiceConsent와 동일한 패턴 - user_consents는 append-only이므로
// (마이그레이션 2026-08-23-consent-history-and-evidence) 최신 상태는
// `ORDER BY agreed_at DESC, id DESC LIMIT 1`로 조회한다.
// [2026-08-23] frontend/src/components/consent/consentItems.js의 PHOTO_CONSENT_ITEMS
// (다른 에이전트가 병행 작업 중인 사진관 동의 화면)를 확인한 결과 portrait와
// ai_generation 둘 다 "(필수)"로 요구한다 - "업로드한 사진 속 얼굴이 AI 사진
// 보정·합성에 활용"(portrait) + "AI가 생성한 사진이 온담 서비스 내에 보관"
// (ai_generation). 프론트가 두 항목을 함께 수집하므로 서버도 둘 다 검사한다.

/**
 * (user_id, consent_type) 최신 동의 이력 1건 조회 - 아래 findXConsent 함수들의
 * 내부 공용 구현(이 파일 안에서만 쓰는 지역 헬퍼, willRepository.js의 동일 패턴 참고).
 */
const findConsentByType = async (userId, consentType) => {
  const [rows] = await pool.execute(
    `SELECT consent_id, is_agreed, agreed_at
     FROM user_consents
     WHERE user_id = ? AND consent_type = ?
     ORDER BY agreed_at DESC, id DESC
     LIMIT 1`,
    [userId, consentType],
  )
  return rows[0] ?? null
}

/**
 * 초상권 동의 여부 확인 - photoService.createOrder/startProcessing이 사용
 * (사진 주문·AI 처리는 사람의 얼굴 사진을 AI로 처리하는 행위)
 * @param {string} userId
 * @returns {Promise<{ is_agreed: number, agreed_at: Date }|null>} 최신 동의 row, 없으면 null
 */
export const findPortraitConsent = (userId) => findConsentByType(userId, 'portrait')

/**
 * AI 생성물 이용 동의 여부 확인 - photoService.createOrder/startProcessing이 사용
 * (AI가 생성한 결과 사진이 계정에 보관됨)
 * @param {string} userId
 */
export const findAiGenerationConsent = (userId) => findConsentByType(userId, 'ai_generation')

// ─── photo_orders ────────────────────────────────────────────────────────────

export const createOrder = async ({ orderId, userId, photoType, priceKrw, sourceImageUrl }) => {
  const [result] = await pool.query(
    `INSERT INTO photo_orders (order_id, user_id, photo_type, price_krw, source_image_url, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending_payment', NOW(), NOW())`,
    [orderId, userId, photoType, priceKrw, sourceImageUrl ?? null],
  )
  return result
}

export const findOrderById = async (orderId) => {
  const [rows] = await pool.query(
    `SELECT * FROM photo_orders
     WHERE order_id = ? AND deleted_at IS NULL`,
    [orderId],
  )
  return rows[0] ?? null
}

export const findOrdersByUserId = async (userId, { limit, offset }) => {
  const [rows] = await pool.query(
    `SELECT * FROM photo_orders
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset],
  )
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM photo_orders
     WHERE user_id = ? AND deleted_at IS NULL`,
    [userId],
  )
  return { orders: rows, total }
}

/**
 * 주문 상태 변경 + 로그 INSERT (트랜잭션)
 */
export const updateOrderStatus = async (
  orderId,
  { prevStatus, nextStatus, changedBy, changedByType, reason },
) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    await conn.query(
      `UPDATE photo_orders
       SET status = ?, updated_at = NOW()
       WHERE order_id = ? AND deleted_at IS NULL`,
      [nextStatus, orderId],
    )

    await conn.query(
      `INSERT INTO photo_order_logs
         (log_id, order_id, prev_status, next_status, changed_by, changed_by_type, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), orderId, prevStatus, nextStatus, changedBy, changedByType, reason ?? null],
    )

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// ─── photo_files ─────────────────────────────────────────────────────────────

// [2026-08-22 컷오버] photoWorker.js의 insertPhotoFile과 INSERT 대상 컬럼이 동일한
// 곳 - variant를 한쪽만 고치면 drift가 생기므로 함께 추가한다.
export const savePhotoFile = async ({
  fileId,
  orderId,
  kind,
  variant,
  fileUrl,
  s3Key,
  mimeType,
  fileSize,
}) => {
  const [result] = await pool.query(
    `INSERT INTO photo_files
       (file_id, order_id, kind, variant, file_url, s3_key, mime_type, file_size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [fileId, orderId, kind, variant ?? null, fileUrl, s3Key, mimeType, fileSize ?? null],
  )
  return result
}

export const findFilesByOrderId = async (orderId) => {
  const [rows] = await pool.query(
    `SELECT * FROM photo_files
     WHERE order_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [orderId],
  )
  return rows
}

// ─── ai_jobs ─────────────────────────────────────────────────────────────────

export const createAiJob = async ({ jobId, userId, bullmqJobId, targetId }) => {
  const [result] = await pool.query(
    `INSERT INTO ai_jobs
       (job_id, user_id, job_type, job_status, progress, bullmq_job_id,
        queue_name, target_type, target_id, retry_cnt, created_at, updated_at)
     VALUES (?, ?, 'photo_enhance', 'queued', 0, ?, 'photo', 'photo_order', ?, 0, NOW(), NOW())`,
    [jobId, userId, bullmqJobId, targetId],
  )
  return result
}

/**
 * ai_jobs 상태 업데이트 - willRepository.updateAiJob 과 동일한 인터페이스
 * updates 허용 키: job_status, progress, result_url, error_message, bullmq_job_id
 */
export const updateAiJob = async (jobId, updates) => {
  const AI_JOB_UPDATABLE = ['job_status', 'progress', 'result_url', 'error_message', 'bullmq_job_id']
  const entries = Object.entries(updates).filter(([k]) => AI_JOB_UPDATABLE.includes(k))
  if (entries.length === 0) return

  const fields = entries.map(([k]) => `${k} = ?`)
  const values = entries.map(([, v]) => v)

  fields.push('updated_at = NOW()')

  const status = updates.job_status
  if (status === 'running') {
    fields.push('started_at = COALESCE(started_at, NOW())')
  }
  if (status === 'completed' || status === 'failed') {
    fields.push('completed_at = NOW()')
  }

  values.push(jobId)
  await pool.query(
    `UPDATE ai_jobs SET ${fields.join(', ')} WHERE job_id = ? AND deleted_at IS NULL`,
    values,
  )
}

export const findAiJobByTargetId = async (targetId) => {
  const [rows] = await pool.query(
    `SELECT * FROM ai_jobs
     WHERE target_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [targetId],
  )
  return rows[0] ?? null
}
