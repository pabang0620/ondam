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
import { CONSENT_TYPE } from '../../../../shared/constants/enums.js'

const router = Router()

// ---------------------------------------------------------------------------
// Rate Limiters
// ---------------------------------------------------------------------------

// 브루트포스 방지 - 회원가입/로그인 엔드포인트 전용
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 10,                   // 15분 내 최대 10회
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ---------------------------------------------------------------------------
// Zod 스키마
// ---------------------------------------------------------------------------

// 회원가입 화면(useJoin.js)이 보내는 동의 항목 - CONSENT_TYPE은 shared/constants/enums.js
// (G1 SSOT)를 그대로 참조한다. CONSENT_TYPE에는 이미 'terms'/'marketing'이 포함돼 있으나
// (마이그레이션 2026-08-21b가 DB ENUM에 추가할 예정 값을 선반영한 상태), b가 아직
// 적용되지 않은 DB에서는 이 두 값으로 INSERT하면 MySQL이 거부한다. authService.register가
// 필수 동의(privacy)가 아닌 항목에 한해 그 실패를 개별적으로 흡수하므로, 마이그레이션
// 적용 여부와 무관하게 가입 자체는 항상 성공한다 (구체적 동작은 authService.js 주석 참조).
const consentItemSchema = z.object({
  type: z.enum(CONSENT_TYPE, {
    errorMap: () => ({ message: '유효하지 않은 동의 항목입니다' }),
  }),
  isAgreed: z.boolean(),
})

const consentSchema = z.object({
  body: z.object({
    consents: z
      .array(
        z.object({
          consentType: z.enum(CONSENT_TYPE, {
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
