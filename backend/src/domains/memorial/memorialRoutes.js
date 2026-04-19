/**
 * Memorial Routes
 * Base: /api/memorial
 * 비회원 접근 가능 (optionalAuth)
 */

import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware/validate.js'
import { optionalAuth } from '../../middleware/auth.js'
import * as memorialController from './memorialController.js'

const router = Router()

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

router.get('/:slug', optionalAuth, validate(slugParamSchema), memorialController.getMemorialPage)

export default router
