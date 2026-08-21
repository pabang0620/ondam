/**
 * Memorial Routes
 * Base: /api/memorial
 * 비회원 접근 가능 (optionalAuth)
 */

import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { validate } from '../../middleware/validate.js'
import { optionalAuth } from '../../middleware/auth.js'
import * as memorialController from './memorialController.js'

const router = Router()

// ---------------------------------------------------------------------------
// Rate Limiters
// ---------------------------------------------------------------------------

// memorial_slug(저엔트로피, 사용자가 직접 짓는 문자열)+접근 코드(평문 최소 6자) 조합에
// 대한 무차별 대입 방지 (G9-1). 비회원 접근 가능한 공개 엔드포인트라 IP 기준으로 제한한다.
const memorialLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
})

// ---------------------------------------------------------------------------
// Zod 스키마
// ---------------------------------------------------------------------------

const slugParamSchema = z.object({
  params: z.object({
    slug: z
      .string()
      .min(3, '슬러그는 3자 이상이어야 합니다')
      .max(100)
      .regex(/^[a-z0-9-]+$/, '슬러그는 소문자, 숫자, 하이픈만 사용 가능합니다'),
  }),
  query: z.object({
    accessCode: z.string().max(100).optional(),
  }).optional(),
})

// ---------------------------------------------------------------------------
// 라우트
// ---------------------------------------------------------------------------

router.get('/:slug', memorialLimiter, optionalAuth, validate(slugParamSchema), memorialController.getMemorialPage)

export default router
