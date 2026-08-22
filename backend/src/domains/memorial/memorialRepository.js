/**
 * Memorial Repository - DB 쿼리 전용
 * 공개 추모 페이지 전용 (비회원 접근 가능)
 */

import pool from '../../config/db.js'

/**
 * memorial_slug 로 펫 조회 (공개용 - 민감 필드 제외)
 */
export const findPetBySlug = async (slug) => {
  const [rows] = await pool.query(
    `SELECT pet_id, name, species, breed, birth_date, death_date,
            pet_status, memorial_slug, profile_image_url, created_at,
            memorial_access_code, is_public
     FROM pets
     WHERE memorial_slug = ? AND deleted_at IS NULL
     LIMIT 1`,
    [slug]
  )
  return rows[0] ?? null
}

/**
 * 펫 ID로 미디어 목록 조회 (페이지네이션, 공개용)
 */
export const findMediaByPetId = async (petId, { limit, offset }) => {
  const [rows] = await pool.query(
    `SELECT media_id, media_type, file_url, thumbnail_url,
            mime_type, width, height, duration_sec,
            taken_at, sort_order, caption, created_at
     FROM pet_media
     WHERE pet_id = ? AND deleted_at IS NULL
     ORDER BY sort_order ASC, created_at DESC
     LIMIT ? OFFSET ?`,
    [petId, limit, offset]
  )
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM pet_media WHERE pet_id = ? AND deleted_at IS NULL`,
    [petId]
  )
  return { media: rows, total }
}
