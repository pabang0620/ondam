/**
 * Auth Service - 비즈니스 로직 전용
 */

import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import * as authRepository from './authRepository.js'
import pool from '../../config/db.js'
import { CONSENT_TYPE } from '../../../../shared/constants/enums.js'

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
 *
 * [보안 수정 - D10] payload가 { userId }뿐이면 iat가 초 단위 해상도라 같은 초에
 * refresh()의 rotation 경로(회전 시 새 refreshToken 재발급)가 두 번 호출되면(탭
 * 여러 개 동시 마운트 등) 완전히 동일한 JWT 문자열이 두 번 생성된다. 저장은
 * hashToken(SHA-256)한 뒤 refresh_tokens.token_hash UNIQUE 제약에 INSERT하므로,
 * 두 번째 INSERT가 그대로 충돌(409)해 회전이 사실상 no-op가 된다(RT1==RT2). jti
 * (요청마다 새로 만드는 랜덤 nonce)를 페이로드에 넣으면 같은 초에 발급돼도 항상
 * 다른 JWT 문자열이 되어 해시도 항상 달라진다 - 회전 로직 자체는 바꾸지 않는다.
 * @param {{ userId: string }} payload
 * @returns {string}
 */
export const signRefreshToken = (payload) =>
  jwt.sign({ ...payload, jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' })

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

  // 동의 이력 저장 대상 필터링
  // CONSENT_TYPE(shared/constants/enums.js)는 이미 'terms'/'marketing'을 포함한다 -
  // 마이그레이션 2026-08-21b가 DB ENUM에 이 두 값을 추가할 예정이라 앱 코드(SSOT)가
  // 먼저 갱신된 상태다(G1). 이 필터는 그 SSOT 기준으로만 거르므로, b 미적용 DB에서는
  // 여전히 INSERT 시 MySQL 1265(ER_TRUNCATED_WRONG_VALUE_FOR_FIELD)가 날 수 있다.
  // 이 오류는 아래 트랜잭션 내부에서 "필수 동의가 아닌 항목"에 한해 개별적으로
  // 흡수한다 - 마이그레이션 적용 여부와 무관하게 가입 자체는 항상 성공해야 한다.
  const persistableConsents = consents.filter((c) => CONSENT_TYPE.includes(c.type))

  // 같은 type이 배열에 중복되면 user_consents.uq_consents_user_type UNIQUE 위반으로
  // ER_DUP_ENTRY가 나고, 이를 구분 없이 처리하면 멀쩡한 이메일도 "이미 사용 중"으로
  // 오판될 수 있다. 저장 전 type 기준 중복을 제거해 애초에 그 충돌을 만들지 않는다
  // (나중 값이 우선 - 체크박스 최신 상태를 반영).
  const dedupedConsents = Array.from(
    new Map(persistableConsents.map((c) => [c.type, c])).values()
  )

  // DB가 아직 모르는 ENUM 값(migration b 미적용)으로 INSERT할 때 MySQL이 던지는 에러 코드
  const isEnumRejection = (err) =>
    err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' || err.errno === 1265

  // 필수 동의(useJoin.js 기준 privacy만 required:true) 저장 실패는 진짜 실패로 취급해
  // 트랜잭션 전체를 롤백한다. 선택 동의(terms/marketing 등)만 ENUM 미반영 오류에
  // 한해 관대하게 건너뛴다.
  const REQUIRED_CONSENT_TYPES = new Set(['privacy'])

  // 사용자 생성 + 동의 이력 저장을 단일 트랜잭션으로 묶는다 (G4).
  // Repository(authRepository.createUser/createConsent)가 옵셔널 conn을 받으므로
  // subscriptionRepository와 동일한 패턴으로 트랜잭션 conn을 넘겨 호출한다
  // (repository 데드코드화 방지).
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    try {
      await authRepository.createUser({ userId, email, nickname, passwordHash }, conn)
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw Object.assign(new Error('이미 사용 중인 이메일입니다'), { status: 409 })
      }
      throw err
    }

    for (const consent of dedupedConsents) {
      try {
        await authRepository.createConsent(
          {
            consentId: uuidv4(),
            userId,
            consentType: consent.type,
            isAgreed: consent.isAgreed,
            ipAddress,
            userAgent,
          },
          conn
        )
      } catch (err) {
        if (isEnumRejection(err) && !REQUIRED_CONSENT_TYPES.has(consent.type)) {
          // eslint-disable-next-line no-console
          console.warn(
            `[authService.register] consent_type '${consent.type}' 저장 실패` +
            `(DB ENUM 미반영 추정 - 마이그레이션 2026-08-21b 적용 여부 확인 필요).` +
            ` 건너뛰고 가입은 계속 진행. userId=${userId}`
          )
          continue
        }
        throw err
      }
    }

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    if (err.status) throw err // 위에서 이미 사용자 메시지로 태깅된 에러
    if (err.code === 'ER_DUP_ENTRY') {
      const isConsentDup = /consents|uq_consents_user_type/i.test(err.sqlMessage ?? '')
      throw isConsentDup
        ? Object.assign(new Error('동의 항목에 중복된 유형이 있습니다'), { status: 400 })
        : Object.assign(new Error('이미 사용 중인 이메일입니다'), { status: 409 })
    }
    throw err
  } finally {
    conn.release()
  }

  const user = await authRepository.findByUserId(userId)

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
 * @param {string} refreshToken  - HttpOnly 쿠키에서 전달된 원본 토큰
 * @returns {{ accessToken: string, refreshToken: string, user: object }}
 */
export const refresh = async (refreshToken) => {
  // JWT 서명 검증
  let payload
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] })
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
 *
 * register()와 동일한 이유로 관대 처리를 적용한다 - CONSENT_TYPE(SSOT)에는 이미
 * 'terms'/'marketing'이 포함돼 있지만 마이그레이션 2026-08-21b 적용 전 DB에서는
 * ENUM에 없어 upsertConsent가 MySQL 1265(ER_TRUNCATED_WRONG_VALUE_FOR_FIELD)로
 * 거부한다. 이 오류는 로그만 남기고 해당 항목만 건너뛴다 - 마이그레이션 b가
 * 적용되면 ENUM에 모든 값이 존재하므로 이 분기는 더 이상 발동하지 않고
 * 자연 소멸한다.
 *
 * register()와 달리 "필수 동의(privacy)가 실패하면 트랜잭션 전체를 롤백"하는
 * 게이트가 없다 - 이 엔드포인트는 이미 가입을 마친 사용자가 추가/변경 동의를
 * 저장하는 경로이고, privacy는 회원가입 시점에 이미 필수로 검증된 값이라
 * 여기서 다시 전송돼도 ENUM 거부를 유발하지 않는다(마이그레이션 b가 새로
 * 추가하는 값은 terms/marketing뿐). 따라서 이 엔드포인트에서는 항목별 필수
 * 여부를 구분하지 않고 전부 동일하게 관대 처리한다 - 한 항목의 저장 실패가
 * 나머지 항목이나 요청 전체를 막지 않는다.
 * @param {string} userId
 * @param {Array<{ consentType: string, isAgreed: boolean }>} consents
 */
export const saveConsents = async (userId, consents) => {
  // 사용자 정의: DB가 아직 모르는 ENUM 값으로 UPSERT할 때 MySQL이 던지는 에러 코드
  const isEnumRejection = (err) =>
    err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' || err.errno === 1265

  for (const { consentType, isAgreed } of consents) {
    try {
      await authRepository.upsertConsent(userId, consentType, isAgreed)
    } catch (err) {
      if (isEnumRejection(err)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[authService.saveConsents] consent_type '${consentType}' 저장 실패` +
          `(DB ENUM 미반영 추정 - 마이그레이션 2026-08-21b 적용 여부 확인 필요).` +
          ` 건너뛰고 나머지 동의 저장은 계속 진행. userId=${userId}`
        )
        continue
      }
      throw err
    }
  }
}

/**
 * 로그아웃 - refresh token 취소
 * @param {string} refreshToken
 */
export const logout = async (refreshToken) => {
  if (!refreshToken) return

  const tokenHash = hashToken(refreshToken)
  await authRepository.revokeRefreshToken(tokenHash)
}
