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
 * POST /api/subscriptions
 * 구독 시작 — plan, tossBillingKey 필요
 */
export const subscribe = async (req, res, next) => {
  try {
    const { plan, tossBillingKey } = req.body
    const result = await subscriptionService.subscribe(req.user.userId, { plan, tossBillingKey })
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
