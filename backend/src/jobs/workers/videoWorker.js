import { Worker } from 'bullmq'
import { v4 as uuidv4 } from 'uuid'
import redis from '../../config/redis.js'
import pool from '../../config/db.js'

const QUEUE_NAME = 'videoGenerate'
const AI_MOCK = process.env.AI_MOCK === 'true'

// ─── DB 헬퍼 ─────────────────────────────────────────────────────────────────

const updateAiJob = async (bullmqJobId, fields) => {
  const ALLOWED = ['job_status', 'progress', 'result_url', 'error_message', 'started_at', 'completed_at']
  const entries = Object.entries(fields).filter(([k]) => ALLOWED.includes(k))
  if (!entries.length) return

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), bullmqJobId]

  await pool.query(
    `UPDATE ai_jobs SET ${setClauses}, updated_at = NOW() WHERE bullmq_job_id = ?`,
    values,
  )
}

const updateWill = async (willId, fields) => {
  const ALLOWED = [
    'status',
    'result_video_s3_key_encrypted',
    'result_video_kms_key_id',
  ]
  const entries = Object.entries(fields).filter(([k]) => ALLOWED.includes(k))
  if (!entries.length) return

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), willId]

  await pool.query(
    `UPDATE wills SET ${setClauses}, updated_at = NOW() WHERE will_id = ?`,
    values,
  )
}

const insertNotification = async ({ userId, type, referenceId }) => {
  const notifId = uuidv4()
  await pool.query(
    `INSERT INTO notifications
       (notification_id, user_id, notification_type, target_type, target_id,
        title, message, is_read)
     VALUES (?, ?, ?, 'will', ?, ?, ?, 0)`,
    [notifId, userId, type, referenceId ?? null, '유언 영상 생성 완료', '유언 영상 AI 생성이 완료되었습니다.'],
  )
}

// ─── AI 처리 로직 ─────────────────────────────────────────────────────────────

const processVideoGenerate = async (jobData, bullmqJobId) => {
  const { willId, userId } = jobData

  // 1. ai_jobs: running
  await updateAiJob(bullmqJobId, {
    job_status: 'running',
    started_at: new Date(),
  })

  // 2. wills: active (처리 중)
  await updateWill(willId, { status: 'active' })

  // 3. AI 영상 생성 (mock or 실제)
  let resultVideoS3KeyEncrypted
  let resultVideoKmsKeyId

  if (AI_MOCK) {
    const mockVideoKey = `wills/${userId}/${willId}/video_result_${Date.now()}.mp4`
    // mock: 실제 KMS 암호화 사용 — getWatchUrl의 decryptBuffer와 호환성 보장
    const { encryptString } = await import('../../utils/kms.js')
    const { encrypted, kmsKeyId } = await encryptString(mockVideoKey)
    resultVideoS3KeyEncrypted = encrypted.toString('base64')
    resultVideoKmsKeyId = kmsKeyId
  } else {
    // TODO: D-ID API 호출 + S3 업로드 + KMS 암호화 실제 구현
    // const { encryptString } = await import('../../utils/kms.js')
    // const videoS3Key = `wills/${userId}/${willId}/video_result.mp4`
    // const { encrypted, kmsKeyId } = await encryptString(videoS3Key)
    // resultVideoS3KeyEncrypted = encrypted.toString('base64')
    // resultVideoKmsKeyId = kmsKeyId
    throw new Error('실제 D-ID API 미구현 — AI_MOCK=true 환경변수 설정 필요')
  }

  // 4. wills: 결과 저장 (KMS 암호화된 S3 키)
  await updateWill(willId, {
    result_video_s3_key_encrypted: resultVideoS3KeyEncrypted,
    result_video_kms_key_id: resultVideoKmsKeyId,
  })

  // 5. ai_jobs: completed
  await updateAiJob(bullmqJobId, {
    job_status: 'completed',
    progress: 100,
    completed_at: new Date(),
  })

  // 6. notifications — 유언 영상 생성 완료 (보관 상태 알림, 공개는 아님)
  await insertNotification({
    userId,
    type: 'will_video_ready',
    referenceId: willId,
  })
}

// ─── 워커 등록 ────────────────────────────────────────────────────────────────

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    await processVideoGenerate(job.data, String(job.id))
  },
  {
    connection: redis,
    concurrency: Number(process.env.VIDEO_WORKER_CONCURRENCY) || 1,
    stalledInterval: 30000,
  },
)

worker.on('completed', (job) => {
  console.error(`[videoWorker] job ${job.id} completed`)
})

// 최대 재시도 소진 후에만 DB 상태를 failed로 확정
// videoWorker는 실패 시 wills.status를 draft로 복원
worker.on('failed', async (job, err) => {
  const maxAttempts = job?.opts?.attempts ?? 1
  console.error(`[videoWorker] job ${job?.id} failed (attempt ${job?.attemptsMade}/${maxAttempts}):`, err.message)

  if (!job || job.attemptsMade < maxAttempts) return

  const { willId } = job.data

  await updateAiJob(String(job.id), {
    job_status: 'failed',
    error_message: err.message,
    completed_at: new Date(),
  }).catch((dbErr) => console.error('[videoWorker] ai_jobs failed 업데이트 오류:', dbErr.message))

  // wills.status를 draft로 복원 (사용자가 재시도 가능하도록)
  await updateWill(willId, { status: 'draft' })
    .catch((dbErr) => console.error('[videoWorker] wills draft 복원 오류:', dbErr.message))
})

worker.on('error', (err) => {
  console.error('[videoWorker] worker error:', err.message)
})

export default worker
