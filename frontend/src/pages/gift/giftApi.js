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

// ─── 수행 흐름 공통 헬퍼 ────────────────────────────────────────────────────────

// FE-GMA-1: 서버는 로그인 사용자가 선물 수령자가 아니면 403 code
// 'GIFT_RECIPIENT_MISMATCH'로 막는다. 어느 단계에서 받든 같은 안내를 보여준다.
export const GIFT_RECIPIENT_MISMATCH_MESSAGE =
  '다른 계정으로 로그인되어 있습니다. 로그아웃 후 다시 열어 주세요.'

export const isRecipientMismatch = (err) =>
  err?.response?.status === 403 && err?.response?.data?.code === 'GIFT_RECIPIENT_MISMATCH'

export const getGiftErrorMessage = (err, fallback) =>
  isRecipientMismatch(err)
    ? GIFT_RECIPIENT_MISMATCH_MESSAGE
    : (err?.response?.data?.message ?? fallback)

// FE-GMA-1: "이 탭에서 이 선물 링크로 계정 연결을 끝냈다"는 표시. 로그인 상태
// 자체(isAuthenticated)는 다른 계정일 수 있어 계정 단계를 건너뛰는 근거가 될 수 없다.
const linkedKey = (token) => `giftAccountLinked:${token}`
export const markAccountLinked = (token) => sessionStorage.setItem(linkedKey(token), '1')
export const isAccountLinked = (token) => sessionStorage.getItem(linkedKey(token)) === '1'

// FE-GMA-4: 콘텐츠 제출(유언장 활성화/사진 처리 시작) 이후 재진입 시 동의부터 다시
// 시작하지 않도록, 이 탭에서 제출한 willId/orderId를 giftId별로 기억한다.
const progressKey = (giftId) => `giftContentProgress:${giftId}`
export const saveGiftProgress = (giftId, progress) => {
  if (giftId) sessionStorage.setItem(progressKey(giftId), JSON.stringify(progress))
}
export const loadGiftProgress = (giftId) => {
  if (!giftId) return null
  try {
    return JSON.parse(sessionStorage.getItem(progressKey(giftId)) ?? 'null')
  } catch {
    return null
  }
}
export const clearGiftProgress = (giftId) => {
  if (giftId) sessionStorage.removeItem(progressKey(giftId))
}

// FE-GMA-4: 완료 표시 실패를 삼키지 않는다 - 1회 재시도 후에도 실패하면 throw.
export const completeGiftWithRetry = async (giftId, ids) => {
  try {
    return await completeGift(giftId, ids)
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return completeGift(giftId, ids)
  }
}
