/**
 * Kakao OAuth Service
 * 카카오 인증 URL 생성 및 콜백 처리 전용
 */

import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { signAccessToken, signRefreshToken, hashToken } from './authService.js'
import * as authRepository from './authRepository.js'

const REFRESH_TOKEN_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000 // 30일

// ─── OAuth state (CSRF 방지) ──────────────────────────────────────────────────
//
// 카카오 인가 URL에 state가 없으면, 공격자가 자기 계정의 인가 코드로 피해자를
// 콜백 URL로 유도해 피해자를 공격자 계정으로 로그인시킬 수 있다(로그인 CSRF).
// state를 서버가 생성해 HttpOnly 쿠키에 저장하고, 콜백에서 쿠키값과 쿼리값을
// 대조해 요청이 우리가 발급한 인가 URL에서 온 것인지 검증한다.

export const KAKAO_STATE_COOKIE = 'kakao_oauth_state'

// 콜백 실패 사유 구분용 구조적 마커(err.code) - 컨트롤러가 메시지가 아닌 이 값으로
// 리다이렉트 쿼리를 결정한다 (G12)
export const KAKAO_ERROR_CODE = {
  EMAIL_EXISTS: 'KAKAO_EMAIL_EXISTS',
  ACCOUNT_INACTIVE: 'KAKAO_ACCOUNT_INACTIVE',
}

export const KAKAO_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 5 * 60 * 1000, // 5분 - 로그인 왕복에 충분, 탈취 노출 시간 최소화
}

/**
 * CSRF 방지용 state 토큰 생성
 * @returns {string}
 */
export const generateKakaoState = () => crypto.randomBytes(32).toString('hex')

/**
 * 콜백에서 쿠키에 저장된 state와 쿼리로 전달된 state를 대조
 * 불일치·부재 시 401 에러를 throw한다 (컨트롤러는 catch 없이 next(err)로 위임하면 됨)
 * @param {string|undefined} cookieState - req.cookies[KAKAO_STATE_COOKIE]
 * @param {string|undefined} queryState  - req.query.state
 */
export const verifyKakaoState = (cookieState, queryState) => {
  if (!cookieState || !queryState || cookieState !== queryState) {
    throw Object.assign(
      new Error('유효하지 않은 로그인 요청입니다. 다시 시도해 주세요.'),
      { status: 401 },
    )
  }
}

/**
 * 카카오 인증 URL 반환
 * @param {string} state - generateKakaoState()로 생성해 쿠키에도 저장한 값
 * @returns {string}
 */
export const getKakaoAuthUrl = (state) => {
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_CLIENT_ID,
    redirect_uri: process.env.KAKAO_REDIRECT_URI,
    response_type: 'code',
    state,
  })
  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`
}

/**
 * 카카오 code → access_token 교환
 * @param {string} code
 * @returns {Promise<string>} kakao access token
 */
const exchangeCodeForToken = async (code) => {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.KAKAO_CLIENT_ID,
    client_secret: process.env.KAKAO_CLIENT_SECRET,
    redirect_uri: process.env.KAKAO_REDIRECT_URI,
    code,
  })

  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw Object.assign(
      new Error(`카카오 토큰 교환 실패 (${res.status}): ${errText}`),
      { status: 502 }
    )
  }

  const data = await res.json()
  return data.access_token
}

/**
 * 카카오 access token으로 사용자 정보 조회
 * @param {string} kakaoAccessToken
 * @returns {Promise<{ kakaoId: string, email: string|null, nickname: string }>}
 */
const fetchKakaoUserInfo = async (kakaoAccessToken) => {
  const res = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${kakaoAccessToken}` },
  })

  if (!res.ok) {
    const errText = await res.text()
    throw Object.assign(
      new Error(`카카오 사용자 정보 조회 실패 (${res.status}): ${errText}`),
      { status: 502 }
    )
  }

  const data = await res.json()

  const kakaoId = String(data.id)
  // users.email은 NOT NULL - 카카오 계정이 이메일 제공에 동의하지 않으면
  // kakao_account.email이 없다. users.email UNIQUE 제약과도 충돌하지 않도록
  // kakaoId를 포함한 플레이스홀더 이메일을 생성해 가입이 항상 성공하게 한다.
  const email = data.kakao_account?.email ?? `kakao_${kakaoId}@kakao.local`
  const nickname =
    data.kakao_account?.profile?.nickname ??
    data.properties?.nickname ??
    `카카오_${kakaoId.slice(-6)}`

  return { kakaoId, email, nickname }
}

/**
 * 카카오 콜백 처리
 * code → access_token → 사용자 정보 → DB 조회/생성 → JWT 발급
 *
 * @param {string} code  - 카카오에서 전달받은 인가 코드
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: object }>}
 */
export const handleKakaoCallback = async (code) => {
  // 1. code → kakao access token
  const kakaoAccessToken = await exchangeCodeForToken(code)

  // 2. kakao access token → 사용자 정보
  const { kakaoId, email, nickname } = await fetchKakaoUserInfo(kakaoAccessToken)

  // 3. DB 조회 - kakao_id 기준
  let user = await authRepository.findByKakaoId(kakaoId)

  // 4. 없으면 신규 가입
  if (!user) {
    const userId = uuidv4()
    try {
      user = await authRepository.createKakaoUser({ userId, kakaoId, email, nickname })
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err
      // 같은 카카오 계정의 동시 콜백이 먼저 가입시킨 경우(kakao_id UNIQUE)면 그 사용자로 진행
      user = await authRepository.findByKakaoId(kakaoId)
      if (!user) {
        // kakao_id가 아니라면 users.email UNIQUE 충돌 - 같은 이메일의 일반 계정이 이미 있다
        throw Object.assign(new Error('이미 같은 이메일로 가입된 계정이 있습니다'), {
          status: 409,
          code: KAKAO_ERROR_CODE.EMAIL_EXISTS,
        })
      }
    }
  }

  // 4-1. 비활성 계정 차단 (AUTH-1) - 일반 로그인(authService.login)과 동일 기준.
  // 토큰을 발급하지 않고, 컨트롤러가 code를 보고 토큰 없는 콜백으로 리다이렉트한다.
  if (!user.is_active) {
    throw Object.assign(new Error('비활성화된 계정입니다'), {
      status: 403,
      code: KAKAO_ERROR_CODE.ACCOUNT_INACTIVE,
    })
  }

  // 5. JWT 발급
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
