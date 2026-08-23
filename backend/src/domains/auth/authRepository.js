/**
 * Auth Repository - DB 쿼리 전용
 *
 * 실행 필요 (최초 1회):
 * CREATE TABLE IF NOT EXISTS refresh_tokens (
 *   id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 *   token_hash   VARCHAR(64) NOT NULL UNIQUE,
 *   user_id      CHAR(36) NOT NULL,
 *   expires_at   DATETIME NOT NULL,
 *   revoked_at   DATETIME NULL,
 *   created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *   INDEX idx_rt_user    (user_id),
 *   INDEX idx_rt_expires (expires_at)
 * ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
 */

import { v4 as uuidv4 } from 'uuid'
import pool from '../../config/db.js'

/**
 * 이메일로 사용자 조회 (소프트삭제 제외)
 * @param {string} email
 * @returns {Promise<object|null>}
 */
export const findByEmail = async (email) => {
  const [rows] = await pool.query(
    `SELECT id, user_id, email, phone, nickname, profile_image_url,
            role, password_hash, email_verified_at, phone_verified_at,
            is_active, deactivated_at, created_at
     FROM users
     WHERE email = ? AND deleted_at IS NULL
     LIMIT 1`,
    [email]
  )
  return rows[0] ?? null
}

/**
 * UUID로 사용자 조회 (소프트삭제 제외)
 * @param {string} userId  - UUID (user_id 컬럼)
 * @param {import('mysql2/promise').PoolConnection|null} conn - 트랜잭션 내에서 읽어야 할 때 전달 (커밋 전 자기 트랜잭션 값을 봐야 하는 경우)
 * @returns {Promise<object|null>}
 */
export const findByUserId = async (userId, conn = null) => {
  const executor = conn ?? pool
  const [rows] = await executor.query(
    `SELECT id, user_id, email, phone, nickname, profile_image_url,
            role, email_verified_at, phone_verified_at,
            is_active, created_at
     FROM users
     WHERE user_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [userId]
  )
  return rows[0] ?? null
}

/**
 * 사용자 생성
 * @param {{ userId: string, email: string, nickname: string, passwordHash: string }} param
 * @param {import('mysql2/promise').PoolConnection|null} conn - 트랜잭션 내에서 실행할 때 전달
 * @returns {Promise<object>} 생성된 사용자 전체 필드
 */
export const createUser = async ({ userId, email, nickname, passwordHash }, conn = null) => {
  const executor = conn ?? pool
  await executor.execute(
    `INSERT INTO users (user_id, email, nickname, password_hash)
     VALUES (?, ?, ?, ?)`,
    [userId, email, nickname, passwordHash]
  )
  return findByUserId(userId, conn)
}

/**
 * 동의 이력 저장 (append-only)
 * @param {{ consentId: string, userId: string, consentType: string, isAgreed: number, ipAddress: string|null, userAgent: string|null }} param
 * @param {import('mysql2/promise').PoolConnection|null} conn - 트랜잭션 내에서 실행할 때 전달
 */
export const createConsent = async (
  { consentId, userId, consentType, isAgreed, ipAddress, userAgent },
  conn = null
) => {
  const executor = conn ?? pool
  await executor.execute(
    `INSERT INTO user_consents (consent_id, user_id, consent_type, is_agreed, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [consentId, userId, consentType, isAgreed ? 1 : 0, ipAddress ?? null, userAgent ?? null]
  )
}

/**
 * Refresh token 저장
 * @param {{ tokenHash: string, userId: string, expiresAt: Date }} param
 */
export const saveRefreshToken = async ({ tokenHash, userId, expiresAt }) => {
  await pool.query(
    `INSERT INTO refresh_tokens (token_hash, user_id, expires_at)
     VALUES (?, ?, ?)`,
    [tokenHash, userId, expiresAt]
  )
}

/**
 * Refresh token 취소 (revoke)
 * @param {string} tokenHash
 */
export const revokeRefreshToken = async (tokenHash) => {
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = ? AND revoked_at IS NULL`,
    [tokenHash]
  )
}

/**
 * Refresh token 조회 (유효성 검증용)
 * @param {string} tokenHash
 * @returns {Promise<object|null>}
 */
export const findRefreshToken = async (tokenHash) => {
  const [rows] = await pool.query(
    `SELECT token_hash, user_id, expires_at, revoked_at
     FROM refresh_tokens
     WHERE token_hash = ?
     LIMIT 1`,
    [tokenHash]
  )
  return rows[0] ?? null
}

/**
 * 동의 항목 upsert - (user_id, consent_type) UNIQUE KEY 기반 ON DUPLICATE KEY UPDATE
 * 동일 사용자·동의 유형의 기존 row가 있으면 is_agreed/agreed_at 만 갱신하고
 * consent_id(UUID)는 신규 생성 값으로 교체한다 (추적 목적)
 * @param {string} userId
 * @param {string} consentType
 * @param {boolean} isAgreed
 */
export const upsertConsent = async (userId, consentType, isAgreed) => {
  await pool.query(
    `INSERT INTO user_consents (consent_id, user_id, consent_type, is_agreed, agreed_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       consent_id = VALUES(consent_id),
       is_agreed  = VALUES(is_agreed),
       agreed_at  = NOW()`,
    [uuidv4(), userId, consentType, isAgreed ? 1 : 0],
  )
}

// [결함3 수정] adminRepository.findActiveAdminRefreshToken과 동일 패턴 - 다중 탭 동시
// refresh 경쟁에서, 늦게 도착한 요청이 "이미 회전된(revoked)" 토큰을 들고 있을 때
// 이게 진짜 재사용 공격인지 판별하려면 "지금 이 사용자에게 유효한 refresh token이
// 실제로 존재하는지"를 확인해야 한다.
export const findActiveRefreshToken = async (userId) => {
  const [rows] = await pool.query(
    `SELECT token_hash, user_id, expires_at, revoked_at, created_at
     FROM refresh_tokens
     WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  )
  return rows[0] ?? null
}

// [결함3 수정] adminRepository.revokeAllAdminRefreshTokens와 동일 패턴 - 유예 시간 밖의
// 재사용(진짜 탈취 가능성)이 확인되면, 회전으로 살아있는 다른 활성 토큰까지 전부
// 무효화해 피해 확산을 막는다.
export const revokeAllRefreshTokens = async (userId) => {
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = ? AND revoked_at IS NULL`,
    [userId],
  )
}

/**
 * 카카오 ID로 사용자 조회 (소프트삭제 제외)
 * @param {string} kakaoId
 * @returns {Promise<object|null>}
 */
export const findByKakaoId = async (kakaoId) => {
  const [rows] = await pool.query(
    `SELECT id, user_id, email, phone, nickname, profile_image_url,
            role, is_active, created_at
     FROM users
     WHERE kakao_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [kakaoId]
  )
  return rows[0] ?? null
}

/**
 * 카카오 사용자 생성 (password_hash 없음, kakao_id만 있음)
 * @param {{ userId: string, kakaoId: string, email: string|null, nickname: string }} param
 * @returns {Promise<object>} 생성된 사용자 전체 필드
 */
export const createKakaoUser = async ({ userId, kakaoId, email, nickname }) => {
  await pool.query(
    `INSERT INTO users (user_id, kakao_id, email, nickname)
     VALUES (?, ?, ?, ?)`,
    [userId, kakaoId, email ?? null, nickname]
  )
  return findByUserId(userId)
}
