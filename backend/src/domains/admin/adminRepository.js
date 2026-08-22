import pool from '../../config/db.js'

// ─── admin_users ──────────────────────────────────────────────────────────────

export const findAdminByEmail = async (email) => {
  const [rows] = await pool.query(
    `SELECT id, admin_id, email, password_hash, name, admin_role, is_active, last_login_at
     FROM admin_users
     WHERE email = ? AND deleted_at IS NULL`,
    [email],
  )
  return rows[0] ?? null
}

export const findAdminById = async (adminId) => {
  const [rows] = await pool.query(
    `SELECT id, admin_id, email, name, admin_role, is_active, last_login_at, created_at
     FROM admin_users
     WHERE admin_id = ? AND deleted_at IS NULL`,
    [adminId],
  )
  return rows[0] ?? null
}

export const updateLastLogin = async (adminId) => {
  await pool.query(
    `UPDATE admin_users SET last_login_at = NOW() WHERE admin_id = ?`,
    [adminId],
  )
}

// ─── 관리자 Refresh Token (refresh_tokens 테이블 재사용) ───────────────────────
//
// phase0-followups B-3: 관리자 refresh token을 위한 전용 테이블은 만들지 않는다.
// ondam_schema.sql 전체를 확인한 결과 이 프로젝트의 스키마에는 FOREIGN KEY 선언이
// 단 하나도 없다(2026-08-22 확인, `grep -c "FOREIGN KEY" ondam_schema.sql` == 0).
// refresh_tokens.user_id 컬럼은 주석상 "users.user_id 참조"라고만 적혀 있을 뿐 DB
// 레벨에서 강제되는 제약이 아니므로, admin_users.admin_id(UUID)를 그대로 저장해도
// 무결성 제약 위반이 나지 않는다. 조회는 token_hash(전역 UNIQUE)로만 하므로 일반
// 사용자 토큰과 관리자 토큰이 뒤섞여 조회될 일도 없다. 새 admin_refresh_tokens
// 테이블을 만들면 마이그레이션이 2건 더 밀려있는 현재 상황에 3번째 미적용 마이그레이션이
// 쌓이므로, 스키마 변경 없이 이 테이블을 재사용하는 쪽을 택했다.
export const saveAdminRefreshToken = async ({ tokenHash, adminId, expiresAt }) => {
  await pool.query(
    `INSERT INTO refresh_tokens (token_hash, user_id, expires_at)
     VALUES (?, ?, ?)`,
    [tokenHash, adminId, expiresAt],
  )
}

export const revokeAdminRefreshToken = async (tokenHash) => {
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = ? AND revoked_at IS NULL`,
    [tokenHash],
  )
}

export const findAdminRefreshToken = async (tokenHash) => {
  const [rows] = await pool.query(
    `SELECT token_hash, user_id AS admin_id, expires_at, revoked_at
     FROM refresh_tokens
     WHERE token_hash = ?
     LIMIT 1`,
    [tokenHash],
  )
  return rows[0] ?? null
}

// FIX: HIGH-3 - 다중 탭 동시 refresh 경쟁에서, 늦게 도착한 요청이 "이미 회전된(revoked)"
// 토큰을 들고 있을 때 이게 진짜 재사용 공격인지 판별하려면 "지금 이 admin에게 유효한
// refresh token이 실제로 존재하는가"를 확인해야 한다. 존재하면 유예(grace) 처리 후보.
export const findActiveAdminRefreshToken = async (adminId) => {
  const [rows] = await pool.query(
    `SELECT token_hash, user_id AS admin_id, expires_at, revoked_at, created_at
     FROM refresh_tokens
     WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [adminId],
  )
  return rows[0] ?? null
}

// FIX: HIGH-3 - 유예 시간 밖의 재사용(진짜 탈취 가능성)이 확인되면, 회전으로 살아있는
// 다른 활성 세션까지 포함해 이 admin의 refresh token을 전부 무효화한다(피해 확산 차단).
export const revokeAllAdminRefreshTokens = async (adminId) => {
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = ? AND revoked_at IS NULL`,
    [adminId],
  )
}

// ─── 대시보드 통계 ────────────────────────────────────────────────────────────

export const getDashboardStats = async () => {
  const [[stats]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS totalUsers,
       (SELECT COUNT(*) FROM photo_orders WHERE status = 'processing' AND deleted_at IS NULL) AS processingPhotos,
       (SELECT COUNT(*) FROM will_release_requests WHERE req_status = 'pending' AND deleted_at IS NULL) AS pendingReleases,
       (SELECT COUNT(*) FROM ai_jobs WHERE job_status = 'failed' AND deleted_at IS NULL) AS failedJobs`,
  )
  return stats
}

// ─── will_release_requests ────────────────────────────────────────────────────

// [보안 수정] death_cert_url(영구 버킷 URL)을 목록 응답에 그대로 내려주지 않는다.
// death_cert_url 컬럼은 presigned URL이 아니라 uploadToS3/multerS3가 반환하는
// `https://{bucket}.s3.{region}.amazonaws.com/{key}` 영구 위치 URL이다 - 버킷이
// 비공개면 관리자가 눌러도 403(검수 불가), 공개면 사망증명서가 인터넷에 그대로
// 노출된다. 목록은 열람 여부 판단에 필요한 메타데이터만 내려주고, 실제 서류
// 열람은 상세 시점(GET /admin/releases/:id/document-url)에 짧은 만료의 presigned
// URL을 그때그때 발급한다(전건 발급은 낭비이자 불필요한 서명 URL 확산).
export const getPendingReleaseRequests = async ({ limit, offset }) => {
  const [rows] = await pool.query(
    `SELECT
       r.id, r.request_id AS releaseId, r.will_id, r.requested_by, r.beneficiary_id,
       r.req_status AS status, r.reviewed_by, r.reviewed_at,
       r.reject_reason, r.created_at, r.updated_at,
       u.email AS requester_email, u.nickname AS requester_nickname
     FROM will_release_requests r
     LEFT JOIN users u ON u.user_id = r.requested_by
     WHERE r.req_status = 'pending' AND r.deleted_at IS NULL
     ORDER BY r.created_at ASC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  )
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM will_release_requests
     WHERE req_status = 'pending' AND deleted_at IS NULL`,
  )
  return { requests: rows, total }
}

export const findReleaseRequestById = async (requestId) => {
  const [rows] = await pool.query(
    `SELECT * FROM will_release_requests
     WHERE request_id = ? AND deleted_at IS NULL`,
    [requestId],
  )
  return rows[0] ?? null
}

export const updateReleaseRequest = async (
  requestId,
  { reqStatus, reviewedBy, reviewedAt, rejectReason },
) => {
  const UPDATABLE_COLS = ['req_status', 'reviewed_by', 'reviewed_at', 'reject_reason']
  const data = { req_status: reqStatus, reviewed_by: reviewedBy, reviewed_at: reviewedAt, reject_reason: rejectReason ?? null }
  const entries = Object.entries(data).filter(([k]) => UPDATABLE_COLS.includes(k) && data[k] !== undefined)
  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([, v]) => v)
  values.push(requestId)

  await pool.query(
    `UPDATE will_release_requests SET ${setClauses}, updated_at = NOW() WHERE request_id = ?`,
    values,
  )
}

// ─── wills ────────────────────────────────────────────────────────────────────

export const updateWillReleaseStatus = async (willId, releaseStatus) => {
  const releasedAt = releaseStatus === 'released' ? ', released_at = NOW()' : ''
  await pool.query(
    `UPDATE wills SET release_status = ?, updated_at = NOW() ${releasedAt} WHERE will_id = ?`,
    [releaseStatus, willId],
  )
}

export const findWillBeneficiaries = async (willId) => {
  const [rows] = await pool.query(
    `SELECT wb.beneficiary_id, wb.name, wb.email AS beneficiary_email, wb.phone AS beneficiary_phone,
            u.user_id, u.email, u.nickname, u.phone
     FROM will_beneficiaries wb
     LEFT JOIN users u ON u.user_id = wb.user_id
     WHERE wb.will_id = ? AND wb.deleted_at IS NULL`,
    [willId],
  )
  return rows
}

// ─── 주문 목록 (관리자) ───────────────────────────────────────────────────────

export const getOrders = async ({ limit, offset, status, targetType }) => {
  const conditions = ['po.deleted_at IS NULL']
  const params = []

  if (status) {
    conditions.push('po.status = ?')
    params.push(status)
  }
  if (targetType) {
    conditions.push('po.photo_type = ?')
    params.push(targetType)
  }

  const where = conditions.join(' AND ')
  params.push(limit, offset)

  const [rows] = await pool.query(
    `SELECT
       po.order_id, po.photo_type, po.status, po.price_krw AS amountKrw,
       po.created_at, po.updated_at,
       u.user_id, u.email, u.nickname
     FROM photo_orders po
     LEFT JOIN users u ON u.user_id = po.user_id
     WHERE ${where}
     ORDER BY po.created_at DESC
     LIMIT ? OFFSET ?`,
    params,
  )

  const countParams = params.slice(0, -2)
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM photo_orders po
     LEFT JOIN users u ON u.user_id = po.user_id
     WHERE ${where}`,
    countParams,
  )
  return { orders: rows, total }
}

// ─── 사용자 목록 (관리자) ─────────────────────────────────────────────────────

export const getUsers = async ({ limit, offset, search }) => {
  const conditions = ['u.deleted_at IS NULL']
  const params = []

  if (search) {
    conditions.push('(u.email LIKE ? OR u.nickname LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }

  const where = conditions.join(' AND ')
  params.push(limit, offset)

  const [rows] = await pool.query(
    `SELECT u.user_id, u.email, u.nickname, u.phone, u.role, u.is_active, u.created_at,
            s.plan AS subscriptionPlan
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.user_id AND s.sub_status = 'active' AND s.deleted_at IS NULL
     WHERE ${where}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    params,
  )

  const countParams = params.slice(0, -2)
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM users u WHERE ${where}`,
    countParams,
  )
  return { users: rows, total }
}

// ─── 실패 AI 작업 목록 ────────────────────────────────────────────────────────

export const getFailedJobs = async ({ limit, offset }) => {
  const [rows] = await pool.query(
    `SELECT
       j.job_id, j.user_id, j.job_type, j.job_status, j.queue_name,
       j.target_type, j.target_id, j.error_message, j.retry_cnt,
       j.started_at, j.completed_at, j.created_at,
       u.email AS user_email
     FROM ai_jobs j
     LEFT JOIN users u ON u.user_id = j.user_id
     WHERE j.job_status = 'failed' AND j.deleted_at IS NULL
     ORDER BY j.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  )
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM ai_jobs WHERE job_status = 'failed' AND deleted_at IS NULL`,
  )
  return { jobs: rows, total }
}

// ─── audit_logs ───────────────────────────────────────────────────────────────

export const createAuditLog = async ({
  logId,
  actorId,
  actorType,
  action,
  targetType,
  targetId,
  ipAddress,
  userAgent,
  detail,
}) => {
  await pool.query(
    `INSERT INTO audit_logs
       (log_id, actor_id, actor_type, action, target_type, target_id,
        ip_address, user_agent, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      logId,
      actorId,
      actorType,
      action,
      targetType ?? null,
      targetId ?? null,
      ipAddress ?? null,
      userAgent ?? null,
      detail ? JSON.stringify(detail) : null,
    ],
  )
}
