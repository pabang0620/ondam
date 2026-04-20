import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import * as paymentController from './paymentController.js'

const router = Router()

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.userId ?? req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '결제 요청이 너무 많습니다.' },
})

// 결제 준비 스키마
const prepareSchema = z.object({
  body: z.object({
    targetType: z.enum(['photo_order', 'will_order', 'subscription'], {
      errorMap: () => ({ message: 'targetType은 photo_order, will_order, subscription 중 하나여야 합니다' }),
    }),
    targetId: z.string().uuid('유효한 UUID를 입력하세요'),
    amountKrw: z.number().int('정수 금액이어야 합니다').positive('금액은 0보다 커야 합니다'),
  }),
})

// 결제 승인 스키마
const confirmSchema = z.object({
  body: z.object({
    paymentKey: z.string().min(1, 'paymentKey는 필수입니다').max(200),
    orderId: z.string().min(1, 'orderId는 필수입니다').max(64),
    amount: z.number().positive('금액은 0보다 커야 합니다'),
  }),
})

// 결제 취소 스키마
const cancelSchema = z.object({
  params: z.object({
    paymentId: z.string().uuid('유효한 UUID를 입력하세요'),
  }),
  body: z.object({
    cancelReason: z.string().trim().min(1, '취소 사유를 입력하세요').max(200).optional(),
  }),
})

// 결제 목록 조회 스키마
const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
})

// 웹훅 — 인증 없이 수신 (토스 서명 검증은 서비스 레이어에서 처리)
router.post('/webhook', paymentController.handleWebhook)

// 인증 필요 라우트
router.post('/prepare', requireAuth, paymentLimiter, validate(prepareSchema), paymentController.preparePayment)
router.post('/confirm', requireAuth, paymentLimiter, validate(confirmSchema), paymentController.confirmPayment)
router.get('/', requireAuth, validate(listSchema), paymentController.getPayments)
router.post('/:paymentId/cancel', requireAuth, validate(cancelSchema), paymentController.cancelPayment)

export default router
