/**
 * Notification Routes
 * Base: /api/notifications
 */

import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware/validate.js'
import { requireAuth } from '../../middleware/auth.js'
import * as notificationController from './notificationController.js'

const router = Router()

// ---------------------------------------------------------------------------
// Zod 스키마
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    unreadOnly: z
      .string()
      .transform((v) => v === 'true')
      .pipe(z.boolean())
      .optional()
      .default('false'),
  }),
})

const notificationIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('유효하지 않은 알림 ID입니다'),
  }),
})

const updateSettingsSchema = z.object({
  body: z
    .object({
      pushEnabled: z.boolean().optional(),
      emailEnabled: z.boolean().optional(),
      smsEnabled: z.boolean().optional(),
      notifyPhotoComplete: z.boolean().optional(),
      notifyWillEvents: z.boolean().optional(),
      notifyPayment: z.boolean().optional(),
      notifySubscription: z.boolean().optional(),
      notifyPetMemorial: z.boolean().optional(),
      notifyAdminNotice: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: '변경할 설정 항목이 없습니다',
    }),
})

// ---------------------------------------------------------------------------
// 라우트
// 주의: /read-all, /unread-count, /settings 는 /:id 앞에 등록해야 함
// ---------------------------------------------------------------------------

router.use(requireAuth)

router.get('/unread-count', notificationController.getUnreadCount)
router.get('/settings', notificationController.getSettings)
router.put('/settings', validate(updateSettingsSchema), notificationController.updateSettings)
router.put('/read-all', notificationController.markAllAsRead)
router.get('/', validate(listQuerySchema), notificationController.getNotifications)
router.put('/:id/read', validate(notificationIdParamSchema), notificationController.markAsRead)

export default router
