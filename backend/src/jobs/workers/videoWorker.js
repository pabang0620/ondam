import { Worker } from 'bullmq'
import { v4 as uuidv4 } from 'uuid'
import redis from '../../config/redis.js'
import pool from '../../config/db.js'
import { encryptString } from '../../utils/kms.js'
import { downloadFromS3, uploadToS3, deleteFromS3 } from '../../utils/s3.js'
import { getIo } from '../../config/socket.js'
import { getLipsyncAdapter } from '../../services/lipsync/index.js'
import { pollUntilComplete, assertAllowedHost } from '../../services/lipsync/pollHelper.js'

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
  const { willId, userId, photoS3Key } = jobData

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

    // 립싱크 벤더 어댑터 경유 영상 생성 (LIPSYNC_PROVIDER 환경변수로 벤더 교체 가능: sync/musetalk/did)
    const adapter = getLipsyncAdapter()
    if (!adapter.isConfigured()) {
      throw Object.assign(
        new Error(`${adapter.name} 립싱크 벤더의 API 키가 설정되지 않았습니다`),
        { status: 500 },
      )
    }

    const { externalJobId, stagingS3Keys } = await adapter.submit({ photoBuffer, audioBuffer })

    let videoUrl
    try {
      // 완료 폴링 (최대 30회, 10초 간격 = 5분)
      videoUrl = await pollUntilComplete(
        async () => {
          const { status, videoUrl: polledUrl } = await adapter.poll(externalJobId)
          if (status === 'completed') {
            return { done: true, value: polledUrl }
          }
          return { done: false }
        },
        { maxAttempts: 30, intervalMs: 10000 },
      )
    } finally {
      // 립싱크 벤더가 lipsync-staging/{vendor}/{stagingId}/... 경로에 올린 임시 파일 정리
      // 폴링 성공/실패 무관하게 실행. best-effort - 정리 실패가 전체 잡 실패로 이어지면 안 됨
      try {
        await Promise.all((stagingS3Keys ?? []).map((key) => deleteFromS3(key)))
      } catch (cleanupErr) {
        console.error('[videoWorker] 립싱크 스테이징 오브젝트 정리 실패:', cleanupErr.message)
      }
    }

    // SSRF 방어 - 활성 벤더의 허용 호스트만 통과
    assertAllowedHost(videoUrl, adapter.allowedResultHosts)

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
