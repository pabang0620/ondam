/**
 * Notification Service - 비즈니스 로직 전용
 *
 * sendNotification() 은 내부용 - 다른 서비스에서 import하여 사용 가능
 */

import { v4 as uuidv4 } from 'uuid'
import * as notificationRepository from './notificationRepository.js'

// ---------------------------------------------------------------------------
// 알림 조회
// ---------------------------------------------------------------------------

/**
 * 알림 목록 조회 (페이지네이션)
 */
export const getNotifications = async (userId, { page, limit, unreadOnly }) => {
  const offset = (page - 1) * limit
  const { notifications, total } = await notificationRepository.findNotificationsByUserId(
    userId,
    { limit, offset, unreadOnly }
  )
  return {
    notifications,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

/**
 * 미읽음 알림 수 조회
 */
export const getUnreadCount = async (userId) => {
  const count = await notificationRepository.countUnread(userId)
  return { count }
}

// ---------------------------------------------------------------------------
// 읽음 처리
// ---------------------------------------------------------------------------

/**
 * 단일 알림 읽음 처리
 */
export const markAsRead = async (userId, notificationId) => {
  const notification = await notificationRepository.findNotificationById(notificationId)
  if (!notification) {
    throw Object.assign(new Error('알림을 찾을 수 없습니다'), { status: 404 })
  }
  if (notification.user_id !== userId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }

  await notificationRepository.markAsRead(notificationId, userId)
  return notificationRepository.findNotificationById(notificationId)
}

/**
 * 전체 알림 읽음 처리
 */
export const markAllAsRead = async (userId) => {
  const updatedCount = await notificationRepository.markAllAsRead(userId)
  return { updatedCount }
}

// ---------------------------------------------------------------------------
// 알림 설정
// ---------------------------------------------------------------------------

/**
 * DB row → camelCase DTO 변환
 */
const toSettingsDto = (row) => ({
  userId: row.user_id,
  pushEnabled: Boolean(row.push_enabled),
  emailEnabled: Boolean(row.email_enabled),
  smsEnabled: Boolean(row.sms_enabled),
  notifyPhotoComplete: Boolean(row.notify_photo_complete),
  notifyWillEvents: Boolean(row.notify_will_events),
  notifyPayment: Boolean(row.notify_payment),
  notifySubscription: Boolean(row.notify_subscription),
  notifyPetMemorial: Boolean(row.notify_pet_memorial),
  notifyAdminNotice: Boolean(row.notify_admin_notice),
})

/**
 * 알림 설정 조회 (없으면 기본값 반환)
 */
export const getSettings = async (userId) => {
  const settings = await notificationRepository.getSettings(userId)
  if (!settings) {
    return {
      userId,
      pushEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
      notifyPhotoComplete: true,
      notifyWillEvents: true,
      notifyPayment: true,
      notifySubscription: true,
      notifyPetMemorial: true,
      notifyAdminNotice: true,
    }
  }
  return toSettingsDto(settings)
}

/**
 * 알림 설정 변경
 */
export const updateSettings = async (userId, settings) => {
  return notificationRepository.upsertSettings(userId, settings)
}

// ---------------------------------------------------------------------------
// 알림 발송 (내부용 - 다른 서비스에서 import)
// ---------------------------------------------------------------------------

/**
 * 알림 생성 (DB 저장)
 * 다른 서비스에서: import { sendNotification } from '../notification/notificationService.js'
 *
 * @param {string} userId
 * @param {{ type: string, targetType?: string, targetId?: string, title: string, message: string }} param
 */
export const sendNotification = async (userId, { type, targetType, targetId, title, message }) => {
  const notificationId = uuidv4()
  return notificationRepository.createNotification({
    notificationId,
    userId,
    notificationType: type,
    targetType: targetType ?? null,
    targetId: targetId ?? null,
    title,
    message,
  })
}
