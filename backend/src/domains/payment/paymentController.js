import * as paymentService from './paymentService.js'
import { success, created, paginated } from '../../utils/response.js'

/**
 * POST /api/payments/prepare
 * 결제 준비 - paymentId + tossOrderId 반환
 */
export const preparePayment = async (req, res, next) => {
  try {
    const { targetType, targetId } = req.body
    const result = await paymentService.preparePayment(req.user.userId, {
      targetType,
      targetId,
    })
    return created(res, result, '결제 준비 완료')
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/payments/confirm
 * 토스 승인 콜백 - paymentKey, orderId, amount 검증 후 결제 완료
 */
export const confirmPayment = async (req, res, next) => {
  try {
    const { paymentKey, orderId, amount } = req.body
    const result = await paymentService.confirmPayment(req.user.userId, {
      paymentKey,
      orderId,
      amount,
    })
    return success(res, result, '결제 승인 완료')
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/payments/:paymentId/cancel
 * 결제 취소 (환불 요청)
 */
export const cancelPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params
    const { cancelReason } = req.body
    const result = await paymentService.cancelPayment(req.user.userId, paymentId, {
      cancelReason,
    })
    return success(res, result, '결제 취소 완료')
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/payments
 * 내 결제 목록 (페이지네이션)
 */
export const getPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query
    const { payments, meta } = await paymentService.getPayments(req.user.userId, { page, limit })
    return paginated(res, payments, meta)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/payments/webhook
 * 토스페이먼츠 웹훅 - 서명 검증 후 결제 상태 동기화
 * 웹훅은 인증 미들웨어 없이 수신
 */
export const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['toss-signature'] ?? ''
    // raw body로 서명 검증 - JSON.stringify 재직렬화 시 키 순서 불일치 방지
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body)
    const result = await paymentService.handleWebhook(signature, rawBody, req.body)
    return success(res, result, '웹훅 처리 완료')
  } catch (err) {
    next(err)
  }
}
