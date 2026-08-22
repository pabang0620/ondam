/**
 * ad_spend Service - 광고비 입력 비즈니스 로직 + CAC 산출
 * docs/strategy/12-analytics-plan.md 2-10절(이벤트#62), 3-5절(CAC), 8-1절(P0)
 *
 * adminService.js는 다른 에이전트가 delivered_at 작업 중이라 수정 금지 대상이므로,
 * ad_spend는 별도 도메인 파일(Repository/Service/Controller)로 분리했다.
 * audit_logs 기록은 기존 adminRepository.createAuditLog를 그대로 재사용한다
 * (제네릭 함수라 adminService.js를 건드리지 않고도 import 가능).
 */
import { v4 as uuidv4 } from 'uuid'
import * as adSpendRepository from './adSpendRepository.js'
import * as adminRepository from './adminRepository.js'

// ─── 생성 ─────────────────────────────────────────────────────────────────

export const createAdSpend = async (
  recordedBy,
  { channel, periodStart, periodEnd, spendKrw, note },
  { ipAddress, userAgent } = {},
) => {
  const adSpendId = uuidv4()

  await adSpendRepository.createAdSpend({
    adSpendId,
    channel,
    periodStart,
    periodEnd,
    spendKrw,
    note,
    recordedBy,
  })

  // SPEC-06 1절: "모든 쓰기 행위는 audit_logs에 기록(행위자·대상·전후 값·사유)"
  await adminRepository.createAuditLog({
    logId: uuidv4(),
    actorId: recordedBy,
    actorType: 'admin',
    action: 'ad_spend.created',
    targetType: 'ad_spend',
    targetId: adSpendId,
    ipAddress,
    userAgent,
    detail: { channel, periodStart, periodEnd, spendKrw },
  })

  return adSpendRepository.findAdSpendById(adSpendId)
}

// ─── 목록 조회 ────────────────────────────────────────────────────────────

export const listAdSpend = async ({ page, limit, channel }) => {
  const offset = (page - 1) * limit
  const { items, total } = await adSpendRepository.getAdSpendList({ limit, offset, channel })
  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

// ─── 수정 ─────────────────────────────────────────────────────────────────

export const updateAdSpend = async (
  adminId,
  adSpendId,
  { channel, periodStart, periodEnd, spendKrw, note },
  { ipAddress, userAgent } = {},
) => {
  const existing = await adSpendRepository.findAdSpendById(adSpendId)
  if (!existing) {
    throw Object.assign(new Error('광고비 내역을 찾을 수 없습니다'), { status: 404 })
  }

  await adSpendRepository.updateAdSpend(adSpendId, { channel, period_start: periodStart, period_end: periodEnd, spend_krw: spendKrw, note })

  await adminRepository.createAuditLog({
    logId: uuidv4(),
    actorId: adminId,
    actorType: 'admin',
    action: 'ad_spend.updated',
    targetType: 'ad_spend',
    targetId: adSpendId,
    ipAddress,
    userAgent,
    detail: {
      before: { channel: existing.channel, periodStart: existing.periodStart, periodEnd: existing.periodEnd, spendKrw: existing.spendKrw },
      after: { channel, periodStart, periodEnd, spendKrw },
    },
  })

  return adSpendRepository.findAdSpendById(adSpendId)
}

// ─── 삭제 (soft delete) ───────────────────────────────────────────────────

export const deleteAdSpend = async (adminId, adSpendId, { ipAddress, userAgent } = {}) => {
  const existing = await adSpendRepository.findAdSpendById(adSpendId)
  if (!existing) {
    throw Object.assign(new Error('광고비 내역을 찾을 수 없습니다'), { status: 404 })
  }

  await adSpendRepository.softDeleteAdSpend(adSpendId)

  await adminRepository.createAuditLog({
    logId: uuidv4(),
    actorId: adminId,
    actorType: 'admin',
    action: 'ad_spend.deleted',
    targetType: 'ad_spend',
    targetId: adSpendId,
    ipAddress,
    userAgent,
    detail: { channel: existing.channel, periodStart: existing.periodStart, periodEnd: existing.periodEnd, spendKrw: existing.spendKrw },
  })

  return { adSpendId }
}

// ─── 최근 채널 제안 ───────────────────────────────────────────────────────

export const getRecentChannels = async () => adSpendRepository.getRecentChannels()

// ─── CAC 산출 (블렌디드) ──────────────────────────────────────────────────
// 12-analytics-plan.md 3-5절 CAC 산출식의 "전체 신규 결제자 대비 전체 광고비"
// (블렌디드) 버전만 계산한다. 채널별 귀속(CAC by UTM)은 payments에 first_touch
// 귀속 컬럼(session_id/anonymous_id)이 없어 산출 불가 - 이 서비스가 반환하는
// note 필드에 그 제약을 명시한다(12-analytics-plan.md 8-1절 P0 항목).

export const getCac = async ({ startDate, endDate }) => {
  const [totalSpendKrw, newPayingUsers] = await Promise.all([
    adSpendRepository.getProratedAdSpendSum(startDate, endDate),
    adSpendRepository.getNewPayingUserCount(startDate, endDate),
  ])

  const cacKrw = newPayingUsers > 0 ? Math.round(totalSpendKrw / newPayingUsers) : null

  return {
    startDate,
    endDate,
    totalSpendKrw,
    newPayingUsers,
    cacKrw,
    note: '블렌디드 CAC(전체 채널 합산 광고비 / 전체 신규 결제자)만 산출됩니다. ' +
      'payments 테이블에 session_id/anonymous_id 등 UTM 귀속 컬럼이 아직 없어 ' +
      '채널별 CAC은 현재 스키마로 산출할 수 없습니다(docs/strategy/12-analytics-plan.md 8-1절 P0).',
  }
}
