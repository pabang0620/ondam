import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import * as subscriptionController from './subscriptionController.js'

const router = Router()

// 인증 필요 라우트 전용 limiter - payment 도메인의 paymentLimiter와 동일 패턴(G9-1).
// billing-auth/POST //retry-payment는 실제 토스 빌링 API를 호출하는 금전적 엔드포인트라
// 반드시 필요하고, 나머지 인증된 조회 라우트도 같은 limiter로 일괄 보호한다.
// keyGenerator가 userId를 우선하므로(요청 시점엔 requireAuth를 이미 통과해 req.user가
// 항상 채워져 있다) trust proxy 미설정 등으로 req.ip가 왜곡돼도 사용자별 한도가 유지된다.
const subscriptionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.userId ?? req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
})

// GET /plans 전용 limiter - 비인증 공개 조회 라우트라 위 subscriptionLimiter(10회/분,
// 인증 라우트 기준)를 공유하면 안 된다. 로그인 전 구독 페이지가 이 API 하나로
// 렌더링되므로(가격 비교 위해 새로고침·재방문도 흔함) 넉넉한 한도로 완화하고,
// 키는 비인증 라우트 원칙대로 ip를 쓴다(G9-3).
const publicPlansLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
})

// 빌링키 발급 + 구독 시작 스키마 (authKey + customerKey 방식)
// [DEV-17] will_premium(유언장 보관 구독)은 폐지되어 신규 가입 플랜 목록에서
// 제거했다. [DEV-32, 2026-08-22 오너 확정] all(전체 이용권, 9,900원)도 동일하게
// 폐지 - 펫 아카이브는 pet_archive 단일가로 확정한다. 기존 will_premium/all
// 구독 행은 그대로 두되(강제취소·삭제 안 함), 이 enum을 통해 "새로 이 플랜으로
// 가입"하는 경로만 막는다.
const billingAuthSchema = z.object({
  body: z.object({
    authKey: z.string().min(1, 'authKey는 필수입니다'),
    customerKey: z.string().uuid('customerKey는 유효한 UUID여야 합니다'),
    plan: z.enum(['pet_archive'], {
      errorMap: () => ({ message: 'plan은 pet_archive여야 합니다' }),
    }),
  }),
})

// 구독 시작 스키마 (POST / - 하위 호환 유지)
const subscribeSchema = z.object({
  body: z.object({
    plan: z.enum(['pet_archive'], {
      errorMap: () => ({ message: 'plan은 pet_archive여야 합니다' }),
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

// 비인증 - 플랜 목록
router.get('/plans', publicPlansLimiter, subscriptionController.getPlans)

// 인증 필요 라우트

// 빌링키 발급 + 구독 시작 (권장 엔드포인트)
router.post('/billing-auth', requireAuth, subscriptionLimiter, validate(billingAuthSchema), subscriptionController.billingAuth)

// 구독 목록
router.get('/', requireAuth, subscriptionLimiter, subscriptionController.getSubscriptions)

// 구독 시작 (하위 호환)
router.post('/', requireAuth, subscriptionLimiter, validate(subscribeSchema), subscriptionController.subscribe)

// 구독 취소
router.delete('/:subscriptionId', requireAuth, subscriptionLimiter, validate(cancelSchema), subscriptionController.cancelSubscription)

// 결제 재시도
router.post('/:subscriptionId/retry-payment', requireAuth, subscriptionLimiter, validate(subscriptionIdSchema), subscriptionController.retryPayment)

// 결제 로그 조회
router.get('/:subscriptionId/payment-logs', requireAuth, subscriptionLimiter, validate(paymentLogsQuerySchema), subscriptionController.getPaymentLogs)

export default router
