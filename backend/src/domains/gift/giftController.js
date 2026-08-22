/**
 * Gift Controller - 요청 파싱 + 응답 전담 (SQL 직접 호출 금지)
 */

import * as giftService from './giftService.js'
import * as giftPerformService from './giftPerformService.js'
import { created, success, paginated } from '../../utils/response.js'

// authController.js의 RT_COOKIE_OPTIONS와 반드시 동일해야 한다(수정 금지 파일이라
// 상수를 import할 수 없어 값만 복제 - path를 '/api/auth'로 맞춰야 이후 프론트가
// 호출하는 POST /api/auth/refresh가 이 쿠키를 정상적으로 전송받는다)
const RT_COOKIE = 'rt'
const RT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
}

// ─── 구매(자녀) ────────────────────────────────────────────────────────────────

export const createGiftOrder = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { productType, recipientName, recipientPhone } = req.body
    const result = await giftService.createGiftOrder(userId, { productType, recipientName, recipientPhone })
    return created(res, result, '선물 주문이 생성되었습니다. 결제를 진행해 주세요')
  } catch (err) {
    next(err)
  }
}

export const getMyGifts = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { page, limit } = req.query
    const { gifts, meta } = await giftService.getMyGifts(userId, { page, limit })
    return paginated(res, gifts, meta)
  } catch (err) {
    next(err)
  }
}

export const resendLink = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { giftId } = req.params
    const result = await giftService.resendLink(userId, giftId)
    return success(res, result, '선물 링크를 다시 보냈습니다')
  } catch (err) {
    next(err)
  }
}

export const cancelGift = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { giftId } = req.params
    const { cancelReason } = req.body
    const result = await giftService.cancelGift(userId, giftId, { cancelReason })
    return success(res, result, '선물 결제를 취소하고 환불을 진행했습니다')
  } catch (err) {
    next(err)
  }
}

// ─── 수행(부모, 무계정) ─────────────────────────────────────────────────────────

export const getPerformInfo = async (req, res, next) => {
  try {
    const { token } = req.params
    const data = await giftPerformService.getPerformInfo(token)
    return success(res, data)
  } catch (err) {
    next(err)
  }
}

export const verifyPerform = async (req, res, next) => {
  try {
    const { token } = req.params
    const { phoneLast4 } = req.body
    const data = await giftPerformService.verifyPerform(token, phoneLast4)
    return success(res, data, '본인 확인이 완료되었습니다')
  } catch (err) {
    next(err)
  }
}

export const linkAccount = async (req, res, next) => {
  try {
    const { token } = req.params
    const { mode, email, password, nickname, consents } = req.body
    const ipAddress = req.ip ?? req.headers['x-forwarded-for'] ?? null
    const userAgent = req.headers['user-agent'] ?? null

    const result = await giftPerformService.linkAccount(token, {
      mode,
      email,
      password,
      nickname,
      consents,
      ipAddress,
      userAgent,
    })

    res.cookie(RT_COOKIE, result.refreshToken, RT_COOKIE_OPTIONS)

    return success(res, { accessToken: result.accessToken, user: result.user, gift: result.gift }, '계정 연결이 완료되었습니다')
  } catch (err) {
    next(err)
  }
}

export const declinePerform = async (req, res, next) => {
  try {
    const { token } = req.params
    const result = await giftPerformService.declinePerform(token)
    return success(res, result, '선물 수행을 거절했습니다')
  } catch (err) {
    next(err)
  }
}

// ─── 콘텐츠 브리지 (인증됨 - photo/will 도메인 재사용 다리) ──────────────────────────

export const attachPhotoOrder = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { giftId } = req.params
    const { orderId } = req.body
    const result = await giftPerformService.attachPhotoOrder(userId, giftId, orderId)
    return success(res, result, '선물 결제로 처리되었습니다')
  } catch (err) {
    next(err)
  }
}

export const attachWillOrder = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { giftId } = req.params
    const { willId } = req.body
    const result = await giftPerformService.attachWillOrder(userId, giftId, willId)
    return success(res, result, '선물 결제로 처리되었습니다')
  } catch (err) {
    next(err)
  }
}

export const completeGift = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { giftId } = req.params
    const { orderId, willId } = req.body
    const result = await giftPerformService.completeGift(userId, giftId, { orderId, willId })
    return success(res, result, '수행이 완료되었습니다')
  } catch (err) {
    next(err)
  }
}
