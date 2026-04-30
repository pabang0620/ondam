/**
 * Auth Routes
 * Base: /api/auth
 */

import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import * as authController from './authController.js'

const router = Router()

// ---------------------------------------------------------------------------
// Rate Limiters
// ---------------------------------------------------------------------------

// 브루트포스 방지 - 회원가입/로그인 엔드포인트 전용
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 10,                   // 15분 내 최대 10회
  message: { success: false, message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ---------------------------------------------------------------------------
// Zod 스키마
// ---------------------------------------------------------------------------

const consentItemSchema = z.object({
  type: z.enum(['privacy', 'portrait', 'voice', 'ai_generation', 'posthumous_release'], {
    errorMap: () => ({ message: '유효하지 않은 동의 항목입니다' }),
  }),
  isAgreed: z.boolean(),
})

const consentSchema = z.object({
  body: z.object({
    consents: z
      .array(
        z.object({
          consentType: z.enum(['portrait', 'voice', 'ai_generation', 'posthumous_release'], {
            errorMap: () => ({ message: '유효하지 않은 동의 항목입니다' }),
          }),
          isAgreed: z.boolean(),
        }),
      )
      .min(1, '동의 항목이 하나 이상 필요합니다'),
  }),
})

const registerSchema = z.object({
  body: z.object({
    email: z.string().trim().email('올바른 이메일 형식이 아닙니다'),
    password: z.string().trim().min(8, '비밀번호는 8자 이상이어야 합니다'),
    nickname: z
      .string()
      .trim()
      .min(1, '닉네임을 입력해주세요')
      .max(50, '닉네임은 50자 이하여야 합니다'),
    consents: z
      .array(consentItemSchema)
      .min(1, '동의 항목이 필요합니다'),
  }),
})

const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email('올바른 이메일 형식이 아닙니다'),
    password: z.string().trim().min(1, '비밀번호를 입력해주세요'),
  }),
})

// ---------------------------------------------------------------------------
// 라우트
// ---------------------------------------------------------------------------

router.post('/register', authLimiter, validate(registerSchema), authController.register)
router.post('/login', authLimiter, validate(loginSchema), authController.login)
router.post('/refresh', authController.refreshToken)
router.post('/logout', requireAuth, authController.logout)
router.post('/consents', requireAuth, validate(consentSchema), authController.saveConsents)

// 카카오 OAuth
router.get('/kakao', authController.kakaoLogin)
router.get('/kakao/callback', authController.kakaoCallback)

export default router
