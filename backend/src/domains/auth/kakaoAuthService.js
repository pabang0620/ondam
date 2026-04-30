/**
 * Kakao OAuth Service
 * 카카오 인증 URL 생성 및 콜백 처리 전용
 */

import { v4 as uuidv4 } from 'uuid'
import { signAccessToken, signRefreshToken, hashToken } from './authService.js'
import * as authRepository from './authRepository.js'

const REFRESH_TOKEN_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000 // 30일

/**
 * 카카오 인증 URL 반환
 * @returns {string}
 */
export const getKakaoAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_CLIENT_ID,
    redirect_uri: process.env.KAKAO_REDIRECT_URI,
    response_type: 'code',
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
  const email = data.kakao_account?.email ?? null
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
    user = await authRepository.createKakaoUser({ userId, kakaoId, email, nickname })
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
