import { Worker } from 'bullmq'
import { v4 as uuidv4 } from 'uuid'
import { File } from 'buffer'
import redis from '../../config/redis.js'
import pool from '../../config/db.js'
import { decryptBuffer } from '../../utils/kms.js'
import { downloadFromS3 } from '../../utils/s3.js'
import { getIo } from '../../config/socket.js'

const QUEUE_NAME = 'voiceClone'
const AI_MOCK = process.env.AI_MOCK === 'true'

// ─── DB 헬퍼 ─────────────────────────────────────────────────────────────────

const updateAiJob = async (bullmqJobId, fields) => {
  const ALLOWED = ['job_status', 'progress', 'result_url', 'error_message', 'started_at', 'completed_at']
  const entries = Object.entries(fields).filter(([k]) => ALLOWED.includes(k))
  if (!entries.length) return

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), bullmqJobId]

  await pool.execute(
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

  await pool.execute(
    `UPDATE voice_samples SET ${setClauses}, updated_at = NOW() WHERE voice_sample_id = ?`,
    values,
  )
}

// ─── AI 처리 로직 ─────────────────────────────────────────────────────────────

const processVoiceClone = async (jobData, bullmqJobId) => {
  const { voiceSampleId, s3KeyEncrypted, kmsKeyId, userId } = jobData

  // 1. ai_jobs: running
  await updateAiJob(bullmqJobId, {
    job_status: 'running',
    started_at: new Date(),
  })

  // 2. voice_samples: processing
  await updateVoiceSample(voiceSampleId, { clone_status: 'processing' })

  getIo()?.to(`user:${userId}`).emit('job:progress', {
    jobId: bullmqJobId,
    jobType: 'voice',
    status: 'running',
    progress: 0,
    resultUrl: null,
  })

  // 3. KMS 복호화 + 음성 처리
  let elevenlabsVoiceId
  if (AI_MOCK) {
    // mock: ElevenLabs voice ID 생성
    elevenlabsVoiceId = `mock_voice_${uuidv4().replace(/-/g, '').slice(0, 16)}`
  } else {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw Object.assign(new Error('ELEVENLABS_API_KEY 환경변수가 설정되지 않았습니다'), { status: 500 })
    }

    // KMS 복호화 → 평문 S3 키 획득
    const encryptedBuf = Buffer.from(s3KeyEncrypted, 'base64')
    const s3Key = await decryptBuffer(encryptedBuf)

    // S3에서 음성 파일 다운로드
    const audioBuffer = await downloadFromS3(s3Key)

    // ElevenLabs Voice Clone API 호출
    const formData = new FormData()
    formData.append('name', `ondam-${voiceSampleId}`)
    formData.append('description', '온담 유언장 음성 클론')
    formData.append(
      'files',
      new File([audioBuffer], `voice_${voiceSampleId}.mp3`, { type: 'audio/mpeg' }),
    )

    const cloneRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
      body: formData,
    })

    if (!cloneRes.ok) {
      const errText = await cloneRes.text()
      throw new Error(`ElevenLabs API 오류 (${cloneRes.status}): ${errText}`)
    }

    const cloneData = await cloneRes.json()
    elevenlabsVoiceId = cloneData.voice_id

    if (!elevenlabsVoiceId) {
      throw new Error('ElevenLabs API 응답에서 voice_id를 찾을 수 없습니다')
    }
  }

  // 4. voice_samples: ready
  await updateVoiceSample(voiceSampleId, {
    clone_status: 'ready',
    elevenlabs_voice_id: elevenlabsVoiceId,
  })

  // 4-1. 알림 생성 - 음성 클론 완료 (실패해도 잡 전체를 실패시키지 않음)
  const notifId = uuidv4()
  await pool.execute(
    `INSERT INTO notifications
       (notification_id, user_id, notification_type, target_type, target_id,
        title, message, is_read, created_at)
     VALUES (?, ?, 'voice_clone_complete', 'voice_sample', ?,
             '음성 클론 완료', '음성 클론이 완료되었습니다. 이제 유언 영상을 생성할 수 있습니다.', 0, NOW())`,
    [notifId, userId, voiceSampleId],
  ).catch((dbErr) => console.error('[voiceWorker] 알림 INSERT 실패:', dbErr.message))

  // 5. ai_jobs: completed
  await updateAiJob(bullmqJobId, {
    job_status: 'completed',
    progress: 100,
    completed_at: new Date(),
  })

  getIo()?.to(`user:${userId}`).emit('job:progress', {
    jobId: bullmqJobId,
    jobType: 'voice',
    status: 'completed',
    progress: 100,
    resultUrl: null,
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
  console.log(`[voiceWorker] job ${job.id} completed`)
})

// 최대 재시도 소진 후에만 DB 상태를 failed로 확정
worker.on('failed', async (job, err) => {
  const maxAttempts = job?.opts?.attempts ?? 1
  console.error(`[voiceWorker] job ${job?.id} failed (attempt ${job?.attemptsMade}/${maxAttempts}):`, err.message)

  if (!job || job.attemptsMade < maxAttempts) return

  const { voiceSampleId, userId } = job.data

  await updateAiJob(String(job.id), {
    job_status: 'failed',
    error_message: err.message,
    completed_at: new Date(),
  }).catch((dbErr) => console.error('[voiceWorker] ai_jobs failed 업데이트 오류:', dbErr.message))

  await updateVoiceSample(voiceSampleId, {
    clone_status: 'failed',
  }).catch((dbErr) => console.error('[voiceWorker] voice_samples failed 업데이트 오류:', dbErr.message))

  getIo()?.to(`user:${userId}`).emit('job:progress', {
    jobId: String(job.id),
    jobType: 'voice',
    status: 'failed',
    progress: 0,
    resultUrl: null,
  })
})

worker.on('error', (err) => {
  console.error('[voiceWorker] worker error:', err.message)
})

export default worker
