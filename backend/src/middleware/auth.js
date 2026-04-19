import jwt from 'jsonwebtoken'
import { unauthorized, forbidden } from '../utils/response.js'

/**
 * 로그인 필수 미들웨어
 * Authorization: Bearer <accessToken>
 */
export const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return unauthorized(res, '로그인이 필요합니다')

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, '토큰이 만료되었습니다. 다시 로그인해 주세요')
    }
    return unauthorized(res, '유효하지 않은 토큰입니다')
  }
}

/**
 * 관리자 전용 미들웨어
 * requireAuth 이후 사용
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) return unauthorized(res)
  if (req.user.role !== 'admin') return forbidden(res, '관리자만 접근 가능합니다')
  next()
}

/**
 * 선택적 인증 (비로그인도 통과, req.user만 채움)
 */
export const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET)
    } catch {
      req.user = null
    }
  }
  next()
}
