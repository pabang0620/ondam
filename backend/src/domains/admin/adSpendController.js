/**
 * ad_spend Controller - 요청 파싱 + 응답 전담
 */
import * as adSpendService from './adSpendService.js'
import { success, created, paginated } from '../../utils/response.js'

const getReqMeta = (req) => ({
  ipAddress: req.ip ?? req.headers['x-forwarded-for'] ?? null,
  userAgent: req.headers['user-agent'] ?? null,
})

// ─── POST /api/admin/ad-spend ─────────────────────────────────────────────

export const createAdSpend = async (req, res, next) => {
  try {
    const adminId = req.user.adminId
    const item = await adSpendService.createAdSpend(adminId, req.body, getReqMeta(req))
    return created(res, item, '광고비 등록 완료')
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/admin/ad-spend ──────────────────────────────────────────────

export const getAdSpendList = async (req, res, next) => {
  try {
    const { page, limit, channel } = req.query
    const result = await adSpendService.listAdSpend({ page, limit, channel })
    return paginated(res, result.items, result.meta, '광고비 목록 조회 성공')
  } catch (err) {
    next(err)
  }
}

// ─── PUT /api/admin/ad-spend/:id ──────────────────────────────────────────

export const updateAdSpend = async (req, res, next) => {
  try {
    const adminId = req.user.adminId
    const { id } = req.params
    const item = await adSpendService.updateAdSpend(adminId, id, req.body, getReqMeta(req))
    return success(res, item, '광고비 수정 완료')
  } catch (err) {
    next(err)
  }
}

// ─── DELETE /api/admin/ad-spend/:id ───────────────────────────────────────

export const deleteAdSpend = async (req, res, next) => {
  try {
    const adminId = req.user.adminId
    const { id } = req.params
    const result = await adSpendService.deleteAdSpend(adminId, id, getReqMeta(req))
    return success(res, result, '광고비 삭제 완료')
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/admin/ad-spend/recent-channels ──────────────────────────────

export const getRecentChannels = async (req, res, next) => {
  try {
    const channels = await adSpendService.getRecentChannels()
    return success(res, channels, '최근 채널 조회 성공')
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/admin/ad-spend/cac ──────────────────────────────────────────

export const getCac = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query
    const result = await adSpendService.getCac({ startDate, endDate })
    return success(res, result, 'CAC 산출 완료')
  } catch (err) {
    next(err)
  }
}
