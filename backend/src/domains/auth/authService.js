/**
 * Auth Service — 비즈니스 로직 전용
 */

import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import * as authRepository from './authRepository.js'

const ACCESS_TOKEN_EXPIRES = '15m'
const REFRESH_TOKEN_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000 // 30일 (ms)

/**
 * Refresh token 문자열을 SHA-256으로 해시
 * @param {string} token
 * @returns {string}
 */
export const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex')

/**
 * Access token 발급
 * @param {{ userId: string, role: string }} payload
 * @returns {string}
 */
export const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES })

/**
 * Refresh token 발급 (서명된 JWT)
 * @param {{ userId: string }} payload
 * @returns {string}
 */
export const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' })

/**
 * 회원가입
 * @param {{ email: string, password: string, nickname: string, consents: Array<{type: string, isAgreed: boolean}>, ipAddress: string|null, userAgent: string|null }} param
 * @returns {{ accessToken: string, refreshToken: string, user: object }}
 */
export const register = async ({
  email,
  password,
  nickname,
  consents,
  ipAddress,
  userAgent,
}) => {
  // privacy 동의 필수 체크
  const privacyConsent = consents.find((c) => c.type === 'privacy')
  if (!privacyConsent || !privacyConsent.isAgreed) {
    throw Object.assign(new Error('개인정보 처리 방침 동의가 필요합니다'), { status: 400 })
  }

  // 이메일 중복 확인
  const existing = await authRepository.findByEmail(email)
  if (existing) {
    throw Object.assign(new Error('이미 사용 중인 이메일입니다'), { status: 409 })
  }

  const userId = uuidv4()
  const passwordHash = await bcrypt.hash(password, 12)

  // 사용자 생성
  const user = await authRepository.createUser({ userId, email, nickname, passwordHash })

  // 동의 이력 저장
  for (const consent of consents) {
    await authRepository.createConsent({
      consentId: uuidv4(),
      userId,
      consentType: consent.type,
      isAgreed: consent.isAgreed ? 1 : 0,
      ipAddress,
      userAgent,
    })
  }

  // 토큰 발급
  const accessToken = signAccessToken({ userId: user.user_id, role: user.role })
  const refreshToken = signRefreshToken({ userId: user.user_id })

  await authRepository.saveRefreshToken({
    tokenHash: hashToken(refreshToken),
    userId: user.user_id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
  })

  return {
    accessToken,
    refreshToken,
    user: {
      userId: user.user_id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
    },
  }
}

/**
 * 로그인
 * @param {{ email: string, password: string }} param
 * @returns {{ accessToken: string, refreshToken: string, user: object }}
 */
export const login = async ({ email, password }) => {
  const user = await authRepository.findByEmail(email)
  if (!user) {
    throw Object.assign(new Error('이메일 또는 비밀번호가 올바르지 않습니다'), { status: 401 })
  }

  // 소프트삭제 계정 차단
  // (findByEmail 쿼리에서 deleted_at IS NULL 이미 필터링되나, 방어적으로 재확인)
  if (!user.password_hash) {
    throw Object.assign(new Error('이메일 또는 비밀번호가 올바르지 않습니다'), { status: 401 })
  }

  const isMatch = await bcrypt.compare(password, user.password_hash)
  if (!isMatch) {
    throw Object.assign(new Error('이메일 또는 비밀번호가 올바르지 않습니다'), { status: 401 })
  }

  if (!user.is_active) {
    throw Object.assign(new Error('비활성화된 계정입니다. 고객센터에 문의해주세요'), { status: 401 })
  }

  const accessToken = signAccessToken({ userId: user.user_id, role: user.role })
  const refreshToken = signRefreshToken({ userId: user.user_id })

  await authRepository.saveRefreshToken({
    tokenHash: hashToken(refreshToken),
    userId: user.user_id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
  })

  return {
    accessToken,
    refreshToken,
    user: {
      userId: user.user_id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
    },
  }
}

/**
 * Access token 갱신 (Refresh token rotation)
 * @param {string} refreshToken  — HttpOnly 쿠키에서 전달된 원본 토큰
 * @returns {{ accessToken: string, refreshToken: string, user: object }}
 */
export const refresh = async (refreshToken) => {
  // JWT 서명 검증
  let payload
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
  } catch {
    throw Object.assign(new Error('유효하지 않은 리프레시 토큰입니다'), { status: 401 })
  }

  const tokenHash = hashToken(refreshToken)
  const stored = await authRepository.findRefreshToken(tokenHash)

  if (!stored) {
    throw Object.assign(new Error('유효하지 않은 리프레시 토큰입니다'), { status: 401 })
  }

  if (stored.revoked_at) {
    throw Object.assign(new Error('이미 사용된 리프레시 토큰입니다'), { status: 401 })
  }

  if (new Date(stored.expires_at) < new Date()) {
    throw Object.assign(new Error('만료된 리프레시 토큰입니다'), { status: 401 })
  }

  const user = await authRepository.findByUserId(payload.userId)
  if (!user) {
    throw Object.assign(new Error('존재하지 않는 사용자입니다'), { status: 404 })
  }

  if (!user.is_active) {
    throw Object.assign(new Error('비활성화된 계정입니다'), { status: 401 })
  }

  // 기존 토큰 취소 (rotation)
  await authRepository.revokeRefreshToken(tokenHash)

  // 새 토큰 발급
  const newAccessToken = signAccessToken({ userId: user.user_id, role: user.role })
  const newRefreshToken = signRefreshToken({ userId: user.user_id })

  await authRepository.saveRefreshToken({
    tokenHash: hashToken(newRefreshToken),
    userId: user.user_id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
  })

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: {
      userId: user.user_id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
    },
  }
}

/**
 * 동의 항목 저장 (목록을 순차 upsert)
 * @param {string} userId
 * @param {Array<{ consentType: string, isAgreed: boolean }>} consents
 */
export const saveConsents = async (userId, consents) => {
  for (const { consentType, isAgreed } of consents) {
    await authRepository.upsertConsent(userId, consentType, isAgreed)
  }
}

/**
 * 로그아웃 — refresh token 취소
 * @param {string} refreshToken
 */
export const logout = async (refreshToken) => {
  if (!refreshToken) return

  const tokenHash = hashToken(refreshToken)
  await authRepository.revokeRefreshToken(tokenHash)
}
