import { Worker } from 'bullmq'
import nodemailer from 'nodemailer'
import redis from '../../config/redis.js'

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
    subject: subject ?? '온담 알림',
    text: message,
  })
}

// ─── 발송 디스패처 ────────────────────────────────────────────────────────────

const dispatch = async (jobData) => {
  const { type, to, subject, message, userId, notificationId } = jobData

  if (AI_MOCK) {
    console.error(
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
      // push 미구현 — 향후 FCM 등으로 대체 예정
      console.error(`[notificationWorker] push 미구현 — notificationId=${notificationId} to=${to}`)
      break
    default:
      throw new Error(`알 수 없는 알림 타입: ${type}`)
  }
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

worker.on('completed', (job) => {
  console.error(`[notificationWorker] job ${job.id} completed (type=${job.data?.type})`)
})

worker.on('failed', (job, err) => {
  const maxAttempts = job?.opts?.attempts ?? 1
  console.error(`[notificationWorker] job ${job?.id} failed (attempt ${job?.attemptsMade}/${maxAttempts}):`, err.message)
})

worker.on('error', (err) => {
  console.error('[notificationWorker] worker error:', err.message)
})

export default worker
