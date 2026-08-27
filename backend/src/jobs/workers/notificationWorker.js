import { Worker } from 'bullmq'
import nodemailer from 'nodemailer'
import { randomUUID } from 'node:crypto'
import redis from '../../config/redis.js'
import pool from '../../config/db.js'

const QUEUE_NAME = 'notification'
const AI_MOCK = process.env.AI_MOCK === 'true'

// ─── SMS (Coolsms) ────────────────────────────────────────────────────────────

/**
 * Coolsms HMAC-SHA256 서명 생성
 * https://docs.coolsms.co.kr/authentication/hmac-authentication
 */
const buildCoolsmsAuth = async (apiKey, apiSecret) => {
  const date = new Date().toISOString()
  const salt = Math.random().toString(36).slice(2, 18)
  const data = `${date}${salt}`

  const { createHmac } = await import('node:crypto')
  const signature = createHmac('sha256', apiSecret).update(data).digest('hex')

  return {
    Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
  }
}

const sendSms = async ({ to, message }) => {
  const apiKey = process.env.COOLSMS_API_KEY
  const apiSecret = process.env.COOLSMS_API_SECRET
  const from = process.env.COOLSMS_SENDER

  if (!apiKey || !apiSecret || !from) {
    throw new Error('Coolsms 환경변수 누락 (COOLSMS_API_KEY, COOLSMS_API_SECRET, COOLSMS_SENDER)')
  }

  const authHeaders = await buildCoolsmsAuth(apiKey, apiSecret)

  const res = await fetch('https://api.coolsms.co.kr/messages/v4/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      message: {
        to,
        from,
        text: message,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Coolsms 발송 실패 (HTTP ${res.status}): ${body}`)
  }
}

// ─── Email (Gmail OAuth2 via nodemailer) ──────────────────────────────────────

const buildEmailTransport = () => {
  const user = process.env.GMAIL_USER
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN

  if (!user || !clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail 환경변수 누락 (GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)')
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user,
      clientId,
      clientSecret,
      refreshToken,
    },
  })
}

const sendEmail = async ({ to, subject, message }) => {
  const transport = buildEmailTransport()
  await transport.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject: subject ?? '리멤버미 알림',
    text: message,
  })
}

// ─── 발송 디스패처 ────────────────────────────────────────────────────────────

const dispatch = async (jobData) => {
  const { type, to, subject, message, userId, notificationId } = jobData

  if (AI_MOCK) {
    console.log(
      `[notificationWorker][MOCK] type=${type} to=${to} notificationId=${notificationId} userId=${userId} message="${message}"`
    )
    return
  }

  switch (type) {
    case 'sms':
      await sendSms({ to, message })
      break
    case 'email':
      await sendEmail({ to, subject, message })
      break
    case 'push':
      // push 미구현 - 향후 FCM 등으로 대체 예정
      console.error(`[notificationWorker] push 미구현 - notificationId=${notificationId} to=${to}`)
      break
    default:
      throw new Error(`알 수 없는 알림 타입: ${type}`)
  }
}

// ─── 전달(delivered_at) 기록 + 최종 실패 가시화 (FIX D5, 2026-08-23) ───────────
//
// delivered_at은 adminService.approveRelease의 큐 등록 시점이 아니라, 여기 실제
// 발송 성공(worker 'completed' 이벤트) 시점에 기록한다. 마이그레이션 c README
// 3-1절 정의("유가족에게 실제로 알림이 발송된 시각")와 4절 6번 지침("catch
// 분기에선 기록 금지")의 의도를 그대로 따르되, "성공"의 기준점을 큐 등록에서
// 실제 발송 완료로 옮긴 것이다 - 큐 등록은 성공해도 Gmail/Coolsms 키가 없거나
// API가 거부하면 실제로는 아무것도 나가지 않는데 DB만 "전달됨"이라 거짓 기록하는
// 사고가 있었다.

/**
 * release_approved 잡이 실제로 완료됐을 때 수신인의 delivered_at을 기록한다.
 * 이메일/SMS 각각 별도 잡으로 큐에 들어가므로(adminService.approveRelease),
 * 같은 beneficiaryId에 대해 두 번 호출될 수 있다 - delivered_at IS NULL 가드로
 * 두 번째 호출은 조용히 no-op된다(멱등). 비회원 수신인(user_id NULL)도 이
 * 컬럼 기준으로는 동일하게 동작한다(in-app 알림 유무와 무관).
 */
const markBeneficiaryDelivered = async (job) => {
  const beneficiaryId = job?.data?.beneficiaryId
  if (job?.name !== 'release_approved' || !beneficiaryId) return

  await pool.execute(
    `UPDATE will_beneficiaries SET delivered_at = NOW(), updated_at = NOW()
     WHERE beneficiary_id = ? AND deleted_at IS NULL AND delivered_at IS NULL`,
    [beneficiaryId],
  )
}

/**
 * 재시도(attempts=3)가 전부 소진된 뒤에도 발송이 실패하면, DB 어디에도 흔적이
 * 남지 않아 운영자가 "안 갔다"는 사실 자체를 알 방법이 없었다. audit_logs에
 * 남겨 관리자가 조회할 수 있게 한다(GET /api/admin/notifications/failed).
 * actor_id는 사람이 아니라 워커이므로 NULL + actor_type='system'.
 */
const recordFinalDeliveryFailure = async (job, err) => {
  const { type, to, beneficiaryId, notificationId, userId } = job?.data ?? {}
  const targetType = beneficiaryId ? 'will_beneficiary' : 'notification'
  const targetId = beneficiaryId ?? notificationId ?? null

  await pool.execute(
    `INSERT INTO audit_logs
       (log_id, actor_id, actor_type, action, target_type, target_id, detail, created_at)
     VALUES (?, NULL, 'system', 'notification_delivery_failed', ?, ?, ?, NOW())`,
    [
      randomUUID(),
      targetType,
      targetId,
      JSON.stringify({
        jobName: job?.name ?? null,
        jobId: job?.id ?? null,
        notificationType: type ?? null,
        to: to ?? null,
        userId: userId ?? null,
        attemptsMade: job?.attemptsMade ?? null,
        error: err?.message ?? String(err),
      }),
    ],
  )
}

// ─── 워커 등록 ────────────────────────────────────────────────────────────────

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    await dispatch(job.data)
  },
  {
    connection: redis,
    concurrency: 5,
    stalledInterval: 30000,
  },
)

worker.on('completed', async (job) => {
  console.log(`[notificationWorker] job ${job.id} completed (type=${job.data?.type})`)
  try {
    await markBeneficiaryDelivered(job)
  } catch (err) {
    // 발송 자체는 성공했으므로 job은 completed로 유지한다 - DB 기록 실패만으로
    // 이메일/SMS를 다시 보내면 유가족에게 중복 발송된다.
    console.error(`[notificationWorker] delivered_at 기록 실패 (발송은 성공) job=${job.id}:`, err.message)
  }
})

worker.on('failed', async (job, err) => {
  const maxAttempts = job?.opts?.attempts ?? 1
  const attemptsMade = job?.attemptsMade ?? 0
  console.error(`[notificationWorker] job ${job?.id} failed (attempt ${attemptsMade}/${maxAttempts}):`, err.message)

  if (job && attemptsMade >= maxAttempts) {
    try {
      await recordFinalDeliveryFailure(job, err)
    } catch (auditErr) {
      console.error(`[notificationWorker] 최종 실패 audit_logs 기록 실패 job=${job?.id}:`, auditErr.message)
    }
  }
})

worker.on('error', (err) => {
  console.error('[notificationWorker] worker error:', err.message)
})

export default worker
