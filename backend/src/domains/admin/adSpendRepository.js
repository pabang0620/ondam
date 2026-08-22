/**
 * ad_spend Repository - 광고비 입력(CAC 산출용) DB 접근 전담
 * docs/strategy/12-analytics-plan.md 2-10절, 8-1절(P0)
 */
import pool from '../../config/db.js'

// ─── CRUD ─────────────────────────────────────────────────────────────────

export const createAdSpend = async ({
  adSpendId,
  channel,
  periodStart,
  periodEnd,
  spendKrw,
  note,
  recordedBy,
}) => {
  await pool.query(
    `INSERT INTO ad_spend
       (ad_spend_id, channel, period_start, period_end, spend_krw, note, recorded_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [adSpendId, channel, periodStart, periodEnd, spendKrw, note ?? null, recordedBy],
  )
}

export const findAdSpendById = async (adSpendId) => {
  const [rows] = await pool.query(
    `SELECT ad_spend_id AS adSpendId, channel, period_start AS periodStart,
            period_end AS periodEnd, spend_krw AS spendKrw, note,
            recorded_by AS recordedBy, created_at AS createdAt, updated_at AS updatedAt
     FROM ad_spend
     WHERE ad_spend_id = ? AND deleted_at IS NULL`,
    [adSpendId],
  )
  return rows[0] ?? null
}

export const getAdSpendList = async ({ limit, offset, channel }) => {
  const conditions = ['deleted_at IS NULL']
  const params = []

  if (channel) {
    conditions.push('channel = ?')
    params.push(channel)
  }

  const where = conditions.join(' AND ')
  params.push(limit, offset)

  const [rows] = await pool.query(
    `SELECT ad_spend_id AS adSpendId, channel, period_start AS periodStart,
            period_end AS periodEnd, spend_krw AS spendKrw, note,
            recorded_by AS recordedBy, created_at AS createdAt, updated_at AS updatedAt
     FROM ad_spend
     WHERE ${where}
     ORDER BY period_start DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    params,
  )

  const countParams = params.slice(0, -2)
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM ad_spend WHERE ${where}`,
    countParams,
  )
  return { items: rows, total }
}

// UPDATABLE_COLS 화이트리스트 (SQL 인젝션 defense in depth, backend-patterns 컨벤션)
const UPDATABLE_COLS = ['channel', 'period_start', 'period_end', 'spend_krw', 'note']

export const updateAdSpend = async (adSpendId, data) => {
  const entries = Object.entries(data).filter(
    ([k, v]) => UPDATABLE_COLS.includes(k) && v !== undefined,
  )
  if (entries.length === 0) return

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([, v]) => v)
  values.push(adSpendId)

  await pool.query(
    `UPDATE ad_spend SET ${setClauses}, updated_at = NOW()
     WHERE ad_spend_id = ? AND deleted_at IS NULL`,
    values,
  )
}

export const softDeleteAdSpend = async (adSpendId) => {
  await pool.query(
    `UPDATE ad_spend SET deleted_at = NOW()
     WHERE ad_spend_id = ? AND deleted_at IS NULL`,
    [adSpendId],
  )
}

// 최근 사용 채널 제안 (입력 폼 자동완성용 - 자유입력 + 제안 정도의 단순한 형태)
export const getRecentChannels = async (limit = 10) => {
  const [rows] = await pool.query(
    `SELECT channel, MAX(created_at) AS lastUsedAt
     FROM ad_spend
     WHERE deleted_at IS NULL
     GROUP BY channel
     ORDER BY lastUsedAt DESC
     LIMIT ?`,
    [limit],
  )
  return rows.map((r) => r.channel)
}

// ─── CAC 산출용 집계 (블렌디드, 12-analytics-plan.md 3-5절) ─────────────────
// 채널별 귀속 CAC는 payments에 session_id/anonymous_id(UTM 귀속용) 컬럼이 아직
// 없어(8-1절 P0 미적용) 산출 불가 - 여기서는 전체 채널 합산(블렌디드) 값만 계산한다.

// 기간이 걸친 광고비는 일할 안분하여 합산한다(12-analytics-plan.md 3-5절 "기간이
// 걸친 광고비는 일할 안분한다"). 조회 기간과 겹치는 일수만큼만 비례 계산.
export const getProratedAdSpendSum = async (startDate, endDate) => {
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(
       spend_krw *
       (DATEDIFF(LEAST(period_end, ?), GREATEST(period_start, ?)) + 1)
       / (DATEDIFF(period_end, period_start) + 1)
     ), 0) AS totalSpendKrw
     FROM ad_spend
     WHERE deleted_at IS NULL
       AND period_start <= ?
       AND period_end >= ?`,
    [endDate, startDate, endDate, startDate],
  )
  return Number(row.totalSpendKrw)
}

// 분모: 기간 내 "생애 첫 결제 성공"이 발생한 회원 수(신규 결제자, 재구매 제외).
// 12-analytics-plan.md 3-5절 "분모는 생애 첫 결제자(신규 고객)다. 재구매는 제외".
export const getNewPayingUserCount = async (startDate, endDate) => {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS newPayingUsers
     FROM (
       SELECT user_id, MIN(paid_at) AS first_paid_at
       FROM payments
       WHERE status = 'done' AND deleted_at IS NULL AND paid_at IS NOT NULL
       GROUP BY user_id
     ) first_payments
     WHERE first_paid_at >= ? AND first_paid_at < DATE_ADD(?, INTERVAL 1 DAY)`,
    [startDate, endDate],
  )
  return Number(row.newPayingUsers)
}
