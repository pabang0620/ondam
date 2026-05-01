import { Worker } from 'bullmq'
import { v4 as uuidv4 } from 'uuid'
import { File } from 'buffer'
import redis from '../../config/redis.js'
import pool from '../../config/db.js'
import { decryptBuffer, encryptString } from '../../utils/kms.js'
import { downloadFromS3, uploadToS3 } from '../../utils/s3.js'
import { getIo } from '../../config/socket.js'

const QUEUE_NAME = 'videoGenerate'
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

  await pool.execute(
    `UPDATE wills SET ${setClauses}, updated_at = NOW() WHERE will_id = ?`,
    values,
  )
}

const insertNotification = async ({ userId, type, referenceId }) => {
  const notifId = uuidv4()
  await pool.execute(
    `INSERT INTO notifications
       (notification_id, user_id, notification_type, target_type, target_id,
        title, message, is_read)
     VALUES (?, ?, ?, 'will', ?, ?, ?, 0)`,
    [notifId, userId, type, referenceId ?? null, '유언 영상 생성 완료', '유언 영상 AI 생성이 완료되었습니다.'],
  )
}

// ─── AI 처리 로직 ─────────────────────────────────────────────────────────────

const processVideoGenerate = async (jobData, bullmqJobId) => {
  const { willId, userId, photoS3Key, voiceS3KeyEncrypted } = jobData

  // 1. ai_jobs: running
  await updateAiJob(bullmqJobId, {
    job_status: 'running',
    started_at: new Date(),
  })

  // 2. wills: active (처리 중)
  await updateWill(willId, { status: 'active' })

  getIo()?.to(`user:${userId}`).emit('job:progress', {
    jobId: bullmqJobId,
    jobType: 'video',
    status: 'running',
    progress: 0,
    resultUrl: null,
  })

  // 3. AI 영상 생성 (mock or 실제)
  let resultVideoS3KeyEncrypted
  let resultVideoKmsKeyId

  if (AI_MOCK) {
    const mockVideoKey = `wills/${userId}/${willId}/video_result_${Date.now()}.mp4`
    // mock: 실제 KMS 암호화 사용 - getWatchUrl의 decryptBuffer와 호환성 보장
    const { encrypted, kmsKeyId } = await encryptString(mockVideoKey)
    resultVideoS3KeyEncrypted = encrypted.toString('base64')
    resultVideoKmsKeyId = kmsKeyId
  } else {
    if (!process.env.HIGGSFIELD_API_KEY) {
      throw Object.assign(new Error('HIGGSFIELD_API_KEY 환경변수가 설정되지 않았습니다'), { status: 500 })
    }

    // 사진 S3 다운로드
    const photoBuffer = await downloadFromS3(photoS3Key)

    // contentText, elevenlabsVoiceId 검증
    const { elevenlabsVoiceId, contentText } = jobData
    if (!contentText || contentText.trim().length === 0) {
      throw new Error('유언장 내용이 없습니다. 텍스트를 작성해 주세요.')
    }
    if (!elevenlabsVoiceId) {
      throw new Error('목소리 클론이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.')
    }

    // ElevenLabs TTS: 클론된 목소리로 텍스트 읽기
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenlabsVoiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: contentText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })
    if (!ttsRes.ok) {
      const errText = await ttsRes.text()
      throw new Error(`ElevenLabs TTS 오류 (${ttsRes.status}): ${errText}`)
    }
    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer())

    // Higgsfield Lipsync API 호출
    const formData = new FormData()
    formData.append('image', new File([photoBuffer], 'photo.jpg', { type: 'image/jpeg' }))
    formData.append('audio', new File([audioBuffer], 'tts_voice.mp3', { type: 'audio/mpeg' }))

    const lipsyncRes = await fetch('https://api.higgsfield.ai/v1/generations/lipsync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY}` },
      body: formData,
    })

    if (!lipsyncRes.ok) {
      const errText = await lipsyncRes.text()
      throw new Error(`Higgsfield API 오류 (${lipsyncRes.status}): ${errText}`)
    }

    const lipsyncData = await lipsyncRes.json()
    const generationId = lipsyncData.id

    if (!generationId) {
      throw new Error('Higgsfield API 응답에서 generation id를 찾을 수 없습니다')
    }

    // 완료 폴링 (최대 30회, 10초 간격 = 5분)
    let videoUrl = null
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((r) => setTimeout(r, 10000))

      const pollRes = await fetch(`https://api.higgsfield.ai/v1/generations/${generationId}`, {
        headers: { Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY}` },
      })

      if (!pollRes.ok) {
        const errText = await pollRes.text()
        throw new Error(`Higgsfield 폴링 오류 (${pollRes.status}): ${errText}`)
      }

      const pollData = await pollRes.json()

      if (pollData.status === 'completed') {
        if (!pollData.video_url) {
          throw new Error('Higgsfield completed 상태이나 video_url이 없습니다')
        }
        videoUrl = pollData.video_url
        break
      }

      if (pollData.status === 'failed') {
        throw new Error(`Higgsfield 영상 생성 실패: ${pollData.error ?? 'unknown error'}`)
      }
    }

    if (!videoUrl) {
      throw new Error('Higgsfield 영상 생성 타임아웃 (5분 초과)')
    }

    // SSRF 방어 - Higgsfield 도메인 검증
    const allowedHost = 'higgsfield.ai'
    const parsedVideoUrl = new URL(videoUrl)
    if (!parsedVideoUrl.hostname.endsWith(allowedHost)) {
      throw new Error(`허용되지 않는 영상 URL 호스트: ${parsedVideoUrl.hostname}`)
    }

    // 완성된 영상 다운로드
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) {
      throw new Error(`영상 다운로드 실패 (${videoRes.status})`)
    }
    const videoArrayBuffer = await videoRes.arrayBuffer()
    const videoBuffer = Buffer.from(videoArrayBuffer)

    // S3 업로드 (KMS 암호화)
    const videoS3Key = `wills/${userId}/${willId}/video_result.mp4`
    await uploadToS3(videoS3Key, videoBuffer, { contentType: 'video/mp4', useKms: true })

    // KMS로 S3 키 암호화
    const { encrypted, kmsKeyId } = await encryptString(videoS3Key)
    resultVideoS3KeyEncrypted = encrypted.toString('base64')
    resultVideoKmsKeyId = kmsKeyId
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

  getIo()?.to(`user:${userId}`).emit('job:progress', {
    jobId: bullmqJobId,
    jobType: 'video',
    status: 'completed',
    progress: 100,
    resultUrl: null,
  })

  // 6. notifications - 유언 영상 생성 완료 (보관 상태 알림, 공개는 아님)
  // 알림 INSERT 실패해도 잡 전체를 실패시키지 않음
  await insertNotification({
    userId,
    type: 'will_video_ready',
    referenceId: willId,
  }).catch((dbErr) => console.error('[videoWorker] 알림 INSERT 실패:', dbErr.message))
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
  console.log(`[videoWorker] job ${job.id} completed`)
})

// 최대 재시도 소진 후에만 DB 상태를 failed로 확정
// videoWorker는 실패 시 wills.status를 draft로 복원
worker.on('failed', async (job, err) => {
  const maxAttempts = job?.opts?.attempts ?? 1
  console.error(`[videoWorker] job ${job?.id} failed (attempt ${job?.attemptsMade}/${maxAttempts}):`, err.message)

  if (!job || job.attemptsMade < maxAttempts) return

  const { willId, userId } = job.data

  await updateAiJob(String(job.id), {
    job_status: 'failed',
    error_message: err.message,
    completed_at: new Date(),
  }).catch((dbErr) => console.error('[videoWorker] ai_jobs failed 업데이트 오류:', dbErr.message))

  // wills.status를 draft로 복원 (사용자가 재시도 가능하도록)
  await updateWill(willId, { status: 'draft' })
    .catch((dbErr) => console.error('[videoWorker] wills draft 복원 오류:', dbErr.message))

  getIo()?.to(`user:${userId}`).emit('job:progress', {
    jobId: String(job.id),
    jobType: 'video',
    status: 'failed',
    progress: 0,
    resultUrl: null,
  })
})

worker.on('error', (err) => {
  console.error('[videoWorker] worker error:', err.message)
})

export default worker
