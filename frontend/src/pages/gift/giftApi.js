import apiClient from '../../config/apiClient.js'

// ─── 구매(자녀) - 인증 필요 ─────────────────────────────────────────────────────

export const createGiftOrder = (productType, recipientName, recipientPhone) =>
  apiClient.post('/gifts', { productType, recipientName, recipientPhone })

export const getMyGifts = (page = 1, limit = 10) =>
  apiClient.get('/gifts/mine', { params: { page, limit } })

export const resendGiftLink = (giftId) => apiClient.post(`/gifts/${giftId}/resend`)

export const cancelGift = (giftId, cancelReason) =>
  apiClient.post(`/gifts/${giftId}/cancel`, { cancelReason })

// 선물 결제도 photo/will과 동일한 결제 엔드포인트를 그대로 쓴다 (targetType만 gift_order)
export const preparePayment = (giftId) =>
  apiClient.post('/payments/prepare', { targetType: 'gift_order', targetId: giftId })

export const confirmPayment = ({ paymentKey, orderId, amount }) =>
  apiClient.post('/payments/confirm', { paymentKey, orderId, amount }, { timeout: 35000 })

// ─── 수행(부모, 무계정) ─────────────────────────────────────────────────────────

export const getPerformInfo = (token) => apiClient.get(`/gifts/perform/${token}`)

export const verifyPerform = (token, phoneLast4) =>
  apiClient.post(`/gifts/perform/${token}/verify`, { phoneLast4 })

export const linkAccount = (token, payload) =>
  apiClient.post(`/gifts/perform/${token}/account`, payload)

export const declinePerform = (token) => apiClient.post(`/gifts/perform/${token}/decline`)

// ─── 콘텐츠 브리지 (계정 연결 이후, 인증됨) ──────────────────────────────────────

export const attachPhotoOrder = (giftId, orderId) =>
  apiClient.post(`/gifts/${giftId}/attach-photo-order`, { orderId })

export const attachWillOrder = (giftId, willId) =>
  apiClient.post(`/gifts/${giftId}/attach-will`, { willId })

export const completeGift = (giftId, { orderId, willId }) =>
  apiClient.post(`/gifts/${giftId}/complete`, { orderId, willId })
