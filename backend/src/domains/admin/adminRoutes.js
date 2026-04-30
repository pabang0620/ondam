import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth, requireAdmin } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import * as adminController from './adminController.js'

const router = Router()

// ---------------------------------------------------------------------------
// Rate Limiters
// ---------------------------------------------------------------------------

// 관리자 로그인 브루트포스 방지 - 일반 authLimiter보다 엄격
const adminLoginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5분
  max: 5,                   // 5분 내 최대 5회
  message: { success: false, message: '너무 많은 로그인 시도입니다. 5분 후 다시 시도해주세요' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 관리자 API 전체 - 과도한 스크래핑/자동화 방지
const adminApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 60,             // 분당 최대 60회
  keyGenerator: (req) => req.user?.adminId ?? req.ip,
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ─── 스키마 ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('유효한 이메일을 입력하세요'),
    password: z.string().min(1, '비밀번호를 입력하세요'),
  }),
})

const rejectSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    rejectReason: z.string().trim().min(1, '거절 사유를 입력하세요').max(500),
  }),
})

const releaseIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('유효한 UUID가 아닙니다'),
  }),
})

const paginationSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
})

const ordersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.string().optional(),
    targetType: z.string().optional(),
  }),
})

const usersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
  }),
})

// ─── 라우트 ───────────────────────────────────────────────────────────────────

// 인증 없음 - 관리자 로그인 (브루트포스 방지 limiter 적용)
router.post('/auth/login', adminLoginLimiter, validate(loginSchema), adminController.login)

// 이하 모두 requireAuth + requireAdmin 2층 필수
// adminApiLimiter는 인증 확인 후 keyGenerator에서 adminId를 사용하므로 requireAuth 뒤에 위치
router.get(
  '/dashboard',
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  adminController.getDashboard,
)

router.get(
  '/releases',
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  validate(paginationSchema),
  adminController.getPendingReleases,
)

router.post(
  '/releases/:id/approve',
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  validate(releaseIdSchema),
  adminController.approveRelease,
)

router.post(
  '/releases/:id/reject',
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  validate(rejectSchema),
  adminController.rejectRelease,
)

router.get(
  '/orders',
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  validate(ordersQuerySchema),
  adminController.getOrders,
)

router.get(
  '/users',
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  validate(usersQuerySchema),
  adminController.getUsers,
)

router.get(
  '/jobs/failed',
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  validate(paginationSchema),
  adminController.getFailedJobs,
)

export default router
