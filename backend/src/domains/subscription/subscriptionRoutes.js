import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import * as subscriptionController from './subscriptionController.js'

const router = Router()

// 구독 시작 스키마
const subscribeSchema = z.object({
  body: z.object({
    plan: z.enum(['pet_archive', 'will_premium', 'all'], {
      errorMap: () => ({ message: 'plan은 pet_archive, will_premium, all 중 하나여야 합니다' }),
    }),
    tossBillingKey: z.string().min(1, '빌링키는 필수입니다').max(255),
  }),
})

// 구독 취소 스키마
const cancelSchema = z.object({
  params: z.object({
    subscriptionId: z.string().uuid('유효한 UUID를 입력하세요'),
  }),
})

// 비인증 — 플랜 목록
router.get('/plans', subscriptionController.getPlans)

// 인증 필요 라우트
router.get('/', requireAuth, subscriptionController.getSubscriptions)
router.post('/', requireAuth, validate(subscribeSchema), subscriptionController.subscribe)
router.delete('/:subscriptionId', requireAuth, validate(cancelSchema), subscriptionController.cancelSubscription)

export default router
