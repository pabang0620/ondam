process.env.TZ = 'Asia/Seoul'
import 'dotenv/config'
import { validateEnv } from './config/validateEnv.js'
validateEnv()

import { createServer } from 'http'
import { Server as SocketIO } from 'socket.io'
import jwt from 'jsonwebtoken'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { setIo } from './config/socket.js'
import authRoutes from './domains/auth/authRoutes.js'
import userRoutes from './domains/user/userRoutes.js'
import photoRoutes from './domains/photo/photoRoutes.js'
import willRoutes from './domains/will/willRoutes.js'
import petRoutes from './domains/pet/petRoutes.js'
import memorialRoutes from './domains/memorial/memorialRoutes.js'
import paymentRoutes from './domains/payment/paymentRoutes.js'
import subscriptionRoutes from './domains/subscription/subscriptionRoutes.js'
import notificationRoutes from './domains/notification/notificationRoutes.js'
import adminRoutes from './domains/admin/adminRoutes.js'
import uploadRoutes from './domains/common/uploadRoutes.js'
import './queues/billingWorker.js'
import { billingQueue } from './queues/billingQueue.js'

const app = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || 4000

// ─── Socket.IO 초기화 ──────────────────────────────────────────────────────────

const io = new SocketIO(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
})

// JWT 인증 미들웨어
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('인증 토큰이 없습니다'))
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    socket.userId = decoded.userId
    next()
  } catch {
    next(new Error('유효하지 않은 토큰입니다'))
  }
})

io.on('connection', (socket) => {
  // 사용자별 룸 자동 join
  socket.join(`user:${socket.userId}`)
  socket.on('disconnect', () => {})
})

// 다른 모듈(워커 등)에서 참조 가능하도록 등록
setIo(io)

// 보안 미들웨어
app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))

// 파싱
// 웹훅 라우트: raw body 보존 (서명 검증에 필요)
app.use('/api/payments/webhook', express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf },
}))
// 일반 라우트
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(cookieParser())

// 로깅
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'))
}

// 글로벌 rate limiting
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
})
app.use('/api/', globalLimiter)

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/photo', photoRoutes)
app.use('/api/will', willRoutes)
app.use('/api/pet', petRoutes)
app.use('/api/memorial', memorialRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/uploads', uploadRoutes)

// 헬스체크
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '온담 서버 정상 동작 중' })
})

// multer 에러 핸들러 (글로벌 에러 핸들러 앞에 등록)
const MULTER_ERROR_MESSAGES = {
  LIMIT_FILE_SIZE: '파일 크기가 허용 한도를 초과했습니다',
  LIMIT_FILE_COUNT: '업로드 가능한 파일 수를 초과했습니다',
  LIMIT_UNEXPECTED_FILE: '허용되지 않는 필드명입니다',
}

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: MULTER_ERROR_MESSAGES[err.code] ?? '파일 업로드 오류가 발생했습니다',
    })
  }
  next(err)
})

// 글로벌 에러 핸들러
app.use((err, req, res, _next) => {
  console.error('[unhandled error]', err)

  // mysql2 중복 키 에러 → 409
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: '이미 존재하는 데이터입니다',
    })
  }

  // JWT 만료 에러 → 401 (TokenExpiredError)
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: '토큰이 만료되었습니다. 다시 로그인해 주세요',
    })
  }

  // 기타 JWT 에러 (JsonWebTokenError 등) → 401
  if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
    return res.status(401).json({
      success: false,
      message: '유효하지 않은 토큰입니다',
    })
  }

  const status = err.status || 500
  const isDev = process.env.NODE_ENV === 'development'

  res.status(status).json({
    success: false,
    message: err.message || '서버 오류가 발생했습니다',
    ...(isDev && status === 500 && { stack: err.stack }),
  })
})

httpServer.listen(PORT, () => {
  console.log(`[ondam] 서버 시작 - 포트 ${PORT} (${process.env.NODE_ENV})`)

  // 구독 자동결제 scan-due 반복 job 등록 (이미 있으면 BullMQ가 skip)
  billingQueue.add(
    'scan-due',
    {},
    {
      repeat: { cron: process.env.BILLING_SCAN_CRON || '0 3 * * *' },
      jobId: 'billing-scan-due-repeat',
    }
  ).catch((err) => {
    console.warn('[server] scan-due 반복 job 등록 실패:', err.message)
  })
})

export default app
