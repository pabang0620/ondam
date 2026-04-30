/**
 * Notification Controller - 요청 파싱 + 응답 전담
 */

import * as notificationService from './notificationService.js'
import { success, paginated } from '../../utils/response.js'

/**
 * GET /api/notifications
 */
export const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, unreadOnly } = req.query
    const { notifications, meta } = await notificationService.getNotifications(
      req.user.userId,
      { page, limit, unreadOnly }
    )
    return paginated(res, notifications, meta, '알림 목록')
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    const data = await notificationService.getUnreadCount(req.user.userId)
    return success(res, data)
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/notifications/:id/read
 */
export const markAsRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(req.user.userId, req.params.id)
    return success(res, notification, '알림을 읽음 처리했습니다')
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/notifications/read-all
 */
export const markAllAsRead = async (req, res, next) => {
  try {
    const data = await notificationService.markAllAsRead(req.user.userId)
    return success(res, data, '전체 알림을 읽음 처리했습니다')
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/notifications/settings
 */
export const getSettings = async (req, res, next) => {
  try {
    const settings = await notificationService.getSettings(req.user.userId)
    return success(res, settings)
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/notifications/settings
 */
export const updateSettings = async (req, res, next) => {
  try {
    const settings = await notificationService.updateSettings(req.user.userId, req.body)
    return success(res, settings, '알림 설정이 변경되었습니다')
  } catch (err) {
    next(err)
  }
}
