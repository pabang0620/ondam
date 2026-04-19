import { Worker } from 'bullmq'
import { v4 as uuidv4 } from 'uuid'
import redis from '../../config/redis.js'
import pool from '../../config/db.js'

const QUEUE_NAME = 'photo'
const AI_MOCK = process.env.AI_MOCK === 'true'

// ─── DB 헬퍼 ─────────────────────────────────────────────────────────────────

const updateAiJob = async (jobId, fields) => {
  const ALLOWED = ['job_status', 'progress', 'result_url', 'error_message', 'started_at', 'completed_at']
  const entries = Object.entries(fields).filter(([k]) => ALLOWED.includes(k))
  if (!entries.length) return

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), jobId]

  await pool.query(
    `UPDATE ai_jobs SET ${setClauses}, updated_at = NOW() WHERE bullmq_job_id = ?`,
    values,
  )
}

const updatePhotoOrder = async (orderId, fields) => {
  const ALLOWED = ['status', 'completed_at', 'fail_reason']
  const entries = Object.entries(fields).filter(([k]) => ALLOWED.includes(k))
  if (!entries.length) return

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), orderId]

  await pool.query(
    `UPDATE photo_orders SET ${setClauses}, updated_at = NOW() WHERE order_id = ?`,
    values,
  )
}

const insertPhotoFile = async ({ fileId, orderId, kind, fileUrl, s3Key }) => {
  await pool.query(
    `INSERT INTO photo_files (file_id, order_id, kind, file_url, s3_key, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [fileId, orderId, kind, fileUrl, s3Key],
  )
}

const insertNotification = async ({ userId, type, referenceId }) => {
  const notifId = uuidv4()
  await pool.query(
    `INSERT INTO notifications
       (notification_id, user_id, notification_type, target_type, target_id,
        title, message, is_read)
     VALUES (?, ?, ?, 'photo_order', ?, '사진 처리 완료', '사진 AI 처리가 완료되었습니다.', 0)`,
    [notifId, userId, type, referenceId ?? null],
  )
}

// ─── AI 처리 로직 ─────────────────────────────────────────────────────────────

const processPhoto = async (jobData, bullmqJobId) => {
  const { orderId, userId, photoType } = jobData

  // 1. ai_jobs: running
  await updateAiJob(bullmqJobId, {
    job_status: 'running',
    started_at: new Date(),
  })

  // 2. photo_orders: processing
  await updatePhotoOrder(orderId, { status: 'processing' })

  // 3. AI 처리 (mock or 실제)
  let resultUrl
  if (AI_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    resultUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/photos/${userId}/${orderId}/result_${photoType}.jpg`
  } else {
    // TODO: remove.bg API 호출 + S3 업로드 실제 구현
    throw new Error('실제 AI API 미구현 — AI_MOCK=true 환경변수 설정 필요')
  }

  const resultS3Key = `photos/${userId}/${orderId}/result_${photoType}.jpg`

  // 4. photo_files INSERT (결과물)
  await insertPhotoFile({
    fileId: uuidv4(),
    orderId,
    kind: 'enhanced',
    fileUrl: resultUrl,
    s3Key: resultS3Key,
  })

  // 5. ai_jobs: completed
  await updateAiJob(bullmqJobId, {
    job_status: 'completed',
    progress: 100,
    result_url: resultUrl,
    completed_at: new Date(),
  })

  // 6. photo_orders: completed
  await updatePhotoOrder(orderId, {
    status: 'completed',
    completed_at: new Date(),
  })

  // 7. notifications INSERT
  await insertNotification({
    userId,
    type: 'photo_complete',
    referenceId: orderId,
  })
}

// ─── 워커 등록 ────────────────────────────────────────────────────────────────

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    await processPhoto(job.data, String(job.id))
  },
  {
    connection: redis,
    concurrency: Number(process.env.PHOTO_WORKER_CONCURRENCY) || 3,
    stalledInterval: 30000,
  },
)

worker.on('completed', (job) => {
  console.error(`[photoWorker] job ${job.id} completed`)
})

// 최대 재시도 소진 후에만 DB 상태를 failed로 확정
worker.on('failed', async (job, err) => {
  const maxAttempts = job?.opts?.attempts ?? 1
  console.error(`[photoWorker] job ${job?.id} failed (attempt ${job?.attemptsMade}/${maxAttempts}):`, err.message)

  if (!job || job.attemptsMade < maxAttempts) return

  const { orderId } = job.data

  await updateAiJob(String(job.id), {
    job_status: 'failed',
    error_message: err.message,
    completed_at: new Date(),
  }).catch((dbErr) => console.error('[photoWorker] ai_jobs failed 업데이트 오류:', dbErr.message))

  await updatePhotoOrder(orderId, {
    status: 'failed',
    fail_reason: err.message,
  }).catch((dbErr) => console.error('[photoWorker] photo_orders failed 업데이트 오류:', dbErr.message))
})

worker.on('error', (err) => {
  console.error('[photoWorker] worker error:', err.message)
})

export default worker
