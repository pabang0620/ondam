import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import * as subscriptionController from './subscriptionController.js'

const router = Router()

// 빌링키 발급 + 구독 시작 스키마 (authKey + customerKey 방식)
const billingAuthSchema = z.object({
  body: z.object({
    authKey: z.string().min(1, 'authKey는 필수입니다'),
    customerKey: z.string().uuid('customerKey는 유효한 UUID여야 합니다'),
    plan: z.enum(['pet_archive', 'will_premium', 'all'], {
      errorMap: () => ({ message: 'plan은 pet_archive, will_premium, all 중 하나여야 합니다' }),
    }),
  }),
})

// 구독 시작 스키마 (POST / — 하위 호환 유지)
const subscribeSchema = z.object({
  body: z.object({
    plan: z.enum(['pet_archive', 'will_premium', 'all'], {
      errorMap: () => ({ message: 'plan은 pet_archive, will_premium, all 중 하나여야 합니다' }),
    }),
    authKey: z.string().min(1, 'authKey는 필수입니다'),
    customerKey: z.string().uuid('customerKey는 유효한 UUID여야 합니다'),
  }),
})

// 구독 취소 스키마
const cancelSchema = z.object({
  params: z.object({
    subscriptionId: z.string().uuid('유효한 UUID를 입력하세요'),
  }),
})

// 구독 ID 파라미터 스키마
const subscriptionIdSchema = z.object({
  params: z.object({
    subscriptionId: z.string().uuid('유효한 UUID를 입력하세요'),
  }),
})

// 결제 로그 조회 쿼리 스키마
const paymentLogsQuerySchema = z.object({
  params: z.object({
    subscriptionId: z.string().uuid('유효한 UUID를 입력하세요'),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  }).optional(),
})

// 비인증 — 플랜 목록
router.get('/plans', subscriptionController.getPlans)

// 인증 필요 라우트

// 빌링키 발급 + 구독 시작 (권장 엔드포인트)
router.post('/billing-auth', requireAuth, validate(billingAuthSchema), subscriptionController.billingAuth)

// 구독 목록
router.get('/', requireAuth, subscriptionController.getSubscriptions)

// 구독 시작 (하위 호환)
router.post('/', requireAuth, validate(subscribeSchema), subscriptionController.subscribe)

// 구독 취소
router.delete('/:subscriptionId', requireAuth, validate(cancelSchema), subscriptionController.cancelSubscription)

// 결제 재시도
router.post('/:subscriptionId/retry-payment', requireAuth, validate(subscriptionIdSchema), subscriptionController.retryPayment)

// 결제 로그 조회
router.get('/:subscriptionId/payment-logs', requireAuth, validate(paymentLogsQuerySchema), subscriptionController.getPaymentLogs)

export default router
