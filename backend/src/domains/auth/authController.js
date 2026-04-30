/**
 * Auth Controller - 요청 파싱 + 응답 전담
 */

import * as authService from './authService.js'
import { getKakaoAuthUrl, handleKakaoCallback } from './kakaoAuthService.js'
import { created, success } from '../../utils/response.js'

const RT_COOKIE = 'rt'

const RT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
}

/**
 * POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { email, password, nickname, consents } = req.body
    const ipAddress = req.ip ?? req.headers['x-forwarded-for'] ?? null
    const userAgent = req.headers['user-agent'] ?? null

    const { accessToken, refreshToken, user } = await authService.register({
      email,
      password,
      nickname,
      consents,
      ipAddress,
      userAgent,
    })

    res.cookie(RT_COOKIE, refreshToken, RT_COOKIE_OPTIONS)

    return created(res, { accessToken, user }, '회원가입 성공')
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    const { accessToken, refreshToken, user } = await authService.login({ email, password })

    res.cookie(RT_COOKIE, refreshToken, RT_COOKIE_OPTIONS)

    return success(res, { accessToken, user }, '로그인 성공')
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/refresh
 * Refresh token은 HttpOnly 쿠키 'rt'에서 읽음
 */
export const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.[RT_COOKIE]
    if (!token) {
      return next(Object.assign(new Error('리프레시 토큰이 없습니다'), { status: 401 }))
    }

    const { accessToken, refreshToken: newRefreshToken, user } = await authService.refresh(token)

    res.cookie(RT_COOKIE, newRefreshToken, RT_COOKIE_OPTIONS)

    return success(res, { accessToken, user }, '토큰 갱신 성공')
  } catch (err) {
    res.clearCookie(RT_COOKIE, { path: '/api/auth' })
    next(err)
  }
}

/**
 * POST /api/auth/logout
 * HttpOnly 쿠키 'rt' 클리어
 */
export const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.[RT_COOKIE]
    await authService.logout(token)

    res.clearCookie(RT_COOKIE, { path: '/api/auth' })

    return success(res, null, '로그아웃 성공')
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/consents
 * 동의 항목 저장 (portrait, voice, ai_generation, posthumous_release)
 */
export const saveConsents = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { consents } = req.body
    await authService.saveConsents(userId, consents)
    return success(res, null, '동의 정보가 저장되었습니다')
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/auth/kakao
 * 카카오 인증 URL로 리다이렉트
 */
export const kakaoLogin = (req, res) => {
  const url = getKakaoAuthUrl()
  res.redirect(url)
}

/**
 * GET /api/auth/kakao/callback
 * 카카오 인가 코드 수신 → 토큰 교환 → 사용자 조회/생성 → 프론트 리다이렉트
 */
export const kakaoCallback = async (req, res, next) => {
  try {
    const { code } = req.query
    if (!code) {
      throw Object.assign(new Error('카카오 인증 코드가 없습니다'), { status: 400 })
    }

    const { accessToken, refreshToken, user } = await handleKakaoCallback(code)

    res.cookie(RT_COOKIE, refreshToken, RT_COOKIE_OPTIONS)

    const frontUrl = process.env.CLIENT_URL || 'http://localhost:5173'
    res.redirect(`${frontUrl}/auth/kakao/callback#token=${accessToken}`)
  } catch (err) {
    next(err)
  }
}
