import pool from '../../config/db.js'

const UPDATABLE_COLS = ['nickname', 'phone', 'profile_image_url']

/**
 * user_id(UUID)로 사용자 조회 (password_hash 제외)
 */
export const findByUserId = async (userId) => {
  const [rows] = await pool.query(
    `SELECT user_id, email, phone, nickname, profile_image_url, role, is_active, created_at, updated_at
     FROM users
     WHERE user_id = ? AND deleted_at IS NULL`,
    [userId]
  )
  return rows[0] ?? null
}

/**
 * user_id(UUID)로 사용자 조회 (password_hash 포함 - 비밀번호 변경 전용)
 */
export const findByUserIdWithHash = async (userId) => {
  const [rows] = await pool.query(
    `SELECT user_id, email, phone, nickname, profile_image_url, role, is_active, password_hash, created_at, updated_at
     FROM users
     WHERE user_id = ? AND deleted_at IS NULL`,
    [userId]
  )
  return rows[0] ?? null
}

/**
 * 프로필 업데이트 - 화이트리스트 컬럼만 허용
 */
export const updateProfile = async (userId, fields) => {
  const entries = Object.entries(fields).filter(
    ([k, v]) => UPDATABLE_COLS.includes(k) && v !== undefined
  )
  if (entries.length === 0) return

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([, v]) => v)

  await pool.query(
    `UPDATE users SET ${setClauses}, updated_at = NOW() WHERE user_id = ? AND deleted_at IS NULL`,
    [...values, userId]
  )
}

/**
 * 비밀번호 해시 업데이트
 */
export const updatePassword = async (userId, passwordHash) => {
  await pool.query(
    `UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ? AND deleted_at IS NULL`,
    [passwordHash, userId]
  )
}

/**
 * 소프트 삭제 - deleted_at = NOW(), is_active = 0
 */
export const softDelete = async (userId) => {
  await pool.query(
    `UPDATE users SET deleted_at = NOW(), is_active = 0, updated_at = NOW()
     WHERE user_id = ? AND deleted_at IS NULL`,
    [userId]
  )
}
