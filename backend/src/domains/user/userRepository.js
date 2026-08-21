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
 * email은 UNIQUE라 삭제 시 접미사를 붙여 동일 이메일 재가입이 가능하도록 해제한다 (G5)
 *
 * users.email은 VARCHAR(320)이다. 접미사에 타임스탬프(UNIX_TIMESTAMP(), 초 단위)만
 * 쓰면 같은 초에 2건이 탈퇴할 때 접미사까지 완전히 같아져 email UNIQUE 충돌
 * (ER_DUP_ENTRY) → 탈퇴 500이 된다. user_id는 `CHAR(36) NOT NULL UNIQUE`라 레코드마다
 * 절대 겹치지 않으므로, 접미사에 user_id를 포함시켜 충돌을 원천 차단한다
 * (타임스탬프는 grep으로 삭제 시점을 대략 가늠하기 위한 보조 정보로만 유지).
 *
 * 접미사 길이 계산: '__deleted__'(11) + UNIX_TIMESTAMP()(최대 10, 서기 2286년까지)
 * + '__'(2) + user_id(36, UUID) = 최대 59자. LEFT(email, 261)로 원본을 잘라
 * 261 + 59 = 320자로 VARCHAR(320) 한계를 넘지 않는다.
 *
 * kakao_id(BIGINT UNSIGNED UNIQUE)도 같은 이유로 함께 해제한다. ondam_schema.sql 확인
 * 결과 `kakao_id BIGINT UNSIGNED UNIQUE NULL`로 NULL을 허용하므로, 숫자 컬럼이라
 * email처럼 접미사를 붙일 수 없는 대신 NULL로 해제한다 - 탈퇴 후 같은 카카오 계정으로
 * 재가입/재로그인해도 UNIQUE 충돌(409) 없이 정상 진행된다.
 */
export const softDelete = async (userId) => {
  await pool.query(
    `UPDATE users
     SET deleted_at = NOW(),
         is_active = 0,
         email = CONCAT(LEFT(email, 261), '__deleted__', UNIX_TIMESTAMP(), '__', user_id),
         kakao_id = NULL,
         updated_at = NOW()
     WHERE user_id = ? AND deleted_at IS NULL`,
    [userId]
  )
}
