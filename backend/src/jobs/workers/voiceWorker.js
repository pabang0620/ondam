import { Worker } from 'bullmq'
import { v4 as uuidv4 } from 'uuid'
import redis from '../../config/redis.js'
import pool from '../../config/db.js'

const QUEUE_NAME = 'voiceClone'
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

const updateVoiceSample = async (voiceSampleId, fields) => {
  const ALLOWED = ['clone_status', 'elevenlabs_voice_id']
  const entries = Object.entries(fields).filter(([k]) => ALLOWED.includes(k))
  if (!entries.length) return

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), voiceSampleId]

  await pool.query(
    `UPDATE voice_samples SET ${setClauses}, updated_at = NOW() WHERE voice_sample_id = ?`,
    values,
  )
}

// ─── AI 처리 로직 ─────────────────────────────────────────────────────────────

const processVoiceClone = async (jobData, bullmqJobId) => {
  const { voiceSampleId, s3KeyEncrypted, kmsKeyId } = jobData

  // 1. ai_jobs: running
  await updateAiJob(bullmqJobId, {
    job_status: 'running',
    started_at: new Date(),
  })

  // 2. voice_samples: processing
  await updateVoiceSample(voiceSampleId, { clone_status: 'processing' })

  // 3. KMS 복호화 + 음성 처리
  let elevenlabsVoiceId
  if (AI_MOCK) {
    // mock: ElevenLabs voice ID 생성
    elevenlabsVoiceId = `mock_voice_${uuidv4().replace(/-/g, '').slice(0, 16)}`
  } else {
    // TODO: KMS decrypt → S3 다운로드 → ElevenLabs API 호출 실제 구현
    // const { decryptBuffer } = await import('../../utils/kms.js')
    // const encryptedBuf = Buffer.from(s3KeyEncrypted, 'base64')
    // const s3Key = await decryptBuffer(encryptedBuf)
    // ... S3 다운로드 + ElevenLabs API 호출
    throw new Error('실제 ElevenLabs API 미구현 — AI_MOCK=true 환경변수 설정 필요')
  }

  // 4. voice_samples: ready
  await updateVoiceSample(voiceSampleId, {
    clone_status: 'ready',
    elevenlabs_voice_id: elevenlabsVoiceId,
  })

  // 5. ai_jobs: completed
  await updateAiJob(bullmqJobId, {
    job_status: 'completed',
    progress: 100,
    completed_at: new Date(),
  })
}

// ─── 워커 등록 ────────────────────────────────────────────────────────────────

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    await processVoiceClone(job.data, String(job.id))
  },
  {
    connection: redis,
    concurrency: Number(process.env.VOICE_WORKER_CONCURRENCY) || 2,
    stalledInterval: 30000,
  },
)

worker.on('completed', (job) => {
  console.error(`[voiceWorker] job ${job.id} completed`)
})

// 최대 재시도 소진 후에만 DB 상태를 failed로 확정
worker.on('failed', async (job, err) => {
  const maxAttempts = job?.opts?.attempts ?? 1
  console.error(`[voiceWorker] job ${job?.id} failed (attempt ${job?.attemptsMade}/${maxAttempts}):`, err.message)

  if (!job || job.attemptsMade < maxAttempts) return

  const { voiceSampleId } = job.data

  await updateAiJob(String(job.id), {
    job_status: 'failed',
    error_message: err.message,
    completed_at: new Date(),
  }).catch((dbErr) => console.error('[voiceWorker] ai_jobs failed 업데이트 오류:', dbErr.message))

  await updateVoiceSample(voiceSampleId, {
    clone_status: 'failed',
  }).catch((dbErr) => console.error('[voiceWorker] voice_samples failed 업데이트 오류:', dbErr.message))
})

worker.on('error', (err) => {
  console.error('[voiceWorker] worker error:', err.message)
})

export default worker
