/**
 * Pet Repository - DB 쿼리 전용
 */

import { v4 as uuidv4 } from 'uuid'
import pool from '../../config/db.js'

// ---------------------------------------------------------------------------
// 펫
// ---------------------------------------------------------------------------

/**
 * 펫 생성
 */
export const createPet = async ({
  petId,
  userId,
  name,
  species,
  breed,
  birthDate,
  deathDate,
  petStatus,
}) => {
  await pool.query(
    `INSERT INTO pets (pet_id, user_id, name, species, breed, birth_date, death_date, pet_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [petId, userId, name, species, breed ?? null, birthDate ?? null, deathDate ?? null, petStatus]
  )
  return findPetById(petId)
}

/**
 * pet_id(UUID)로 펫 조회
 */
export const findPetById = async (petId) => {
  const [rows] = await pool.query(
    `SELECT pet_id, user_id, name, species, breed, birth_date, death_date,
            pet_status, memorial_slug, profile_image_url, created_at, updated_at
     FROM pets
     WHERE pet_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [petId]
  )
  return rows[0] ?? null
}

/**
 * 사용자 ID로 펫 목록 조회 (페이지네이션)
 */
export const findPetsByUserId = async (userId, { limit, offset }) => {
  const [rows] = await pool.query(
    `SELECT pet_id, user_id, name, species, breed, birth_date, death_date,
            pet_status, memorial_slug, profile_image_url, created_at, updated_at
     FROM pets
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  )
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM pets WHERE user_id = ? AND deleted_at IS NULL`,
    [userId]
  )
  return { pets: rows, total }
}

/**
 * memorial_slug 로 펫 조회
 */
export const findPetBySlug = async (slug) => {
  const [rows] = await pool.query(
    `SELECT pet_id, user_id, name, species, breed, birth_date, death_date,
            pet_status, memorial_slug, profile_image_url, created_at, updated_at
     FROM pets
     WHERE memorial_slug = ? AND deleted_at IS NULL
     LIMIT 1`,
    [slug]
  )
  return rows[0] ?? null
}

/**
 * 펫 정보 수정 (UPDATABLE_COLS 화이트리스트)
 */
const PET_UPDATABLE_COLS = {
  name: 'name',
  breed: 'breed',
  birthDate: 'birth_date',
  deathDate: 'death_date',
  profileImageUrl: 'profile_image_url',
  memorialSlug: 'memorial_slug',
}

export const updatePet = async (petId, updates) => {
  const entries = Object.entries(updates)
    .filter(([k]) => PET_UPDATABLE_COLS[k] !== undefined)
    .map(([k, v]) => [PET_UPDATABLE_COLS[k], v])

  if (entries.length === 0) return findPetById(petId)

  const setClauses = entries.map(([col]) => `${col} = ?`).join(', ')
  const values = entries.map(([, v]) => v ?? null)

  await pool.query(
    `UPDATE pets SET ${setClauses}, updated_at = NOW() WHERE pet_id = ? AND deleted_at IS NULL`,
    [...values, petId]
  )
  return findPetById(petId)
}

/**
 * 펫 상태 변경 + 상태 로그 INSERT (트랜잭션)
 */
export const updatePetStatus = async (petId, {
  prevStatus,
  nextStatus,
  changedBy,
  changedByType,
  reason,
}) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    await conn.query(
      `UPDATE pets SET pet_status = ?, updated_at = NOW()
       WHERE pet_id = ? AND deleted_at IS NULL`,
      [nextStatus, petId]
    )

    await conn.query(
      `INSERT INTO pet_status_logs
         (log_id, pet_id, prev_status, next_status, changed_by, changed_by_type, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), petId, prevStatus, nextStatus, changedBy, changedByType, reason ?? null]
    )

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
  return findPetById(petId)
}

/**
 * 펫 소프트 삭제
 */
export const softDeletePet = async (petId) => {
  await pool.query(
    `UPDATE pets SET deleted_at = NOW() WHERE pet_id = ? AND deleted_at IS NULL`,
    [petId]
  )
}

// ---------------------------------------------------------------------------
// 미디어
// ---------------------------------------------------------------------------

/**
 * 미디어 생성
 */
export const createMedia = async ({
  mediaId,
  petId,
  mediaType,
  fileUrl,
  s3Key,
  thumbnailS3Key,
  thumbnailUrl,
  mimeType,
  fileSize,
  width,
  height,
  durationSec,
  takenAt,
  sortOrder,
  caption,
}) => {
  await pool.query(
    `INSERT INTO pet_media
       (media_id, pet_id, media_type, file_url, s3_key, thumbnail_s3_key, thumbnail_url,
        mime_type, file_size, width, height, duration_sec, taken_at, sort_order, caption)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      mediaId,
      petId,
      mediaType,
      fileUrl,
      s3Key,
      thumbnailS3Key ?? null,
      thumbnailUrl ?? null,
      mimeType ?? null,
      fileSize ?? null,
      width ?? null,
      height ?? null,
      durationSec ?? null,
      takenAt ?? null,
      sortOrder ?? 0,
      caption ?? null,
    ]
  )
  return findMediaById(mediaId)
}

/**
 * media_id(UUID)로 미디어 조회
 */
export const findMediaById = async (mediaId) => {
  const [rows] = await pool.query(
    `SELECT media_id, pet_id, media_type, file_url, s3_key, thumbnail_url,
            mime_type, file_size, width, height, duration_sec,
            taken_at, sort_order, caption, created_at
     FROM pet_media
     WHERE media_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [mediaId]
  )
  return rows[0] ?? null
}

/**
 * 펫 ID로 미디어 목록 조회 (페이지네이션)
 */
export const findMediaByPetId = async (petId, { limit, offset }) => {
  const [rows] = await pool.query(
    `SELECT media_id, pet_id, media_type, file_url, s3_key, thumbnail_url,
            mime_type, file_size, width, height, duration_sec,
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

/**
 * 미디어 소프트 삭제
 */
export const softDeleteMedia = async (mediaId) => {
  await pool.query(
    `UPDATE pet_media SET deleted_at = NOW() WHERE media_id = ? AND deleted_at IS NULL`,
    [mediaId]
  )
}

/**
 * 펫의 가장 최근 ai_jobs 1건 조회 (초상화 상태 확인용)
 */
export const findLatestAiJob = async (petId) => {
  const [[row]] = await pool.query(
    `SELECT job_status, progress, result_url FROM ai_jobs
     WHERE target_type = 'pet' AND target_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [petId],
  )
  return row ?? null
}

/**
 * 펫의 가장 최근 사진 1장 조회
 */
export const findLatestPhoto = async (petId) => {
  const [rows] = await pool.query(
    `SELECT media_id, pet_id, media_type, file_url, s3_key, thumbnail_url,
            mime_type, file_size, width, height, created_at
     FROM pet_media
     WHERE pet_id = ? AND media_type = 'photo' AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [petId]
  )
  return rows[0] ?? null
}
