import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import * as giftController from './giftController.js'
import { GIFT_PRODUCT_TYPE, CONSENT_TYPE } from '../../../../shared/constants/enums.js'

const router = Router()

// 선물 생성은 결제를 동반하므로 payment 도메인의 paymentLimiter와 동일한 강도로 제한
const giftLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.userId ?? req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
})

// 무인증 수행 링크 - willRoutes.js의 watchLimiter와 동일한 이유(G9-1) - IP+토큰 조합
// 기준이라 다른 수행자의 정상 접근을 막지 않으면서 한 토큰에 대한 무차별 대입만 제한한다.
// 오입력 5회 잠금(Redis, giftPerformService)이 1차 방어선, 이 limiter가 2차 방어선.
const performLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => `${req.ip}:${req.params.token ?? ''}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
})

// ─── 스키마 ───────────────────────────────────────────────────────────────────

const phoneSchema = z
  .string()
  .trim()
  .regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, '올바른 휴대폰 번호 형식이 아닙니다')

const createGiftSchema = z.object({
  body: z.object({
    productType: z.enum(GIFT_PRODUCT_TYPE, {
      errorMap: () => ({ message: 'productType은 photo 또는 will이어야 합니다' }),
    }),
    recipientName: z.string().trim().min(1, '받는 분 이름을 입력하세요').max(100),
    recipientPhone: phoneSchema,
  }),
})

const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }).optional(),
})

const giftIdParamSchema = z.object({
  params: z.object({
    giftId: z.string().uuid('유효한 UUID'),
  }),
})

const cancelSchema = z.object({
  params: z.object({
    giftId: z.string().uuid('유효한 UUID'),
  }),
  body: z.object({
    cancelReason: z.string().trim().max(200).optional(),
  }),
})

const attachPhotoSchema = z.object({
  params: z.object({
    giftId: z.string().uuid('유효한 UUID'),
  }),
  body: z.object({
    orderId: z.string().uuid('유효한 UUID'),
  }),
})

const attachWillSchema = z.object({
  params: z.object({
    giftId: z.string().uuid('유효한 UUID'),
  }),
  body: z.object({
    willId: z.string().uuid('유효한 UUID'),
  }),
})

const completeSchema = z.object({
  params: z.object({
    giftId: z.string().uuid('유효한 UUID'),
  }),
  body: z.object({
    orderId: z.string().uuid().optional(),
    willId: z.string().uuid().optional(),
  }),
})

const tokenParamSchema = z.object({
  params: z.object({
    token: z.string().length(64, '유효하지 않은 토큰입니다'),
  }),
})

const verifyPerformSchema = z.object({
  params: z.object({
    token: z.string().length(64, '유효하지 않은 토큰입니다'),
  }),
  body: z.object({
    phoneLast4: z.string().regex(/^\d{4}$/, '휴대폰 번호 뒤 4자리(숫자 4개)를 입력하세요'),
  }),
})

const consentItemSchema = z.object({
  type: z.enum(CONSENT_TYPE, { errorMap: () => ({ message: '유효하지 않은 동의 항목입니다' }) }),
  isAgreed: z.boolean(),
})

const linkAccountSchema = z.object({
  params: z.object({
    token: z.string().length(64, '유효하지 않은 토큰입니다'),
  }),
  body: z
    .object({
      mode: z.enum(['signup', 'login'], { errorMap: () => ({ message: 'mode는 signup 또는 login이어야 합니다' }) }),
      email: z.string().trim().email('올바른 이메일 형식이 아닙니다'),
      password: z.string().trim().min(1, '비밀번호를 입력하세요'),
      nickname: z.string().trim().max(50).optional(),
      consents: z.array(consentItemSchema).optional(),
    })
    .refine((v) => v.mode !== 'signup' || (v.nickname && v.nickname.length > 0), {
      message: '닉네임을 입력해주세요',
      path: ['nickname'],
    })
    .refine((v) => v.mode !== 'signup' || v.password.length >= 8, {
      message: '비밀번호는 8자 이상이어야 합니다',
      path: ['password'],
    })
    .refine((v) => v.mode !== 'signup' || (v.consents && v.consents.length > 0), {
      message: '동의 항목이 필요합니다',
      path: ['consents'],
    }),
})

// ─── 구매(자녀) - 인증 필요 ─────────────────────────────────────────────────────

router.post('/', requireAuth, giftLimiter, validate(createGiftSchema), giftController.createGiftOrder)
router.get('/mine', requireAuth, validate(listSchema), giftController.getMyGifts)
router.post('/:giftId/resend', requireAuth, validate(giftIdParamSchema), giftController.resendLink)
router.post('/:giftId/cancel', requireAuth, validate(cancelSchema), giftController.cancelGift)
router.post('/:giftId/attach-photo-order', requireAuth, validate(attachPhotoSchema), giftController.attachPhotoOrder)
router.post('/:giftId/attach-will', requireAuth, validate(attachWillSchema), giftController.attachWillOrder)
router.post('/:giftId/complete', requireAuth, validate(completeSchema), giftController.completeGift)

// ─── 수행(부모, 무계정) ─────────────────────────────────────────────────────────

router.get('/perform/:token', performLimiter, validate(tokenParamSchema), giftController.getPerformInfo)
router.post('/perform/:token/verify', performLimiter, validate(verifyPerformSchema), giftController.verifyPerform)
router.post('/perform/:token/account', performLimiter, validate(linkAccountSchema), giftController.linkAccount)
router.post('/perform/:token/decline', performLimiter, validate(tokenParamSchema), giftController.declinePerform)

export default router
