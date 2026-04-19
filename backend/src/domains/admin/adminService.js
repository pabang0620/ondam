import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import * as adminRepository from './adminRepository.js'
import { notificationQueue } from '../../jobs/queue.js'

// ─── 관리자 로그인 ────────────────────────────────────────────────────────────

export const login = async (email, password) => {
  const admin = await adminRepository.findAdminByEmail(email)
  if (!admin) {
    throw Object.assign(new Error('이메일 또는 비밀번호가 올바르지 않습니다'), { status: 401 })
  }

  const matched = await bcrypt.compare(password, admin.password_hash)
  if (!matched) {
    throw Object.assign(new Error('이메일 또는 비밀번호가 올바르지 않습니다'), { status: 401 })
  }

  if (!admin.is_active) {
    throw Object.assign(new Error('비활성화된 관리자 계정입니다'), { status: 401 })
  }

  const accessToken = jwt.sign(
    { adminId: admin.admin_id, role: 'admin', adminRole: admin.admin_role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' },
  )

  await adminRepository.updateLastLogin(admin.admin_id)

  return {
    accessToken,
    admin: {
      adminId: admin.admin_id,
      name: admin.name,
      adminRole: admin.admin_role,
    },
  }
}

// ─── 대시보드 ─────────────────────────────────────────────────────────────────

export const getDashboard = async () => {
  return adminRepository.getDashboardStats()
}

// ─── 유언 공개 요청 목록 (pending) ───────────────────────────────────────────

export const getPendingReleases = async ({ page, limit }) => {
  const offset = (page - 1) * limit
  const { requests, total } = await adminRepository.getPendingReleaseRequests({ limit, offset })
  return {
    requests,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

// ─── 유언 공개 승인 ───────────────────────────────────────────────────────────

export const approveRelease = async (adminId, requestId, { ipAddress, userAgent } = {}) => {
  const request = await adminRepository.findReleaseRequestById(requestId)
  if (!request) {
    throw Object.assign(new Error('공개 요청을 찾을 수 없습니다'), { status: 404 })
  }
  if (request.req_status !== 'pending') {
    throw Object.assign(
      new Error(`이미 처리된 요청입니다 (현재 상태: ${request.req_status})`),
      { status: 409 },
    )
  }

  await adminRepository.updateReleaseRequest(requestId, {
    reqStatus: 'approved',
    reviewedBy: adminId,
    reviewedAt: new Date(),
    rejectReason: null,
  })

  await adminRepository.updateWillReleaseStatus(request.will_id, 'released')

  // 유가족에게 알림 발송 큐 등록
  const beneficiaries = await adminRepository.findWillBeneficiaries(request.will_id)
  for (const beneficiary of beneficiaries) {
    await notificationQueue.add('release_approved', {
      type: 'will_released',
      userId: beneficiary.user_id,
      willId: request.will_id,
      requestId,
      recipientEmail: beneficiary.email,
      recipientPhone: beneficiary.phone,
    })
  }

  await adminRepository.createAuditLog({
    logId: uuidv4(),
    actorId: adminId,
    actorType: 'admin',
    action: 'will_release_approved',
    targetType: 'will_release_request',
    targetId: requestId,
    ipAddress,
    userAgent,
    detail: { willId: request.will_id, beneficiaryCount: beneficiaries.length },
  })

  return { requestId, status: 'approved' }
}

// ─── 유언 공개 거절 ───────────────────────────────────────────────────────────

export const rejectRelease = async (
  adminId,
  requestId,
  rejectReason,
  { ipAddress, userAgent } = {},
) => {
  const request = await adminRepository.findReleaseRequestById(requestId)
  if (!request) {
    throw Object.assign(new Error('공개 요청을 찾을 수 없습니다'), { status: 404 })
  }
  if (request.req_status !== 'pending') {
    throw Object.assign(
      new Error(`이미 처리된 요청입니다 (현재 상태: ${request.req_status})`),
      { status: 409 },
    )
  }

  await adminRepository.updateReleaseRequest(requestId, {
    reqStatus: 'rejected',
    reviewedBy: adminId,
    reviewedAt: new Date(),
    rejectReason,
  })

  await adminRepository.updateWillReleaseStatus(request.will_id, 'locked')

  await adminRepository.createAuditLog({
    logId: uuidv4(),
    actorId: adminId,
    actorType: 'admin',
    action: 'will_release_rejected',
    targetType: 'will_release_request',
    targetId: requestId,
    ipAddress,
    userAgent,
    detail: { willId: request.will_id, rejectReason },
  })

  return { requestId, status: 'rejected' }
}

// ─── 주문 목록 ────────────────────────────────────────────────────────────────

export const getOrders = async ({ page, limit, status, targetType }) => {
  const offset = (page - 1) * limit
  const { orders, total } = await adminRepository.getOrders({ limit, offset, status, targetType })
  return {
    orders,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

// ─── 사용자 목록 ──────────────────────────────────────────────────────────────

export const getUsers = async ({ page, limit, search }) => {
  const offset = (page - 1) * limit
  const { users, total } = await adminRepository.getUsers({ limit, offset, search })
  return {
    users,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

// ─── 실패 AI 작업 목록 ────────────────────────────────────────────────────────

export const getFailedJobs = async ({ page, limit }) => {
  const offset = (page - 1) * limit
  const { jobs, total } = await adminRepository.getFailedJobs({ limit, offset })
  return {
    jobs,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}
