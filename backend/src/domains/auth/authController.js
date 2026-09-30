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
  KAKAO_ERROR_CODE,
} from './kakaoAuthService.js'
import { created, success } from '../../utils/response.js'

// 카카오 콜백 실패 시 프론트 /auth/kakao/callback?error=<값> 으로 전달하는 사유
const KAKAO_CALLBACK_ERROR = {
  CANCELLED: 'cancelled',       // 사용자가 카카오 동의 화면에서 취소 (code 없음)
  EMAIL_EXISTS: 'email_exists', // 같은 이메일의 일반 계정이 이미 존재
  INACTIVE: 'inactive',         // 비활성화된 계정
  FAILED: 'failed',             // 카카오 API 실패 등 그 외
}

// user 도메인(회원 탈퇴)에서도 같은 쿠키를 지우므로 export한다
export const RT_COOKIE = 'rt'
export const RT_COOKIE_PATH = '/api/auth'

const RT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: RT_COOKIE_PATH,
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
    // [AUTH-8] 토큰 자체가 무효(401)·사용자 없음(404)일 때만 쿠키를 지운다. DB 장애 등
    // 일시적 5xx에서 지우면 유효한 세션까지 강제 로그아웃된다.
    if (err.status === 401 || err.status === 404) {
      res.clearCookie(RT_COOKIE, { path: '/api/auth' })
    }
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
    const ipAddress = req.ip ?? req.headers['x-forwarded-for'] ?? null
    const userAgent = req.headers['user-agent'] ?? null
    await authService.saveConsents(userId, consents, { ipAddress, userAgent })
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
export const kakaoCallback = async (req, res) => {
  const frontUrl = process.env.CLIENT_URL || 'http://localhost:5173'

  const clearStateCookie = () =>
    res.clearCookie(KAKAO_STATE_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

  // [AUTH-6] 이 엔드포인트는 브라우저가 카카오에서 직접 이동해 오는 페이지라 JSON 에러
  // 응답을 보여주면 사용자가 원문 JSON 화면에 갇힌다. 모든 실패는 토큰 없이 프론트
  // 콜백으로 보내고 사유만 ?error= 쿼리로 전달한다.
  const redirectWithError = (reason) =>
    res.redirect(`${frontUrl}/auth/kakao/callback?error=${encodeURIComponent(reason)}`)

  const { code, state } = req.query
  if (!code) {
    // 사용자가 카카오 동의 화면에서 취소하면 code 없이 error=access_denied로 돌아온다
    clearStateCookie()
    return redirectWithError(KAKAO_CALLBACK_ERROR.CANCELLED)
  }

  try {
    verifyKakaoState(req.cookies?.[KAKAO_STATE_COOKIE], state)
  } catch {
    // state 불일치(위조·재사용 시도)를 원문 에러로 노출하지 않고, 프론트가 이미
    // 갖고 있는 실패 처리 경로(토큰 없는 콜백 → /login 리다이렉트,
    // KakaoCallbackPage.jsx)를 그대로 재사용한다 - token 프래그먼트를 붙이지 않는다
    clearStateCookie()
    return res.redirect(`${frontUrl}/auth/kakao/callback`)
  }

  clearStateCookie()

  try {
    const { accessToken, refreshToken } = await handleKakaoCallback(code)

    res.cookie(RT_COOKIE, refreshToken, RT_COOKIE_OPTIONS)

    return res.redirect(`${frontUrl}/auth/kakao/callback#token=${accessToken}`)
  } catch (err) {
    if (err.code === KAKAO_ERROR_CODE.EMAIL_EXISTS) {
      return redirectWithError(KAKAO_CALLBACK_ERROR.EMAIL_EXISTS)
    }
    if (err.code === KAKAO_ERROR_CODE.ACCOUNT_INACTIVE) {
      return redirectWithError(KAKAO_CALLBACK_ERROR.INACTIVE)
    }
    // 카카오 API 실패(502)·DB 오류 등 - 원문은 로그로만 남긴다 (G9-5)
    console.error('[authController.kakaoCallback] 카카오 로그인 실패:', err)
    return redirectWithError(KAKAO_CALLBACK_ERROR.FAILED)
  }
}
