import jwt from 'jsonwebtoken'
import { unauthorized, forbidden } from '../utils/response.js'

// 관리자 라우터 마운트 경로(server.js `app.use('/api/admin', adminRoutes)`).
// 관리자 토큰({adminId, role:'admin', adminRole})은 이 라우터 안에서만 requireAuth를 통과한다.
const ADMIN_BASE_PATH = '/api/admin'

/**
 * Authorization 헤더에서 Bearer 스킴 토큰만 추출한다 (다른 스킴은 토큰 없음으로 취급)
 */
const extractBearerToken = (req) => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ')
  return scheme === 'Bearer' && token ? token : null
}

const isAdminRouter = (req) =>
  req.baseUrl === ADMIN_BASE_PATH || Boolean(req.baseUrl?.startsWith(`${ADMIN_BASE_PATH}/`))

/**
 * 로그인 필수 미들웨어
 * Authorization: Bearer <accessToken>
 *
 * 사용자 라우트에서는 사용자 토큰({userId, role})만 통과시킨다. userId가 없는 토큰
 * (관리자 토큰)은 401 - 그대로 두면 req.user.userId가 undefined인 채 서비스 계층까지
 * 흘러간다. 관리자 라우터(/api/admin)는 requireAuth → requireAdmin 조합을 쓰므로
 * 그 안에서만 adminId 토큰을 통과시키고, 실제 관리자 판정은 requireAdmin이 한다.
 */
export const requireAuth = (req, res, next) => {
  const token = extractBearerToken(req)
  if (!token) return unauthorized(res, '로그인이 필요합니다')

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
    const isAdminToken = !decoded.userId && Boolean(decoded.adminId)
    if (!decoded.userId && !(isAdminToken && isAdminRouter(req))) {
      return unauthorized(res, '유효하지 않은 토큰입니다')
    }
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
 * role 문자열만으로는 판정하지 않는다 - 관리자 토큰에만 있는 adminId가 있어야 통과한다.
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) return unauthorized(res)
  if (!req.user.adminId || req.user.role !== 'admin') {
    return forbidden(res, '관리자만 접근 가능합니다')
  }
  next()
}

/**
 * 선택적 인증 (비로그인도 통과, req.user만 채움)
 * 사용자 토큰(userId 보유)만 인정한다 - 관리자 토큰·다른 스킴은 비로그인으로 취급.
 */
export const optionalAuth = (req, res, next) => {
  const token = extractBearerToken(req)
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
      req.user = decoded.userId ? decoded : null
    } catch {
      req.user = null
    }
  }
  next()
}
