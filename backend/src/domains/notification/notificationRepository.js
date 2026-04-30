/**
 * Notification Repository - DB 쿼리 전용
 */

import pool from '../../config/db.js'

// ---------------------------------------------------------------------------
// 알림
// ---------------------------------------------------------------------------

/**
 * 알림 생성
 */
export const createNotification = async ({
  notificationId,
  userId,
  notificationType,
  targetType,
  targetId,
  title,
  message,
}) => {
  await pool.query(
    `INSERT INTO notifications
       (notification_id, user_id, notification_type, target_type, target_id, title, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      notificationId,
      userId,
      notificationType,
      targetType ?? null,
      targetId ?? null,
      title,
      message,
    ]
  )
  return findNotificationById(notificationId)
}

/**
 * notification_id(UUID)로 알림 조회
 */
export const findNotificationById = async (notificationId) => {
  const [rows] = await pool.query(
    `SELECT notification_id, user_id, notification_type, target_type, target_id,
            title, message, is_read, read_at, created_at
     FROM notifications
     WHERE notification_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [notificationId]
  )
  return rows[0] ?? null
}

/**
 * 사용자 알림 목록 조회 (페이지네이션, 미읽음 필터 옵션)
 */
export const findNotificationsByUserId = async (userId, { limit, offset, unreadOnly }) => {
  const unreadClause = unreadOnly ? 'AND is_read = 0' : ''
  const [rows] = await pool.query(
    `SELECT notification_id, notification_type, target_type, target_id,
            title, message, is_read, read_at, created_at
     FROM notifications
     WHERE user_id = ? AND deleted_at IS NULL ${unreadClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  )
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM notifications
     WHERE user_id = ? AND deleted_at IS NULL ${unreadClause}`,
    [userId]
  )
  return { notifications: rows, total }
}

/**
 * 미읽음 알림 수 조회
 */
export const countUnread = async (userId) => {
  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM notifications
     WHERE user_id = ? AND is_read = 0 AND deleted_at IS NULL`,
    [userId]
  )
  return Number(count)
}

/**
 * 단일 알림 읽음 처리
 */
export const markAsRead = async (notificationId, userId) => {
  const [result] = await pool.query(
    `UPDATE notifications
     SET is_read = 1, read_at = NOW()
     WHERE notification_id = ? AND user_id = ? AND is_read = 0 AND deleted_at IS NULL`,
    [notificationId, userId]
  )
  return result.affectedRows > 0
}

/**
 * 전체 알림 읽음 처리
 */
export const markAllAsRead = async (userId) => {
  const [result] = await pool.query(
    `UPDATE notifications
     SET is_read = 1, read_at = NOW()
     WHERE user_id = ? AND is_read = 0 AND deleted_at IS NULL`,
    [userId]
  )
  return result.affectedRows
}

// ---------------------------------------------------------------------------
// 알림 설정
// ---------------------------------------------------------------------------

/**
 * 알림 설정 조회
 */
export const getSettings = async (userId) => {
  const [rows] = await pool.query(
    `SELECT user_id, push_enabled, email_enabled, sms_enabled,
            notify_photo_complete, notify_will_events, notify_payment,
            notify_subscription, notify_pet_memorial, notify_admin_notice,
            created_at, updated_at
     FROM user_notification_settings
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  )
  return rows[0] ?? null
}

/**
 * 알림 설정 upsert
 */
export const upsertSettings = async (userId, settings) => {
  const UPDATABLE_COLS = {
    pushEnabled: 'push_enabled',
    emailEnabled: 'email_enabled',
    smsEnabled: 'sms_enabled',
    notifyPhotoComplete: 'notify_photo_complete',
    notifyWillEvents: 'notify_will_events',
    notifyPayment: 'notify_payment',
    notifySubscription: 'notify_subscription',
    notifyPetMemorial: 'notify_pet_memorial',
    notifyAdminNotice: 'notify_admin_notice',
  }

  const entries = Object.entries(settings)
    .filter(([k]) => UPDATABLE_COLS[k] !== undefined)
    .map(([k, v]) => [UPDATABLE_COLS[k], v])

  if (entries.length === 0) return getSettings(userId)

  const cols = entries.map(([col]) => col).join(', ')
  const placeholders = entries.map(() => '?').join(', ')
  const values = entries.map(([, v]) => (typeof v === 'boolean' ? (v ? 1 : 0) : v))
  const updateClauses = entries.map(([col]) => `${col} = VALUES(${col})`).join(', ')

  await pool.query(
    `INSERT INTO user_notification_settings (user_id, ${cols})
     VALUES (?, ${placeholders})
     ON DUPLICATE KEY UPDATE ${updateClauses}, updated_at = NOW()`,
    [userId, ...values]
  )
  return getSettings(userId)
}
