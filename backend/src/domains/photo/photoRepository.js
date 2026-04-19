import { v4 as uuidv4 } from 'uuid'
import pool from '../../config/db.js'

// ─── photo_orders ────────────────────────────────────────────────────────────

export const createOrder = async ({ orderId, userId, photoType, priceKrw }) => {
  const [result] = await pool.query(
    `INSERT INTO photo_orders (order_id, user_id, photo_type, price_krw, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending_payment', NOW(), NOW())`,
    [orderId, userId, photoType, priceKrw],
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

export const savePhotoFile = async ({
  fileId,
  orderId,
  kind,
  fileUrl,
  s3Key,
  mimeType,
  fileSize,
}) => {
  const [result] = await pool.query(
    `INSERT INTO photo_files
       (file_id, order_id, kind, file_url, s3_key, mime_type, file_size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [fileId, orderId, kind, fileUrl, s3Key, mimeType, fileSize ?? null],
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
 * ai_jobs 상태 업데이트 — willRepository.updateAiJob 과 동일한 인터페이스
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
