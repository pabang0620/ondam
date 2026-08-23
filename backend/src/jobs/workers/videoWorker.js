import { Worker } from 'bullmq'
import { v4 as uuidv4 } from 'uuid'
import redis from '../../config/redis.js'
import pool from '../../config/db.js'
import { notificationQueue } from '../queue.js'
import { encryptString } from '../../utils/kms.js'
import { downloadFromS3, uploadToS3, deleteFromS3 } from '../../utils/s3.js'
import { getIo } from '../../config/socket.js'
import { getLipsyncAdapter } from '../../services/lipsync/index.js'
import { pollUntilComplete, assertAllowedHost } from '../../services/lipsync/pollHelper.js'
import * as paymentService from '../../domains/payment/paymentService.js'
import * as willRepository from '../../domains/will/willRepository.js'
import { refundGiftFallback } from '../../domains/gift/giftShared.js'

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
    `UPDATE ai_jobs SET ${setClauses}, updated_at = NOW() WHERE bullmq_job_id = ? AND deleted_at IS NULL`,
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
    `UPDATE wills SET ${setClauses}, updated_at = NOW() WHERE will_id = ? AND deleted_at IS NULL`,
    values,
  )
}

// title/message는 호출자가 지정한다 (기존에는 성공 케이스 문구가 하드코딩돼 있어
// type 인자와 무관하게 항상 같은 문구가 나갔다 - 실패 통지 추가하며 일반화했다)
const insertNotification = async ({ userId, type, referenceId, title, message }) => {
  const notifId = uuidv4()
  await pool.execute(
    `INSERT INTO notifications
       (notification_id, user_id, notification_type, target_type, target_id,
        title, message, is_read)
     VALUES (?, ?, ?, 'will', ?, ?, ?, 0)`,
    [notifId, userId, type, referenceId ?? null, title, message],
  )
}

const findUserEmail = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT email FROM users WHERE user_id = ? AND deleted_at IS NULL LIMIT 1`,
    [userId],
  )
  return rows[0]?.email ?? null
}

// ─── SPEC-02 2절(DEV-08): 유언 영상 AI 생성 최종 실패 시 후처리 ──────────────────
// wills.status ENUM에는 'failed' 값이 없다(draft/paid/active/released/revoked) -
// 스키마 변경 없이는 "실패" 자체를 상태값으로 표현할 수 없다. 대신 will_status_logs에
// 사유를 남기고, 실제 환불이 확정된 경우(또는 애초에 결제가 없었던 경우)에만 기존과
// 동일하게 status를 'draft'로 되돌린다. 환불 자체가 실패하면 결제가 실제로 살아있는
// 상태(payments.status='done')이므로 will도 'active'로 그대로 둬서 관리자가 "결제는
// 됐는데 영상은 실패"인 불일치를 놓치지 않게 한다(섣불리 draft로 되돌리면 문제가
// 조용히 묻힌다).
const finalizeWillFailure = async ({ willId, userId, failReason }) => {
  const refundResult = await paymentService
    .refundForAiFailure('will_order', willId, { reason: `AI 처리 실패: ${failReason}` })
    .catch((err) => {
      console.error('[videoWorker] refundForAiFailure 호출 자체 실패 (수동 환불 필요):', willId, err.message)
      return { refunded: false, reason: 'refund_call_threw' }
    })

  // [마감 공백 처리] will_order 경로에서 결제를 못 찾았다면(no_completed_payment)
  // 선물로 결제된 콘텐츠일 수 있다 - gift 역조회로 환불을 재시도한다(완료 보고 2절).
  let effectiveRefund = refundResult
  if (refundResult.reason === 'no_completed_payment') {
    const giftFallback = await refundGiftFallback({
      productType: 'will',
      contentId: willId,
      reason: `AI 처리 실패: ${failReason}`,
    }).catch((err) => {
      console.error('[videoWorker] gift 환불 역조회 실패:', willId, err.message)
      return null
    })
    if (giftFallback?.refundResult?.refunded) {
      effectiveRefund = giftFallback.refundResult
    }
  }

  // 환불 성공(gift 경로 포함) 또는 애초에 결제가 없었던 경우(no_completed_payment이고
  // gift 경로에서도 찾지 못한 경우)만 draft로 복원
  const shouldRevertToDraft = effectiveRefund.refunded || effectiveRefund.reason === 'no_completed_payment'

  if (shouldRevertToDraft) {
    await willRepository.updateWill(willId, { status: 'draft' })
      .catch((dbErr) => console.error('[videoWorker] wills draft 복원 오류:', dbErr.message))

    await willRepository.addWillStatusLog({
      logId: uuidv4(),
      willId,
      prevStatus: 'active',
      nextStatus: 'draft',
      changedBy: userId,
      changedByType: 'system',
      reason: `AI 영상 생성 실패: ${String(failReason).slice(0, 450)}`,
    }).catch((err) => console.error('[videoWorker] will_status_logs 기록 실패:', err.message))
  } else {
    console.error(
      '[videoWorker] 환불 실패로 will 상태를 draft로 되돌리지 않음 (수동 확인 필요):',
      { willId, reason: effectiveRefund.reason },
    )
  }

  const message = effectiveRefund.refunded
    ? '죄송합니다. 영상 편지 생성에 실패해 결제하신 금액을 전액 환불해 드렸어요. 카드사에 따라 환불 반영까지 며칠 걸릴 수 있어요. 내용을 다시 확인하고 시도해 보시겠어요?'
    : effectiveRefund.reason === 'no_completed_payment'
      ? '영상 편지 생성에 실패했습니다. 결제된 내역이 없어 별도 환불 없이 종료돼요. 다시 시도해 보시겠어요?'
      : '죄송합니다. 영상 편지 생성에 실패했고, 환불 처리 중 문제가 발생했습니다. 저희가 곧 확인해서 환불해 드릴게요. 급하시면 고객센터로 연락해 주세요.'

  // [2026-08-22 컷오버] photoWorker.js와 동일 - AI 실패 자동 환불 통지는 payment_failed
  // 를 의미상 오용해 왔다. 전용 ENUM 값 'ai_processing_refunded'(마이그레이션 c)로 교체.
  await insertNotification({
    userId,
    type: 'ai_processing_refunded',
    referenceId: willId,
    title: '영상 편지 생성 실패 안내',
    message,
  }).catch((err) => console.error('[videoWorker] 실패 알림 INSERT 오류:', err.message))

  const email = await findUserEmail(userId).catch((err) => {
    console.error('[videoWorker] 사용자 이메일 조회 실패:', err.message)
    return null
  })
  if (email) {
    await notificationQueue.add('will_video_failed_refund', {
      type: 'email',
      to: email,
      subject: '[온담] 영상 편지 생성 실패 안내',
      message,
    }).catch((err) => console.error('[videoWorker] 실패 알림 큐 등록 오류:', err.message))
  }
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
      throw new Error('영상 편지 내용이 없습니다. 텍스트를 작성해 주세요.')
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
    title: '영상 편지 생성 완료',
    message: '영상 편지 AI 생성이 완료되었습니다.',
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
// videoWorker는 실패 시 finalizeWillFailure가 환불 결과에 따라 wills.status 복원 여부를 결정
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

  // SPEC-02 2절(DEV-08): 로그 + 자동 환불 + 통지. wills 상태 복원(draft) 여부는
  // 환불 성공 여부에 따라 finalizeWillFailure 내부에서 결정한다(기존에는 여기서
  // 무조건 draft로 되돌렸으나, 환불 실패 시에도 무조건 되돌리면 "결제는 됐는데
  // 아무 일 없었던 것처럼" 보이는 문제가 있었다).
  await finalizeWillFailure({ willId, userId, failReason: err.message })

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
