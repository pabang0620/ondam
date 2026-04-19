import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import * as photoController from './photoController.js'

const router = Router()

// AI 처리 비용 방지 — 인증된 사용자 기준으로 키 생성
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 20,                   // 시간당 최대 20회
  keyGenerator: (req) => req.user?.userId ?? req.ip,
  message: { success: false, message: 'AI 처리 요청 한도를 초과했습니다' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ─── 공통 스키마 ──────────────────────────────────────────────────────────────

const orderParamSchema = z.object({
  params: z.object({
    orderId: z.string().uuid('유효한 UUID가 아닙니다'),
  }),
})

const createOrderSchema = z.object({
  body: z.object({
    photoType: z.enum(['funeral', 'id', 'job', 'enhance', 'colorize', 'restore', 'removebg'], {
      errorMap: () => ({ message: "photoType은 'funeral', 'id', 'job', 'enhance', 'colorize', 'restore', 'removebg' 중 하나여야 합니다" }),
    }),
  }),
})

const listQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
})

// ─── 라우트 ───────────────────────────────────────────────────────────────────

// 모든 라우트 인증 필수
router.use(requireAuth)

router.post(
  '/orders',
  aiLimiter,
  validate(createOrderSchema),
  photoController.createOrder,
)

router.get(
  '/orders',
  validate(listQuerySchema),
  photoController.getOrders,
)

router.get(
  '/orders/:orderId',
  validate(orderParamSchema),
  photoController.getOrder,
)

router.get(
  '/orders/:orderId/status',
  validate(orderParamSchema),
  photoController.getJobStatus,
)

router.get(
  '/orders/:orderId/result',
  validate(orderParamSchema),
  photoController.getResult,
)

router.post(
  '/orders/:orderId/retry',
  aiLimiter,
  validate(orderParamSchema),
  photoController.retryOrder,
)

router.post(
  '/orders/:orderId/start',
  aiLimiter,
  validate(orderParamSchema),
  photoController.startProcessing,
)

export default router
