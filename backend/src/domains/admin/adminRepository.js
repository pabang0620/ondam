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

// ─── 대시보드 통계 ────────────────────────────────────────────────────────────

export const getDashboardStats = async () => {
  const [[stats]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS total_users,
       (SELECT COUNT(*) FROM photo_orders WHERE status = 'processing') AS processing_photos,
       (SELECT COUNT(*) FROM will_release_requests WHERE req_status = 'pending') AS pending_releases,
       (SELECT COUNT(*) FROM ai_jobs WHERE job_status = 'failed') AS failed_jobs`,
  )
  return stats
}

// ─── will_release_requests ────────────────────────────────────────────────────

export const getPendingReleaseRequests = async ({ limit, offset }) => {
  const [rows] = await pool.query(
    `SELECT
       r.id, r.request_id, r.will_id, r.requested_by, r.beneficiary_id,
       r.death_cert_url, r.req_status, r.reviewed_by, r.reviewed_at,
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
       po.order_id, po.photo_type, po.status, po.price_krw,
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
  const conditions = ['deleted_at IS NULL']
  const params = []

  if (search) {
    conditions.push('(email LIKE ? OR nickname LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }

  const where = conditions.join(' AND ')
  params.push(limit, offset)

  const [rows] = await pool.query(
    `SELECT user_id, email, nickname, phone, is_active, created_at
     FROM users
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    params,
  )

  const countParams = params.slice(0, -2)
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM users WHERE ${where}`,
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
