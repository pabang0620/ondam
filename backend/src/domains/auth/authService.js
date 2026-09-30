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

// [결함3 수정] adminService.js의 ADMIN_REFRESH_REUSE_GRACE_MS와 동일한 값·동일한
// 이름 관례(그 파일도 환경변수가 아니라 하드코딩된 상수다 - 새 메커니즘을 발명하지
// 않고 그대로 따른다). 다중 탭 동시 refresh 경쟁 유예 시간 - 같은 rt 쿠키로 거의
// 동시에 도착한 요청들 중 늦은 쪽이 "이미 회전된" 토큰을 드는 상황을 허용한다.
// 10초는 왕복 네트워크 지연을 넉넉히 덮으면서도, 실제 탈취 후 재사용 시나리오
// (공격자가 나중에 훔친 토큰을 쓰는 경우)에는 사실상 항상 지나 있을 만큼 짧다.
const REFRESH_REUSE_GRACE_MS = 10 * 1000

// 계정을 개설/이용하기 위한 최소 필수 동의(privacy=개인정보 처리방침, terms=이용약관).
// register()가 강제하는 기준이자, gift 도메인(giftPerformService.linkAccount)의
// 로그인 모드가 이 검사를 우회하지 못하도록 같은 기준을 재사용할 때도 쓴다
// (결함1: 로그인 모드는 이전에 이 검사를 전혀 거치지 않았다). 사진/영상 제작
// 시점에 필요한 콘텐츠별 동의(portrait/voice/ai_generation/posthumous_release)는
// 여기 포함하지 않는다 - 그건 photoService.assertPhotoConsents/willService의
// 기존 게이트가 이미 담당한다(중복 검사 방지).
export const REQUIRED_ACCOUNT_CONSENT_TYPES = ['privacy', 'terms']

// login()에서 사용자가 없을 때 비교용으로만 쓰는 더미 해시 (register와 같은 cost 12).
// 모듈 로드 시 1회 동기 생성 - 어떤 실제 비밀번호와도 대응하지 않는다.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12)

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
  // 필수 동의 체크 - privacy(개인정보) + terms(이용약관)
  // [2026-08-23] frontend/src/components/consent/consentItems.js의 SIGNUP_CONSENT_ITEMS
  // 주석(결정3, 2026-08-22)을 확인한 결과 "약관을 게시해도 동의가 선택이면 계약 편입이
  // 다투어질 수 있다"는 법무 검토로 terms도 필수 동의로 전환됐다(이전에는 privacy만
  // 필수). 같은 주석은 "GiftPerformPage.jsx가 이 배열을 [{type:'privacy'}]로 임의
  // 축소해 terms 필수 동의를 우회하던 문제"(결함B)를 프론트 SSOT 통합으로 고쳤다고
  // 명시한다 - 그러나 그 수정은 프론트 UI 레이어일 뿐, 서버가 여전히 privacy만
  // 검사하면 프론트를 거치지 않고 API를 직접 호출하는 경로(공식 우회 경로 - curl,
  // 다른 클라이언트 등)에서는 terms 없이도 가입이 그대로 통과한다. 이 결함 계열
  // (동의 검증을 프론트에만 의존)이 이번 작업 전체의 핵심 주제이므로 서버에도
  // 동일하게 적용한다.
  // [AUTH-5] 같은 type이 여러 번 오면 아래 필수 검사(find = 첫 항목)와 저장
  // (Map dedupe = 마지막 항목)의 기준이 어긋나, "첫 항목 privacy:true, 마지막 항목
  // privacy:false"로 필수 검사를 통과한 뒤 비동의로 저장될 수 있다. 모호한 요청은
  // 해석하지 않고 400으로 거부한다.
  const consentTypes = consents.map((c) => c.type)
  if (new Set(consentTypes).size !== consentTypes.length) {
    throw Object.assign(new Error('동의 항목에 중복된 유형이 있습니다'), { status: 400 })
  }

  const missingRequired = REQUIRED_ACCOUNT_CONSENT_TYPES.find((type) => {
    const found = consents.find((c) => c.type === type)
    return !found || !found.isAgreed
  })
  if (missingRequired) {
    const label = missingRequired === 'privacy' ? '개인정보 처리 방침' : '이용약관'
    throw Object.assign(new Error(`${label} 동의가 필요합니다`), { status: 400 })
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
  // [AUTH-4 주석 정정] 이 오류는 아래 트랜잭션에서 "필수 동의가 아닌 항목"(marketing)
  // 에 한해서만 흡수된다. terms는 REGISTER_HARD_FAIL_CONSENT_TYPES(필수)이므로 b 미적용
  // DB에서는 terms INSERT 실패로 트랜잭션이 롤백되어 가입이 실패(500)한다 - "마이그레이션
  // 적용 여부와 무관하게 항상 성공"하지 않는다. 운영 DB의 b 적용 여부는 코드에서 확인
  // 불가하므로 배포 전 별도 확인이 필요하다.
  const persistableConsents = consents.filter((c) => CONSENT_TYPE.includes(c.type))

  // 요청 내 type 중복은 위(AUTH-5)에서 이미 400으로 거부하므로 이 dedupe는 사실상
  // no-op이다. 방어적으로만 유지한다.
  const dedupedConsents = Array.from(
    new Map(persistableConsents.map((c) => [c.type, c])).values()
  )

  // DB가 아직 모르는 ENUM 값(migration b 미적용)으로 INSERT할 때 MySQL이 던지는 에러 코드
  const isEnumRejection = (err) =>
    err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' || err.errno === 1265

  // 필수 동의(consentItems.js SIGNUP_CONSENT_ITEMS 기준 privacy+terms required:true)
  // 저장 실패는 진짜 실패로 취급해 트랜잭션 전체를 롤백한다. 선택 동의(marketing 등)만
  // ENUM 미반영 오류에 한해 관대하게 건너뛴다.
  // [결함2 정리 - 2026-08-23] 이전에는 아래 saveConsents()의 동명 상수와 이름이
  // 같아(REQUIRED_CONSENT_TYPES) 값이 다른데도 혼동 위험이 있었다(함수 스코프라
  // 런타임 충돌은 없었지만 유지보수 시 오참조 위험). REGISTER_HARD_FAIL_CONSENT_TYPES로
  // 구분 - "가입 시 저장 실패를 하드 에러(트랜잭션 롤백)로 처리할 유형" 전용이다.
  const REGISTER_HARD_FAIL_CONSENT_TYPES = new Set(REQUIRED_ACCOUNT_CONSENT_TYPES)

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
        if (isEnumRejection(err) && !REGISTER_HARD_FAIL_CONSENT_TYPES.has(consent.type)) {
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
      // [2026-08-23] isConsentDup 분기는 user_consents가 append-only로 전환되며
      // (UNIQUE(user_id, consent_type) 제거) 사실상 도달 불가능해졌다 - dedupedConsents가
      // 이미 요청 내 중복 type을 걸러내고, DB에도 더 이상 그 조합에 UNIQUE 제약이
      // 없어 ER_DUP_ENTRY 자체가 나지 않는다. users.email UNIQUE 위반 케이스는 여전히
      // 유효하므로 분기 자체는 안전하게 남겨둔다(제거해도 이득이 없고, 미래에 다른
      // UNIQUE 제약이 추가될 가능성에 대한 방어적 코드로 유지).
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

  // 미존재 이메일·소셜 전용 계정(password_hash 없음)에서도 bcrypt 비교를 동일하게
  // 수행해 응답 시간 차이로 가입 여부가 드러나지 않게 한다 (타이밍 기반 계정 열거 방지)
  if (!user || !user.password_hash) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH)
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
    return handleRevokedRefreshReuse(stored)
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
  // [AUTH-9] 위의 findRefreshToken(SELECT)과 이 UPDATE 사이에 같은 토큰으로 온 다른
  // 요청이 먼저 revoke했다면 affectedRows가 0이다. 이때 그대로 새 토큰을 발급하면
  // 한 refresh token에서 두 개의 활성 토큰이 갈라진다. revoked_at을 다시 읽어 위와
  // 동일한 재사용 탐지 분기로 보낸다.
  const revokedCount = await authRepository.revokeRefreshToken(tokenHash)
  if (revokedCount === 0) {
    const latest = await authRepository.findRefreshToken(tokenHash)
    return handleRevokedRefreshReuse(latest ?? stored)
  }

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
 * 이미 revoke된 refresh token이 다시 제시됐을 때의 처리 (refresh() 전용)
 * @param {{ user_id: string, revoked_at: Date|string|null }} stored
 */
const handleRevokedRefreshReuse = async (stored) => {
  // [결함3 수정] adminService.refresh()와 동일한 회전 경쟁 유예 처리 - 다중 탭 동시
  // 마운트 시 같은 rt 쿠키로 refresh가 여러 번 나가면, 먼저 도착한 요청이 토큰을
  // 회전(revoke)시킨 직후 늦게 도착한 요청은 "이미 사용된" 토큰을 들게 된다. 토큰
  // 값만 보면 실제 탈취 재사용과 구분이 안 되므로, 아주 짧은 유예 시간(GRACE_MS)
  // 안의 재사용이면서 이 사용자의 활성(active) refresh token이 실제로 존재할
  // 때만 "경쟁으로 인한 재사용"으로 관용 처리한다. 유예를 벗어났거나 활성 토큰이
  // 없으면 진짜 탈취 재사용 가능성으로 간주해 하드 401을 던지고, 이 사용자의 모든
  // 활성 세션을 revoke한다(재사용 탐지 방어를 무력화하지 않기 위한 피해 확산
  // 차단 - 회전만으로는 "이미 도난된 다른 활성 토큰"을 막지 못하기 때문).
  const revokedAgoMs = Date.now() - new Date(stored.revoked_at).getTime()
  if (revokedAgoMs >= 0 && revokedAgoMs <= REFRESH_REUSE_GRACE_MS) {
    const activeToken = await authRepository.findActiveRefreshToken(stored.user_id)
    if (activeToken) {
      const activeUser = await authRepository.findByUserId(stored.user_id)
      if (activeUser && activeUser.is_active) {
        // 새 accessToken만 발급하고 refreshToken은 null로 돌려준다 - 컨트롤러가
        // 이를 보고 rt 쿠키를 다시 심지 않는다(먼저 도착한 탭이 이미 심어둔 최신
        // 쿠키를 그대로 유지해야 한다).
        return {
          accessToken: signAccessToken({ userId: activeUser.user_id, role: activeUser.role }),
          refreshToken: null,
          user: {
            userId: activeUser.user_id,
            email: activeUser.email,
            nickname: activeUser.nickname,
            role: activeUser.role,
          },
        }
      }
    }
  }

  await authRepository.revokeAllRefreshTokens(stored.user_id)
  throw Object.assign(new Error('이미 사용된 리프레시 토큰입니다'), { status: 401 })
}

// [보안 수정 - 2026-08-23] 초상권·음성권·AI 생성물·사후공개 동의는 photo/will
// 도메인의 AI 처리 게이트(photoService.createOrder/startProcessing,
// willService.activateWill, adminService.approveRelease)가 실제로 검사하는 값이다.
// 이 값의 저장이 조용히 실패하면(과거: ENUM 미반영 등) "동의했다고 응답은 받았지만
// 실제로는 저장되지 않은" 상태가 되어 사용자에게 혼란을 주고, 재시도 없이는
// 이후 AI 처리 단계에서 영문 모른 채 계속 차단당한다. privacy와 동일하게
// 이 목록의 유형은 저장 실패 시 요청 자체를 실패시킨다(register()의
// REGISTER_HARD_FAIL_CONSENT_TYPES와 같은 원칙, useJoin.js가 법무 검토 근거로 필수
// 표시한 항목 + WillConsentPage가 4종 전부를 "(필수)"로 요구하는 것과 일치).
// terms/marketing만 과거 ENUM drift 대비 관대 처리를 유지한다(선택 항목이라
// 저장 실패가 사용자의 서비스 이용을 막지 않음).
// [결함2 정리 - 2026-08-23] register()의 REGISTER_HARD_FAIL_CONSENT_TYPES(privacy+terms,
// 가입 전용)와 이름이 같았던(REQUIRED_CONSENT_TYPES) 상수를 분리했다. 이쪽은
// saveConsents() 전용 - "동의 저장(설정 화면 재동의 포함) 시 저장 실패를 하드
// 에러로 처리할 유형"이며 값도 다르다(privacy + 콘텐츠 동의 4종).
const CONTENT_CONSENT_HARD_FAIL_TYPES = new Set([
  'privacy', 'portrait', 'voice', 'ai_generation', 'posthumous_release',
])

/**
 * 동의 항목 저장 (목록을 순차 append-only INSERT)
 *
 * [2026-08-23] upsertConsent(ON DUPLICATE KEY UPDATE)를 더 이상 쓰지 않는다 -
 * user_consents가 append-only로 전환되면서(마이그레이션
 * 2026-08-23-consent-history-and-evidence) register()와 동일하게 createConsent를
 * 사용한다. 동의 행위마다 새 UUID(consent_id)로 새 행이 생기므로 이력이 보존되고,
 * voice_samples.consent_id 같은 참조가 재동의로 인해 끊어지지 않는다.
 * ip_address/user_agent도 register()와 동일하게 함께 기록한다(D5).
 *
 * CONTENT_CONSENT_HARD_FAIL_TYPES(위)에 해당하는 유형은 저장 실패 시 요청 전체를 실패시킨다
 * (D8 - 저장 실패를 조용히 삼키지 않는다). 그 외 유형(terms/marketing)만 과거
 * ENUM drift 대비 관대 처리(로그만 남기고 계속 진행)를 유지한다.
 * @param {string} userId
 * @param {Array<{ consentType: string, isAgreed: boolean }>} consents
 * @param {{ ipAddress: string|null, userAgent: string|null }} param2
 */
export const saveConsents = async (userId, consents, { ipAddress = null, userAgent = null } = {}) => {
  // 사용자 정의: DB가 아직 모르는 ENUM 값으로 INSERT할 때 MySQL이 던지는 에러 코드
  const isEnumRejection = (err) =>
    err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' || err.errno === 1265

  for (const { consentType, isAgreed } of consents) {
    try {
      await authRepository.createConsent({
        consentId: uuidv4(),
        userId,
        consentType,
        isAgreed,
        ipAddress,
        userAgent,
      })
    } catch (err) {
      if (isEnumRejection(err) && !CONTENT_CONSENT_HARD_FAIL_TYPES.has(consentType)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[authService.saveConsents] consent_type '${consentType}' 저장 실패` +
          `(DB ENUM 미반영 추정). 선택 항목이라 건너뛰고 나머지 동의 저장은 계속 진행. userId=${userId}`
        )
        continue
      }
      // 필수 동의 저장 실패(ENUM 거부 포함) 또는 그 외 모든 에러는 요청 자체를
      // 실패시킨다 - "저장됐다"는 성공 응답과 실제 DB 상태가 어긋나면 안 된다.
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
