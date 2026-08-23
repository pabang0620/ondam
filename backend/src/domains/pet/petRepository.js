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
 *
 * FIX: DEV-31 - memorial_access_code를 SELECT에 포함한다. 이 값이 없으면 소유자
 * 본인조차 저장 직후 화면을 벗어나는 순간 자기 추모 페이지 코드를 다시 확인할 방법이
 * 없었다(추모 페이지 링크도 코드 없이는 항상 403).
 *
 * 노출 범위: 이 함수의 결과가 응답으로 나가는 경로는 전부 소유자 검증을 거친다.
 * - petService.getPet()이 pet.user_id !== userId 이면 403으로 차단하고,
 *   updatePet/updatePetStatus/deletePet/addMedia/getMedia/requestPortrait는 모두
 *   그 getPet()을 먼저 통과한다.
 * - createPet은 방금 자기가 만든 펫을 돌려주는 경로다.
 * - 공개 추모 페이지는 이 레포지토리를 쓰지 않는다(memorialRepository 별도).
 *   memorialService는 접근 코드를 응답에 담지 않는다.
 * 타인에게 노출되는 응답에 이 컬럼이 실리는 경로는 없다.
 */
export const findPetById = async (petId) => {
  const [rows] = await pool.query(
    `SELECT pet_id, user_id, name, species, breed, birth_date, death_date,
            pet_status, memorial_slug, memorial_access_code, is_public,
            profile_image_url, created_at, updated_at
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
  memorialAccessCode: 'memorial_access_code',
  isPublic: 'is_public',
}

/**
 * @param {string} petId
 * @param {object} updates
 * @param {{prevStatus:string, nextStatus:string, changedBy:string, changedByType:string, reason?:string}|null} [statusChange]
 *   [FIX D16] deathDate 등록으로 pet_status를 자동 전환할 때 petService가 넘긴다.
 *   필드 UPDATE와 pet_status 전환 + pet_status_logs INSERT를 하나의 트랜잭션으로
 *   묶어, 상태 전환 로그가 항상 필드 변경과 함께 커밋되도록 한다(둘 중 하나만
 *   반영되는 상태 불일치 방지).
 */
export const updatePet = async (petId, updates, statusChange = null) => {
  // v !== undefined 로 필터링해 "필드를 아예 보내지 않음"(undefined, 값 유지)과
  // "명시적으로 null을 보냄"(값 제거, 예: deathDate 취소)을 구분한다.
  // 과거 `v ?? null`로 undefined까지 NULL로 바꾸면, 클라이언트가 일부 필드만 보낸
  // PUT 요청에서 나머지 필드가 전부 NULL로 덮어써지는 사고가 난다.
  const entries = Object.entries(updates)
    .filter(([k, v]) => PET_UPDATABLE_COLS[k] !== undefined && v !== undefined)
    .map(([k, v]) => [PET_UPDATABLE_COLS[k], v])

  if (entries.length === 0 && !statusChange) return findPetById(petId)

  if (!statusChange) {
    const setClauses = entries.map(([col]) => `${col} = ?`).join(', ')
    const values = entries.map(([, v]) => v)

    await pool.query(
      `UPDATE pets SET ${setClauses}, updated_at = NOW() WHERE pet_id = ? AND deleted_at IS NULL`,
      [...values, petId]
    )
    return findPetById(petId)
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const setClauses = [...entries.map(([col]) => `${col} = ?`), 'pet_status = ?'].join(', ')
    const values = [...entries.map(([, v]) => v), statusChange.nextStatus]

    await conn.query(
      `UPDATE pets SET ${setClauses}, updated_at = NOW() WHERE pet_id = ? AND deleted_at IS NULL`,
      [...values, petId]
    )

    await conn.query(
      `INSERT INTO pet_status_logs
         (log_id, pet_id, prev_status, next_status, changed_by, changed_by_type, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(), petId, statusChange.prevStatus, statusChange.nextStatus,
        statusChange.changedBy, statusChange.changedByType, statusChange.reason ?? null,
      ]
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
 * memorial_slug는 UNIQUE라 삭제 시 접미사를 붙여 재사용 가능하게 해제한다 (G5).
 * CONCAT(NULL, ...) = NULL 이므로 slug 미설정 펫도 안전하게 처리된다
 * (LEFT(NULL, 41) = NULL → CONCAT(NULL, ...) = NULL, 전체 표현식이 NULL로 유지됨).
 *
 * pets.memorial_slug는 VARCHAR(100)이다. 접미사에 타임스탬프(UNIX_TIMESTAMP(), 초
 * 단위)만 쓰면 같은 초에 2건이 삭제될 때 접미사까지 완전히 같아져 memorial_slug
 * UNIQUE 충돌(ER_DUP_ENTRY) → 삭제 500이 된다. pet_id는 `CHAR(36) NOT NULL UNIQUE`라
 * 레코드마다 절대 겹치지 않으므로, 접미사에 pet_id를 포함시켜 충돌을 원천 차단한다.
 *
 * 접미사 길이 계산: '__deleted__'(11) + UNIX_TIMESTAMP()(최대 10) + '__'(2)
 * + pet_id(36, UUID) = 최대 59자. LEFT(memorial_slug, 41)로 원본을 잘라
 * 41 + 59 = 100자로 VARCHAR(100) 한계를 넘지 않는다.
 */
export const softDeletePet = async (petId) => {
  await pool.query(
    `UPDATE pets
     SET deleted_at = NOW(),
         memorial_slug = CONCAT(LEFT(memorial_slug, 41), '__deleted__', UNIX_TIMESTAMP(), '__', pet_id)
     WHERE pet_id = ? AND deleted_at IS NULL`,
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
     WHERE target_type = 'pet' AND target_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [petId],
  )
  return row ?? null
}

/**
 * 사용자의 이번 달(KST) AI 초상화 생성 횟수
 *
 * [DEV-32] 스키마 변경 없이 기존 ai_jobs만으로 카운트한다 - target_type='pet' +
 * job_type='photo_enhance' 조합이 반려동물 초상화 생성의 유일한 발생 경로다
 * (petService.requestPortrait 참조). job_status='failed'는 제외한다 - 생성
 * 실패는 사용자 귀책이 아니므로 한도에서 소진시키지 않는다. queued/running
 * 상태는 포함시킨다 - 완료 전에도 자원을 점유한 시도로 보고, 실패로 확정되는
 * 순간 다음 조회부터 자동으로 카운트에서 빠진다(별도 보정 로직 불필요).
 * YEAR/MONTH(created_at)는 서버 TZ가 Asia/Seoul로 고정돼 있어(server.js) KST
 * 기준 월 경계와 일치한다.
 */
export const countMonthlyPortraitJobs = async (userId) => {
  const [[{ cnt }]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM ai_jobs
     WHERE user_id = ? AND target_type = 'pet' AND job_type = 'photo_enhance'
       AND job_status != 'failed'
       AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())
       AND deleted_at IS NULL`,
    [userId]
  )
  return cnt
}

/**
 * 사용자의 전체 기간 AI 초상화 생성 횟수 (무료 티어 평생 1회 체험 한도 판정용)
 */
export const countAllTimePortraitJobs = async (userId) => {
  const [[{ cnt }]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM ai_jobs
     WHERE user_id = ? AND target_type = 'pet' AND job_type = 'photo_enhance'
       AND job_status != 'failed' AND deleted_at IS NULL`,
    [userId]
  )
  return cnt
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
