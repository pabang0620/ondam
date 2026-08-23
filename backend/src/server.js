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
import giftRoutes from './domains/gift/giftRoutes.js'
import './queues/billingWorker.js'
// [결함 수정 - DEV-33] notificationWorker는 워커 전용 프로세스(jobs/index.js)에서만
// 띄운다. 이전에는 여기서도 직접 import해 같은 Redis 큐를 서버·워커 두 프로세스가
// 동시에 polling했다 - BullMQ 락 덕에 중복 처리는 안 되지만, 재시도 로그가 두
// 프로세스에 흩어져 운영 추적이 어려워졌다. 알림이 실제로 나가려면 워커 프로세스
// (npm run workers / jobs/index.js)가 반드시 떠 있어야 한다는 전제가 생긴다.
import { registerBillingScanDueScheduler } from './queues/billingQueue.js'
import { checkDbConnection } from './config/db.js'
import { toSafeFailureMessage } from './utils/failureMessages.js'

const app = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || 4000

// ─── trust proxy ───────────────────────────────────────────────────────────────
// express-rate-limit 등 req.ip 기반 미들웨어가 여러 limiter(authLimiter,
// adminLoginLimiter, subscriptionLimiter, memorialLimiter 등)에서 키로 쓰인다.
// 리버스 프록시(nginx 등) 뒤에 배포되면 trust proxy 미설정 시 req.ip가 프록시
// IP 하나로 고정되어 전체 사용자가 하나의 rate limit 버킷을 공유하게 된다.
// `trust proxy: true`(무조건 신뢰)는 클라이언트가 X-Forwarded-For를 위조해
// 임의의 IP를 자처할 수 있어 rate limit을 그대로 우회당한다 - 사용하지 않는다.
// 대신 홉 수(TRUST_PROXY_HOPS)를 지정하면 Express가 X-Forwarded-For 체인에서
// 프록시가 실제로 추가한 마지막 N개 값만 신뢰하고, 그보다 앞(클라이언트가
// 임의로 붙인 값)은 무시한다 - 위조로 우회 불가능하다.
// 기본값 0 = 프록시 없음(로컬/직접 노출, req.ip를 소켓 주소 그대로 사용).
// 프록시 뒤에 배포할 때만 .env에 TRUST_PROXY_HOPS를 프록시 홉 수(보통 1)로
// 설정해야 한다 - 설정하지 않으면 위 회귀가 재발한다.
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '0', 10)
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
  app.set('trust proxy', trustProxyHops)
}

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
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
// [결함3 관련 조치] 추모관 접근 코드(GET /api/memorial/:slug?accessCode=...)는 쿼리스트링으로
// 전달된다(SPEC-03: 비공개 펫 추모 페이지를 "링크 하나로 공유"하는 설계 - accessCode를 헤더/
// 바디로 옮기면 그 공유 링크 UX 자체가 깨진다, docs/specs/SPEC-03-memorial-access.md 2/3절).
// URL 설계는 유지하되, morgan 기본 :url 토큰이 req.originalUrl(쿼리스트링 포함)을 그대로
// 로그에 남기므로 accessCode 값만 여기서 마스킹한다 - 브라우저 히스토리·Referer 헤더는
// 서버 코드로 제어할 수 없는 클라이언트 영역이라 이 조치의 대상이 아니다.
morgan.token('url', (req) => (req.originalUrl || req.url).replace(/([?&]accessCode=)[^&]*/i, '$1[REDACTED]'))
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
app.use('/api/gifts', giftRoutes)

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

  // [결함3 - 정보 노출 방어 강화] 이전에는 "NODE_ENV==='development'가 아니면
  // 5xx 메시지를 가린다"는 단일 문자열 비교 하나에 프로덕션 전체가 걸려 있었다 -
  // 배포 시 NODE_ENV가 실수로 'development'로 남으면 즉시 raw mysql2 메시지·
  // 벤더 SDK 원문이 전량 노출된다. 이제 5xx의 message 필드는 NODE_ENV 값과
  // 무관하게 항상 toSafeFailureMessage()로 정제한다(결함1/2에서 uploadMiddleware·
  // kms.js·s3.js가 쓰는 것과 동일한 유틸 재사용 - 새 매핑을 만들지 않는다).
  // err.message에 실제로 어떤 내부 정보가 담겨 있는지와 무관하게 항상 안전하고,
  // 이미 안전하게 다듬어진 메시지(예: 업로드 503 문구)가 들어와도 toSafeFailureMessage는
  // 매칭되는 패턴이 없으면 그냥 일반 안내문으로 떨어지므로 이중 새니타이즈로
  // 인한 부작용도 없다. 원본은 위 console.error로 서버 로그에는 그대로 남으므로
  // 로컬 디버깅에는 지장이 없다.
  // err.stack(파일 경로 등 원본 메시지보다 더 상세한 정보)만 기존과 동일하게
  // NODE_ENV==='development'일 때만 추가로 실어준다 - 이 부분만은 여전히 NODE_ENV
  // 설정에 기대는 잔여 위험이라, 배포 체크리스트에서 NODE_ENV=production 설정
  // 여부를 반드시 확인해야 한다(완료 보고 3번 참조 - 과한 opt-in 플래그를 새로
  // 두면 .env를 건드리지 않고는 로컬 개발 편의가 깨지므로 이 결함 수정 범위에서는
  // message 필드 강화로 한정한다).
  // 4xx는 의도적으로 던진 사용자 메시지(Object.assign(new Error(...), { status })이므로
  // 그대로 전달한다.
  const clientMessage =
    status >= 500
      ? toSafeFailureMessage(err.message) ?? '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      : err.message || '서버 오류가 발생했습니다'

  res.status(status).json({
    success: false,
    message: clientMessage,
    ...(isDev && status === 500 && { stack: err.stack }),
  })
})

httpServer.listen(PORT, () => {
  console.log(`[ondam] 서버 시작 - 포트 ${PORT} (${process.env.NODE_ENV})`)

  // DB 연결 헬스 프로브 (DEV-28) - lazyConnect 풀이라 부팅 시점엔 연결 성공/실패를
  // 알 수 없다. SELECT 1로 즉시 확인해 로그에 남긴다. 실패해도 서버는 죽이지
  // 않는다(개발 편의) - 대신 눈에 띄게 경고한다.
  checkDbConnection()

  // 구독 자동결제 scan-due 반복 job 등록/갱신 (기동 시 반드시 확인 로그 남김 - DEV-26)
  registerBillingScanDueScheduler().catch((err) => {
    console.error('[server] scan-due 스케줄러 등록 실패:', err.message)
  })
})

export default app
