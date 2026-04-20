import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import * as userController from './userController.js'

const router = Router()

// 프로필 수정 스키마
const updateProfileSchema = z.object({
  body: z.object({
    nickname: z.string().trim().min(1, '닉네임은 1자 이상이어야 합니다').max(50, '닉네임은 50자 이하여야 합니다').optional(),
    phone: z.string().max(20, '전화번호는 20자 이하여야 합니다').nullable().optional(),
    profileImageUrl: z.string().url('올바른 URL 형식이어야 합니다').max(500).nullable().optional(),
  }),
})

// 비밀번호 변경 스키마
const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, '현재 비밀번호를 입력해주세요'),
    newPassword: z.string().min(8, '새 비밀번호는 8자 이상이어야 합니다'),
  }),
})

// 모든 라우트에 requireAuth 적용
router.use(requireAuth)

router.get('/me', userController.getProfile)
router.put('/me', validate(updateProfileSchema), userController.updateProfile)
router.put('/me/password', validate(changePasswordSchema), userController.changePassword)
router.delete('/me', userController.withdraw)

export default router
