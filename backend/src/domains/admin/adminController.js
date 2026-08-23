/**
 * Admin Controller - 요청 파싱 + 응답 전담
 */

import { v4 as uuidv4 } from 'uuid'
import * as adminService from './adminService.js'
import * as adminRepository from './adminRepository.js'
import { success, paginated } from '../../utils/response.js'

// ─── 관리자 refresh token 쿠키 (phase0-followups B-3) ─────────────────────────
// 이름·path를 일반 사용자 쿠키('rt', path=/api/auth)와 겹치지 않게 구분한다.
// path를 관리자 auth 하위 경로로 좁혀 로그인/갱신/로그아웃 요청에만 실린다
// (다른 모든 /api/admin/* 요청에는 이 쿠키가 자동으로 붙지 않음 - G9-2 "관리자
// refresh는 일반 사용자보다 민감" 요구에 따른 최소 노출).
const ADMIN_RT_COOKIE = 'art'

const ADMIN_RT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7일 - 일반 사용자(30일)보다 짧게
  path: '/api/admin/auth',
}

// ─── POST /api/admin/auth/login ───────────────────────────────────────────────

export const login = async (req, res, next) => {
  const { email, password } = req.body
  const ipAddress = req.ip ?? req.headers['x-forwarded-for'] ?? null
  const userAgent = req.headers['user-agent'] ?? null

  try {
    const { accessToken, refreshToken, user } = await adminService.login(email, password)

    res.cookie(ADMIN_RT_COOKIE, refreshToken, ADMIN_RT_COOKIE_OPTIONS)

    return success(res, { accessToken, user }, '관리자 로그인 성공')
  } catch (err) {
    // 인증 실패(401)는 audit_logs에 기록 - 브루트포스 탐지용
    if (err.status === 401) {
      adminRepository.createAuditLog({
        logId: uuidv4(),
        actorId: null,
        actorType: 'anonymous',
        action: 'admin_login_failed',
        targetType: 'admin_user',
        targetId: null,
        ipAddress,
        userAgent,
        detail: { email },
      }).catch((auditErr) => {
        // audit 실패는 원본 에러 흐름을 막지 않음
        console.error('[audit] admin_login_failed 기록 실패:', auditErr)
      })
    }
    next(err)
  }
}

// ─── POST /api/admin/auth/refresh ─────────────────────────────────────────────
// Refresh token은 HttpOnly 쿠키 'art'에서 읽음 (Authorization 헤더 불필요)

export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.[ADMIN_RT_COOKIE]
    if (!token) {
      return next(Object.assign(new Error('리프레시 토큰이 없습니다'), { status: 401 }))
    }

    const { accessToken, refreshToken: newRefreshToken, user } = await adminService.refresh(token)

    // FIX: HIGH-3 - 다중 탭 그레이스 경로(adminService.refresh 참고)에서는
    // newRefreshToken이 null로 온다. 이 경우 쿠키를 다시 심지 않는다 - 먼저 도착한
    // 탭이 이미 심어둔 최신 art 쿠키를 그대로 둬야 한다.
    if (newRefreshToken) {
      res.cookie(ADMIN_RT_COOKIE, newRefreshToken, ADMIN_RT_COOKIE_OPTIONS)
    }

    return success(res, { accessToken, user }, '토큰 갱신 성공')
  } catch (err) {
    // FIX: MEDIUM-5 - 예전에는 어떤 에러(DB 순단 같은 일시적 5xx 포함)에서도 무조건
    // clearCookie를 실행해 일시적 장애만으로 관리자가 로그아웃됐다. 세션이 실제로
    // 무효하다고 확정된 경우(401: 서명불일치·만료·재사용탐지 / 404: 관리자 계정 없음)
    // 에만 쿠키를 지운다.
    if (err.status === 401 || err.status === 404) {
      res.clearCookie(ADMIN_RT_COOKIE, { path: '/api/admin/auth' })
    }
    next(err)
  }
}

// ─── POST /api/admin/auth/logout ──────────────────────────────────────────────
// HttpOnly 쿠키 'art' 클리어

export const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.[ADMIN_RT_COOKIE]
    await adminService.logout(token)

    res.clearCookie(ADMIN_RT_COOKIE, { path: '/api/admin/auth' })

    return success(res, null, '로그아웃 성공')
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/admin/dashboard ─────────────────────────────────────────────────

export const getDashboard = async (req, res, next) => {
  try {
    const stats = await adminService.getDashboard()
    return success(res, stats, '대시보드 통계 조회 성공')
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/admin/releases ──────────────────────────────────────────────────

export const getPendingReleases = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query
    const result = await adminService.getPendingReleases({
      page: Number(page),
      limit: Math.min(Number(limit), 100),
    })
    return paginated(res, result.requests, result.meta, '공개 요청 목록 조회 성공')
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/admin/releases/:id/document-url ─────────────────────────────────
// 사망증명서 열람용 presigned URL을 상세 열람 시점에 그때그때 발급한다 (목록 조회
// 시점에는 발급하지 않음 - 전건 발급은 낭비이고 불필요한 서명 URL을 늘린다)

export const getReleaseDocumentUrl = async (req, res, next) => {
  try {
    const { id } = req.params
    const adminId = req.user.adminId
    const ipAddress = req.ip ?? req.headers['x-forwarded-for'] ?? null
    const userAgent = req.headers['user-agent'] ?? null

    const result = await adminService.getReleaseDocumentUrl(adminId, id, { ipAddress, userAgent })
    return success(res, result, '사망증명서 열람 URL 발급 완료')
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/admin/releases/:id/approve ─────────────────────────────────────

export const approveRelease = async (req, res, next) => {
  try {
    const { id } = req.params
    const adminId = req.user.adminId
    const ipAddress = req.ip ?? req.headers['x-forwarded-for'] ?? null
    const userAgent = req.headers['user-agent'] ?? null

    const result = await adminService.approveRelease(adminId, id, { ipAddress, userAgent })
    return success(res, result, '공개 요청 승인 완료')
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/admin/releases/:id/reject ──────────────────────────────────────

export const rejectRelease = async (req, res, next) => {
  try {
    const { id } = req.params
    const { rejectReason } = req.body
    const adminId = req.user.adminId
    const ipAddress = req.ip ?? req.headers['x-forwarded-for'] ?? null
    const userAgent = req.headers['user-agent'] ?? null

    const result = await adminService.rejectRelease(adminId, id, rejectReason, {
      ipAddress,
      userAgent,
    })
    return success(res, result, '공개 요청 거절 완료')
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/admin/will/beneficiaries/:beneficiaryId/unlock (D13) ───────────

export const unlockWillWatch = async (req, res, next) => {
  try {
    const { beneficiaryId } = req.params
    const adminId = req.user.adminId
    const ipAddress = req.ip ?? req.headers['x-forwarded-for'] ?? null
    const userAgent = req.headers['user-agent'] ?? null

    const result = await adminService.unlockWillWatchAccess(adminId, beneficiaryId, {
      ipAddress,
      userAgent,
    })
    return success(res, result, '본인 확인 잠금이 해제되었습니다')
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/admin/orders ────────────────────────────────────────────────────

export const getOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, targetType } = req.query
    const result = await adminService.getOrders({
      page: Number(page),
      limit: Math.min(Number(limit), 100),
      status,
      targetType,
    })
    return paginated(res, result.orders, result.meta, '주문 목록 조회 성공')
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

export const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query
    const result = await adminService.getUsers({
      page: Number(page),
      limit: Math.min(Number(limit), 100),
      search,
    })
    return paginated(res, result.users, result.meta, '사용자 목록 조회 성공')
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/admin/notifications/failed ───────────────────────────────────────
// FIX D5 - 재시도 소진 후에도 발송에 실패한 알림(이메일/SMS)을 운영자가 조회할
// 수 있게 한다. audit_logs(action='notification_delivery_failed')가 소스.

export const getFailedNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query
    const result = await adminService.getFailedNotifications({
      page: Number(page),
      limit: Math.min(Number(limit), 100),
    })
    return paginated(res, result.failures, result.meta, '알림 발송 실패 목록 조회 성공')
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/admin/jobs/failed ───────────────────────────────────────────────

export const getFailedJobs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query
    const result = await adminService.getFailedJobs({
      page: Number(page),
      limit: Math.min(Number(limit), 100),
    })
    return paginated(res, result.jobs, result.meta, '실패 작업 목록 조회 성공')
  } catch (err) {
    next(err)
  }
}
