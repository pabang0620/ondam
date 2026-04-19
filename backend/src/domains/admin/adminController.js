/**
 * Admin Controller — 요청 파싱 + 응답 전담
 */

import { v4 as uuidv4 } from 'uuid'
import * as adminService from './adminService.js'
import * as adminRepository from './adminRepository.js'
import { success, paginated } from '../../utils/response.js'

// ─── POST /api/admin/auth/login ───────────────────────────────────────────────

export const login = async (req, res, next) => {
  const { email, password } = req.body
  const ipAddress = req.ip ?? req.headers['x-forwarded-for'] ?? null
  const userAgent = req.headers['user-agent'] ?? null

  try {
    const result = await adminService.login(email, password)
    return success(res, result, '관리자 로그인 성공')
  } catch (err) {
    // 인증 실패(401)는 audit_logs에 기록 — 브루트포스 탐지용
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
