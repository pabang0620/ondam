import * as subscriptionService from './subscriptionService.js'
import { success, created } from '../../utils/response.js'

/**
 * GET /api/subscriptions/plans
 * 구독 플랜 목록 (비인증 접근 가능)
 */
export const getPlans = async (req, res, next) => {
  try {
    const plans = subscriptionService.getPlans()
    return success(res, plans, '구독 플랜 목록')
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/subscriptions
 * 내 구독 목록
 */
export const getSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await subscriptionService.getSubscriptions(req.user.userId)
    return success(res, subscriptions, '구독 목록')
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/subscriptions/billing-auth
 * 빌링키 발급 + 즉시 첫 결제 + 구독 시작
 * body: { authKey, customerKey, plan }
 */
export const billingAuth = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { authKey, customerKey, plan } = req.body
    const result = await subscriptionService.subscribe(userId, { plan, authKey, customerKey })
    res.status(201).json({ success: true, message: '구독이 시작되었습니다', data: result })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/subscriptions
 * 구독 시작 — plan, authKey, customerKey 필요
 * @deprecated billingAuth 사용 권장. 하위 호환용으로 유지.
 */
export const subscribe = async (req, res, next) => {
  try {
    const { plan, authKey, customerKey } = req.body
    const result = await subscriptionService.subscribe(req.user.userId, { plan, authKey, customerKey })
    return created(res, result, '구독이 시작되었습니다')
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/subscriptions/:subscriptionId
 * 구독 취소
 */
export const cancelSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params
    const result = await subscriptionService.cancelSubscription(req.user.userId, subscriptionId)
    return success(res, result, '구독이 취소되었습니다')
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/subscriptions/:subscriptionId/retry-payment
 * 결제 수동 재시도 (past_due, suspended 상태)
 */
export const retryPayment = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params
    const result = await subscriptionService.retryPayment(req.user.userId, subscriptionId)
    return success(res, result, '결제가 완료되었습니다')
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/subscriptions/:subscriptionId/payment-logs
 * 구독 결제 로그 조회
 */
export const getPaymentLogs = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params
    const { page = 1, limit = 20 } = req.query
    const result = await subscriptionService.getPaymentLogs(req.user.userId, subscriptionId, {
      page: Number(page),
      limit: Number(limit),
    })
    res.json({ success: true, message: '결제 로그 목록', data: result.logs, meta: result.meta })
  } catch (err) {
    next(err)
  }
}
