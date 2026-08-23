import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import * as adminRepository from './adminRepository.js'
import { notificationQueue } from '../../jobs/queue.js'
import { getPresignedUrl } from '../../utils/s3.js'
import pool from '../../config/db.js'
// [FIX D13] 잠금 해제는 will 도메인의 Redis 키 포맷(watchLockKey/watchAttemptsKey)을
// 그대로 재사용해야 하므로 willService에서 가져온다 - gift 도메인이 payment/auth/
// notification 서비스를 서비스-대-서비스로 직접 import하는 기존 관례(giftService.js,
// giftPerformService.js)와 동일한 패턴이다.
import { watchLockKey, watchAttemptsKey } from '../will/willService.js'
import * as willRepository from '../will/willRepository.js'
import redis from '../../config/redis.js'

// 사망증명서 열람용 presigned URL 만료(초). "몇 분~1시간" 요구 중 짧은 쪽을 택함 -
// 검수 화면 특성상 관리자가 문서를 열고 대조하는 데 필요한 시간은 대부분 수 분
// 이내이고, 링크가 새 탭에 남아있는 동안의 노출 창을 최소화하는 쪽이 사망증명서
// 같은 최고 민감도 서류엔 더 안전하다(G7-1: AWS SigV4 최대 7일, 과거 90일로 걸어
// 실패한 이력이 있으므로 절대 그 근처로 가지 않는다).
const DEATH_CERT_URL_EXPIRES_SEC = 10 * 60 // 10분

// ─── 관리자 세션 토큰 (phase0-followups B-3) ─────────────────────────────────
//
// 일반 사용자(authService.js)와 동일한 패턴: accessToken은 짧게, refreshToken은
// rotation 방식으로 발급하고 HttpOnly 쿠키로만 전달한다. 관리자는 일반 사용자보다
// 민감하므로 refresh 수명을 더 짧게 둔다(7일 vs 사용자 30일).
const ADMIN_ACCESS_TOKEN_EXPIRES = '15m'
const ADMIN_REFRESH_TOKEN_EXPIRES = '7d'
const ADMIN_REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000

// FIX: HIGH-3 - 다중 탭 동시 refresh 경쟁 유예 시간. 관리자 패널은 탭 여러 개 사용이
// 흔하므로, 같은 art 쿠키로 거의 동시에 도착한 요청들 중 늦은 쪽이 "이미 회전된" 토큰을
// 드는 상황을 허용한다. 10초는 왕복 네트워크 지연을 넉넉히 덮으면서도, 실제 탈취 후
// 재사용 시나리오(공격자가 나중에 훔친 토큰을 쓰는 경우)에는 사실상 항상 지나 있을
// 만큼 짧다.
const ADMIN_REFRESH_REUSE_GRACE_MS = 10 * 1000

// 관리자 refresh token 서명 secret. 일반 사용자와 동일한 JWT_REFRESH_SECRET을
// 재사용한다(스키마 변경 없이 진행하기 위해 새 필수 환경변수를 요구하지 않음 -
// backend/src/config/validateEnv.js는 이 작업 범위 밖). payload 구조(adminId vs
// userId)가 다르므로 뒤섞여도 상대 로직에서 조회 대상이 없어 실패할 뿐 권한 상승은
// 없다. 더 강한 격리가 필요하면 JWT_ADMIN_REFRESH_SECRET을 신설하고 여기서
// `process.env.JWT_ADMIN_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET`로
// 폴백하도록 바꾸는 후속 작업을 권장한다(그 자체는 스키마 변경이 아님).
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

const signAdminAccessToken = (admin) =>
  jwt.sign(
    { adminId: admin.admin_id, role: 'admin', adminRole: admin.admin_role },
    process.env.JWT_SECRET,
    { expiresIn: ADMIN_ACCESS_TOKEN_EXPIRES },
  )

// [보안 수정 - D10] payload가 { adminId }뿐이면 iat가 초 단위 해상도라 같은 초에
// refresh()의 rotation 경로가 두 번 호출되면(관리자 패널 탭 여러 개 동시 마운트 등)
// 완전히 동일한 JWT 문자열이 두 번 생성된다. 저장은 hashToken(SHA-256)한 뒤
// refresh_tokens.token_hash UNIQUE 제약에 INSERT하므로, 두 번째 INSERT가 그대로
// 충돌(409)해 회전이 사실상 no-op가 된다(RT1==RT2, 위 ADMIN_REFRESH_REUSE_GRACE_MS
// 유예 로직은 이 충돌 자체를 막지 않고 사후 관용 처리만 한다). jti(요청마다 새로
// 만드는 랜덤 nonce)를 페이로드에 넣으면 같은 초에 발급돼도 항상 다른 JWT
// 문자열이 되어 해시도 항상 달라진다.
const signAdminRefreshToken = (admin) =>
  jwt.sign(
    { adminId: admin.admin_id, jti: crypto.randomUUID() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: ADMIN_REFRESH_TOKEN_EXPIRES },
  )

const toSessionUser = (admin) => ({
  adminId: admin.admin_id,
  email: admin.email,
  name: admin.name,
  role: 'admin', // 프론트 AdminLayout/AdminLoginPage 가드가 user.role === 'admin'을 확인한다
  adminRole: admin.admin_role,
})

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

  const accessToken = signAdminAccessToken(admin)
  const refreshToken = signAdminRefreshToken(admin)

  await adminRepository.saveAdminRefreshToken({
    tokenHash: hashToken(refreshToken),
    adminId: admin.admin_id,
    expiresAt: new Date(Date.now() + ADMIN_REFRESH_TOKEN_EXPIRES_MS),
  })

  await adminRepository.updateLastLogin(admin.admin_id)

  return {
    accessToken,
    refreshToken,
    user: toSessionUser(admin),
  }
}

// ─── 관리자 토큰 갱신 (Refresh token rotation) ─────────────────────────────────
// authService.refresh()와 동일한 회전·재사용 탐지 패턴: 매 갱신마다 기존 토큰을
// revoke하고 새 토큰을 발급한다. 이미 revoke된(=한 번 사용된) 토큰이 다시 들어오면
// 탈취·재사용 시도로 간주해 401로 거부한다.
export const refresh = async (refreshToken) => {
  let payload
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] })
  } catch {
    throw Object.assign(new Error('유효하지 않은 리프레시 토큰입니다'), { status: 401 })
  }

  // FIX: MEDIUM-4 - 이전에는 payload.adminId가 undefined여도(예: 일반 사용자 refresh
  // 토큰 {userId: ...}가 여기 잘못 제출된 경우) mysql2가 undefined -> NULL로 바꿔
  // 0행이 되는 "드라이버 동작"에만 안전성이 의존했다. 드라이버 동작이 바뀌면 이 안전성이
  // 무너지므로, 관리자 토큰 형태(adminId 보유)임을 명시적으로 검증한다. 대칭인 일반
  // 사용자 쪽 authService.refresh()의 payload.userId 가드 유무는 별도 보고 대상
  // (이 파일 범위에서는 수정하지 않음).
  if (!payload.adminId) {
    throw Object.assign(new Error('유효하지 않은 리프레시 토큰입니다'), { status: 401 })
  }

  const tokenHash = hashToken(refreshToken)
  const stored = await adminRepository.findAdminRefreshToken(tokenHash)

  if (!stored) {
    throw Object.assign(new Error('유효하지 않은 리프레시 토큰입니다'), { status: 401 })
  }
  if (stored.revoked_at) {
    // FIX: HIGH-3 - 다중 탭 동시 마운트 시 같은 art 쿠키로 refresh가 2회 나가면, 먼저
    // 도착한 요청이 토큰을 회전(revoke)시킨 직후 늦게 도착한 요청은 "이미 사용된" 토큰을
    // 들게 된다. 토큰 값만 보면 실제 탈취 재사용과 구분이 안 되므로, 아주 짧은 유예
    // 시간(GRACE_MS) 안의 재사용이면서 이 admin의 활성(active) refresh token이 실제로
    // 존재할 때만 "경쟁으로 인한 재사용"으로 관용 처리한다. 유예를 벗어났거나 활성
    // 토큰이 없으면 진짜 탈취 재사용 가능성으로 간주해 하드 401을 던지고, 이 admin의
    // 모든 활성 세션을 revoke한다(재사용 탐지 방어를 무력화하지 않기 위한 피해 확산
    // 차단 - 회전만으로는 "이미 도난된 다른 활성 토큰"을 막지 못하기 때문).
    const revokedAgoMs = Date.now() - new Date(stored.revoked_at).getTime()
    if (revokedAgoMs >= 0 && revokedAgoMs <= ADMIN_REFRESH_REUSE_GRACE_MS) {
      const activeToken = await adminRepository.findActiveAdminRefreshToken(payload.adminId)
      if (activeToken) {
        const admin = await adminRepository.findAdminById(payload.adminId)
        if (admin && admin.is_active) {
          // 새 accessToken만 발급하고 refreshToken은 null로 돌려준다 - 컨트롤러가
          // 이를 보고 art 쿠키를 다시 심지 않는다(먼저 도착한 탭이 이미 심어둔 최신
          // 쿠키를 그대로 유지해야 한다).
          return {
            accessToken: signAdminAccessToken(admin),
            refreshToken: null,
            user: toSessionUser(admin),
          }
        }
      }
    }

    await adminRepository.revokeAllAdminRefreshTokens(payload.adminId)
    throw Object.assign(new Error('이미 사용된 리프레시 토큰입니다'), { status: 401 })
  }
  if (new Date(stored.expires_at) < new Date()) {
    throw Object.assign(new Error('만료된 리프레시 토큰입니다'), { status: 401 })
  }

  const admin = await adminRepository.findAdminById(payload.adminId)
  if (!admin) {
    throw Object.assign(new Error('존재하지 않는 관리자입니다'), { status: 404 })
  }
  if (!admin.is_active) {
    throw Object.assign(new Error('비활성화된 관리자 계정입니다'), { status: 401 })
  }

  // 기존 토큰 취소 (rotation)
  await adminRepository.revokeAdminRefreshToken(tokenHash)

  const newAccessToken = signAdminAccessToken(admin)
  const newRefreshToken = signAdminRefreshToken(admin)

  await adminRepository.saveAdminRefreshToken({
    tokenHash: hashToken(newRefreshToken),
    adminId: admin.admin_id,
    expiresAt: new Date(Date.now() + ADMIN_REFRESH_TOKEN_EXPIRES_MS),
  })

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: toSessionUser(admin),
  }
}

// ─── 관리자 로그아웃 - refresh token 취소 ──────────────────────────────────────
export const logout = async (refreshToken) => {
  if (!refreshToken) return
  await adminRepository.revokeAdminRefreshToken(hashToken(refreshToken))
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

// ─── 사망증명서 열람 (presigned URL, 상세 열람 시점 발급) ─────────────────────────
// SPEC-06 2절: "사망증명서 뷰어(KMS 복호화 열람, 열람 자체가 audit_logs 기록)".
// death_cert_url 컬럼(영구 버킷 URL)은 절대 그대로 내려주지 않고, death_cert_s3_key로
// 그때그때 짧은 만료의 presigned URL을 새로 발급한다. DB에 저장된 death_cert_url
// 값 자체는 건드리지 않는다(기존 데이터 보존).
export const getReleaseDocumentUrl = async (adminId, requestId, { ipAddress, userAgent } = {}) => {
  const request = await adminRepository.findReleaseRequestById(requestId)
  if (!request) {
    throw Object.assign(new Error('공개 요청을 찾을 수 없습니다'), { status: 404 })
  }

  const url = await getPresignedUrl(request.death_cert_s3_key, DEATH_CERT_URL_EXPIRES_SEC)

  // 증빙 열람 자체가 audit 기록 대상 (SPEC-06 2절, 수용 기준 2) - 승인/반려 여부와
  // 무관하게 "누가 언제 이 사망증명서를 열어봤는지" 자체가 감사 대상이다.
  await adminRepository.createAuditLog({
    logId: uuidv4(),
    actorId: adminId,
    actorType: 'admin',
    action: 'will_release_document_viewed',
    targetType: 'will_release_request',
    targetId: requestId,
    ipAddress,
    userAgent,
    detail: { willId: request.will_id },
  })

  return { url, expiresInSeconds: DEATH_CERT_URL_EXPIRES_SEC }
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

  // [보안 수정 - 사후 공개 동의 게이트] 이 승인이 실제로 "사망 확인 후 유가족에게
  // 영상을 공개"하는 행위 자체다(CLAUDE.md §3). WillConsentPage가 유언장 소유자
  // (고인)에게 사전에 받은 posthumous_release 동의가 없으면, 유가족이 사망증명서를
  // 제출했더라도 관리자가 공개를 승인할 수 없다 - 이 동의는 요청자(유가족)가 아니라
  // 영상 소유자 본인의 동의이므로 request.will_id로 will을 조회해 will.user_id
  // 기준으로 확인한다.
  const will = await willRepository.findWillById(request.will_id)
  if (!will) {
    throw Object.assign(new Error('영상 편지를 찾을 수 없습니다'), { status: 404 })
  }
  const releaseConsent = await willRepository.findPosthumousReleaseConsent(will.user_id)
  if (!releaseConsent || releaseConsent.is_agreed !== 1) {
    throw Object.assign(
      new Error('사후 공개 동의가 확인되지 않아 공개를 승인할 수 없습니다'),
      { status: 400 },
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
  //
  // [FIX D5, 2026-08-23] delivered_at을 "큐 등록 성공" 시점에 여기서 기록하지 않는다.
  // Gmail/Coolsms 환경변수가 없으면 워커가 3회 재시도 후 전부 실패하는데도 DB에는
  // "전달됨"으로 남아 실제로는 아무것도 안 나간 상태를 거짓으로 기록하는 사고가 있었다.
  // 마이그레이션 c README 3-1절 정의("유가족에게 실제로 알림이 발송된 시각")와
  // 4절 6번의 "catch 분기에서는 기록 금지"라는 원칙은 유지하되, 그 "성공"의 기준을
  // 큐 등록이 아니라 실제 발송 완료(워커의 'completed' 이벤트)로 옮긴다. 그러려면
  // 워커가 어떤 수신인 것인지 알아야 하므로 beneficiaryId를 잡 데이터에 함께 싣는다.
  // 실제 기록 지점은 notificationWorker.js의 markBeneficiaryDelivered 참고.
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
          beneficiaryId: beneficiary.beneficiary_id,
        })
      }
      if (recipientPhone) {
        await notificationQueue.add('release_approved', {
          type: 'sms',
          to: recipientPhone,
          message,
          beneficiaryId: beneficiary.beneficiary_id,
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

// ─── 유가족 본인확인 잠금 해제 (D13) ────────────────────────────────────────────
// SPEC-05 2절은 "5회 오입력 시 24시간 잠금 → 고객센터 문의"까지만 정의했고, 해제
// 수단은 24시간 자동 만료뿐이었다 - 고인의 영상 편지를 열람하지 못하는 유가족이
// 하루를 그냥 기다려야 하는 상황이라 검수 담당 관리자가 즉시 풀어줄 수 있게 한다.
//
// 권한: SPEC-06 1절 매트릭스에 이 잠금(will_watch 흐름)을 위한 전용 행은 없지만,
// 같은 흐름의 사망증명서 검수·공개 승인/반려(위 approveRelease/rejectRelease)를
// super_admin·content_moderator(reviewer)로 제한하고 있어 동일한 "검수 담당" 업무로
// 묶어 requireAdminRole('super', 'reviewer')를 그대로 적용한다(adminRoutes.js).
// payment_specialist(manager)는 결제·집행 데이터 담당이라 이 업무와 무관하다.
export const unlockWillWatchAccess = async (adminId, beneficiaryId, { ipAddress, userAgent } = {}) => {
  const beneficiary = await adminRepository.findBeneficiaryById(beneficiaryId)
  if (!beneficiary) {
    throw Object.assign(new Error('수신인을 찾을 수 없습니다'), { status: 404 })
  }

  await redis.del(watchLockKey(beneficiary.beneficiary_id))
  // 잠금뿐 아니라 시도 횟수도 함께 초기화한다 - 시도 횟수만 남아있으면 해제 직후
  // 정답을 한 번만 틀려도 즉시 5회에 도달해 재잠금되어 해제가 사실상 무의미해진다.
  await redis.del(watchAttemptsKey(beneficiary.beneficiary_id))

  await adminRepository.createAuditLog({
    logId: uuidv4(),
    actorId: adminId,
    actorType: 'admin',
    action: 'will_watch_admin_unlocked',
    targetType: 'will_beneficiary',
    targetId: beneficiary.beneficiary_id,
    ipAddress,
    userAgent,
    detail: { willId: beneficiary.will_id },
  })

  return { beneficiaryId: beneficiary.beneficiary_id, unlocked: true }
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

// ─── 알림 발송 최종 실패 목록 (FIX D5) ─────────────────────────────────────────

export const getFailedNotifications = async ({ page, limit }) => {
  const offset = (page - 1) * limit
  const { failures, total } = await adminRepository.getFailedNotifications({ limit, offset })
  return {
    failures,
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
