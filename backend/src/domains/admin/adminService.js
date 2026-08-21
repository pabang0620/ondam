import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import * as adminRepository from './adminRepository.js'
import { notificationQueue } from '../../jobs/queue.js'
import pool from '../../config/db.js'

// 사후 공개 알림 문구 (SPEC-04 5절 - 민감 발송 문구 원칙)
// 죽음을 직접 언급하는 단어를 최소화하고, 열람을 강요하지 않는 톤을 쓴다.
const RELEASE_EMAIL_SUBJECT = '온담 - 소중한 분이 남긴 영상이 도착했습니다'
const buildReleaseMessage = (recipientName) =>
  `${recipientName ? recipientName + '님, ' : ''}소중한 분이 남긴 영상이 도착했습니다. 마음의 준비가 되실 때 열어보세요.`

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
  // [DEV-26 수정] notificationWorker의 dispatch는 type ∈ {'sms','email','push'} +
  // {to, message} 형태를 기대하는데, 프로듀서가 {type:'will_released', userId, ...}
  // 형태로 넣고 있어 항상 default 분기("알 수 없는 알림 타입")에서 예외가 나 3회
  // 재시도 후 실패 - 이메일/SMS 발송이 0건이었다. 워커 계약에 맞춰 enqueue한다.
  const beneficiaries = await adminRepository.findWillBeneficiaries(request.will_id)
  for (const beneficiary of beneficiaries) {
    // findWillBeneficiaries는 wb(will_beneficiaries)와 u(users)를 LEFT JOIN한다.
    // 비회원 수혜자는 u쪽이 전부 NULL이므로 wb 쪽 값(beneficiary_email/phone)으로
    // 폴백한다. email은 will_beneficiaries에서 NOT NULL이라 항상 값이 있다.
    const recipientEmail = beneficiary.email ?? beneficiary.beneficiary_email
    const recipientPhone = beneficiary.phone ?? beneficiary.beneficiary_phone
    const message = buildReleaseMessage(beneficiary.name)

    try {
      if (recipientEmail) {
        await notificationQueue.add('release_approved', {
          type: 'email',
          to: recipientEmail,
          subject: RELEASE_EMAIL_SUBJECT,
          message,
        })
      }
      if (recipientPhone) {
        await notificationQueue.add('release_approved', {
          type: 'sms',
          to: recipientPhone,
          message,
        })
      }

      // in-app 알림도 함께 기록한다. 비회원 수혜자는 beneficiary.user_id가 null이므로
      // (users 테이블에 계정이 없음) in-app 알림 대상이 아니다 - 건너뛰고 에러 내지 않는다.
      if (beneficiary.user_id) {
        await pool.execute(
          `INSERT INTO notifications
             (notification_id, user_id, notification_type, target_type, target_id, title, message, created_at)
           VALUES (?, ?, 'will_released', 'will', ?, '영상이 도착했습니다', ?, NOW())`,
          [uuidv4(), beneficiary.user_id, request.will_id, message]
        )
      }
    } catch (notifyErr) {
      // 알림 발송 실패가 공개 승인 자체(감사 로그 포함)를 막지 않는다 (G6, 비차단)
      console.error(
        `[adminService] 유가족 알림 처리 실패 (승인은 유지) beneficiaryId=${beneficiary.beneficiary_id}:`,
        notifyErr.message
      )
    }
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
