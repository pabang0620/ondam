/**
 * Auth Controller - 요청 파싱 + 응답 전담
 */

import * as authService from './authService.js'
import {
  getKakaoAuthUrl,
  handleKakaoCallback,
  generateKakaoState,
  verifyKakaoState,
  KAKAO_STATE_COOKIE,
  KAKAO_STATE_COOKIE_OPTIONS,
} from './kakaoAuthService.js'
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

    // [결함3 수정] adminController.refresh와 동일한 처리 - 다중 탭 그레이스 경로
    // (authService.refresh 참고)에서는 newRefreshToken이 null로 온다. 이 경우 쿠키를
    // 다시 심지 않는다 - 먼저 도착한 탭이 이미 심어둔 최신 rt 쿠키를 그대로 둬야 한다.
    // (여기서 무조건 res.cookie를 호출하면 값이 문자열 "null"로 직렬화되어 쿠키가
    // 깨진 토큰으로 덮어써진다.)
    if (newRefreshToken) {
      res.cookie(RT_COOKIE, newRefreshToken, RT_COOKIE_OPTIONS)
    }

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
 * CSRF 방지용 state를 생성해 HttpOnly 쿠키에 저장하고, 카카오 인증 URL로 리다이렉트
 */
export const kakaoLogin = (req, res) => {
  const state = generateKakaoState()
  res.cookie(KAKAO_STATE_COOKIE, state, KAKAO_STATE_COOKIE_OPTIONS)
  res.redirect(getKakaoAuthUrl(state))
}

/**
 * GET /api/auth/kakao/callback
 * state 검증(CSRF 방지) → 카카오 인가 코드 수신 → 토큰 교환 → 사용자 조회/생성 → 프론트 리다이렉트
 */
export const kakaoCallback = async (req, res, next) => {
  const frontUrl = process.env.CLIENT_URL || 'http://localhost:5173'

  const clearStateCookie = () =>
    res.clearCookie(KAKAO_STATE_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

  try {
    const { code, state } = req.query
    if (!code) {
      throw Object.assign(new Error('카카오 인증 코드가 없습니다'), { status: 400 })
    }

    try {
      verifyKakaoState(req.cookies?.[KAKAO_STATE_COOKIE], state)
    } catch (stateErr) {
      // state 불일치(위조·재사용 시도)를 원문 에러로 노출하지 않고, 프론트가 이미
      // 갖고 있는 실패 처리 경로(토큰 없는 콜백 → /login 리다이렉트,
      // KakaoCallbackPage.jsx)를 그대로 재사용한다 - token 프래그먼트를 붙이지 않는다
      clearStateCookie()
      return res.redirect(`${frontUrl}/auth/kakao/callback`)
    }

    clearStateCookie()

    const { accessToken, refreshToken, user } = await handleKakaoCallback(code)

    res.cookie(RT_COOKIE, refreshToken, RT_COOKIE_OPTIONS)

    res.redirect(`${frontUrl}/auth/kakao/callback#token=${accessToken}`)
  } catch (err) {
    next(err)
  }
}
