import { Worker } from 'bullmq'
import { v4 as uuidv4 } from 'uuid'
import { File } from 'buffer'
import redis from '../../config/redis.js'
import pool from '../../config/db.js'
import { decryptBuffer } from '../../utils/kms.js'
import { downloadFromS3 } from '../../utils/s3.js'
import { getIo } from '../../config/socket.js'
import * as willRepository from '../../domains/will/willRepository.js'

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
    `UPDATE ai_jobs SET ${setClauses}, updated_at = NOW() WHERE bullmq_job_id = ? AND deleted_at IS NULL`,
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
    `UPDATE voice_samples SET ${setClauses}, updated_at = NOW() WHERE voice_sample_id = ? AND deleted_at IS NULL`,
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

  // [보안 수정 - defense in depth] 음성권 동의 재확인. photoWorker/videoWorker와
  // 동일한 패턴 - willService.uploadVoiceSample이 큐 등록 직전에 이미 'voice' 동의를
  // 확인하지만, BullMQ 대기열에서 이 워커가 잡을 집을 때까지 사용자가 설정 화면에서
  // 동의를 철회했을 수 있다(user_consents는 append-only라 철회도 즉시 새 행으로
  // 반영됨). ElevenLabs에 실제 사람 목소리를 전송해 클론하는 벤더 호출 직전, 서비스
  // 계층 게이트(uploadVoiceSample)와 동일한 조건('voice' 동의만 - portrait/ai_generation은
  // 프로필 사진·영상 결과물 보관에 대한 동의라 목소리 클론과는 무관하고, activateWill/
  // videoWorker 쪽에서 별도로 확인한다)으로 다시 확인한다. 실패 시 throw해 BullMQ
  // 잡 레벨 재시도(backoff)에 맡기고, 재시도를 거쳐도 동의가 복원되지 않으면
  // worker.on('failed')의 기존 실패 처리(ai_jobs/voice_samples를 failed로 갱신 +
  // 소켓 통지)가 그대로 사용자에게 상황을 전달한다. voice_samples는 결제 대상
  // target_type이 아니라(payments.target_type ENUM에 'voice_sample' 없음) 환불
  // 로직은 필요 없다.
  const voiceConsent = await willRepository.findVoiceConsent(userId)
  if (!voiceConsent || voiceConsent.is_agreed !== 1) {
    throw Object.assign(new Error('동의가 확인되지 않아 음성 클론을 중단합니다'), { status: 400 })
  }

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
    // [로컬 개발 폴백 대응] willService.encryptVoiceSampleS3Key가 KMS_KEY_ID 미설정 시
    // s3Key를 암호화하지 않고 저장할 수 있다(kmsKeyId=''). 그 경우 encryptedBuf는 실제
    // KMS 암호문이 아니라 평문 UTF-8 바이트라 그대로 KMS Decrypt에 넘기면 잘못된
    // ciphertext 오류가 난다 - willService.decryptWillContent와 동일하게 kmsKeyId가
    // falsy(빈 문자열 포함)면 복호화를 건너뛰고 바로 문자열로 복원한다.
    const s3Key = kmsKeyId
      ? await decryptBuffer(encryptedBuf)
      : encryptedBuf.toString('utf8')

    // S3에서 음성 파일 다운로드
    const audioBuffer = await downloadFromS3(s3Key)

    // ElevenLabs Voice Clone API 호출
    const formData = new FormData()
    formData.append('name', `ondam-${voiceSampleId}`)
    formData.append('description', '온담 영상 편지 음성 클론')
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
  // 주의: notifications.target_type ENUM에는 'voice_sample'이 없다
  // (ENUM: photo_order/will/will_release_request/payment/subscription/pet/avatar_session).
  // voiceSampleId는 wills.will_id가 아니라서 target_type='will'로 바꿔치기하면
  // target_id가 실제로는 존재하지 않는 will_id를 가리키는 거짓 FK가 되어 더 위험하다.
  // 안전한 선택지로 target_type/target_id를 모두 NULL로 두었다(컬럼 NULL 허용).
  const notifId = uuidv4()
  await pool.execute(
    `INSERT INTO notifications
       (notification_id, user_id, notification_type, target_type, target_id,
        title, message, is_read, created_at)
     VALUES (?, ?, 'voice_clone_complete', NULL, NULL,
             '음성 클론 완료', '음성 클론이 완료되었습니다. 이제 영상 편지를 생성할 수 있습니다.', 0, NOW())`,
    [notifId, userId],
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
