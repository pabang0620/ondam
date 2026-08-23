import apiClient from '../../config/apiClient.js'

// 결함C: AI 사진관은 초상권 동의 화면이 0개였다. useWillConsent.js가 쓰는
// /auth/consents(consentType/isAgreed) 형식을 그대로 따른다 - 백엔드가 사진 주문·
// 처리 시작 전 portrait 동의(user_consents.consent_type='portrait')를 검증한다.
export const savePhotoConsents = (consents) =>
  apiClient.post('/auth/consents', { consents })

export const createPhotoOrder = (photoType, sourceImageUrl) =>
  apiClient.post('/photo/orders', { photoType, sourceImageUrl })

export const getPhotoOrders = () =>
  apiClient.get('/photo/orders')

export const getPhotoOrder = (orderId) =>
  apiClient.get(`/photo/orders/${orderId}`)

export const getPhotoOrderStatus = (orderId) =>
  apiClient.get(`/photo/orders/${orderId}/status`)

export const getPhotoOrderResult = (orderId) =>
  apiClient.get(`/photo/orders/${orderId}/result`)

export const retryPhotoOrder = (orderId) =>
  apiClient.post(`/photo/orders/${orderId}/retry`)

export const uploadPhoto = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient.post('/uploads/photo', formData)
}

// FIX: DEV-29 - 금액은 서버가 targetId로 조회한 photo_orders.price_krw를 정본으로 쓴다
// (백엔드 preparePayment는 body의 amountKrw를 아예 읽지 않는다). 클라이언트가 금액을
// 보내는 것 자체가 "가격이 두 곳에 존재한다"는 오해를 유발하므로 보내지 않는다.
export const preparePayment = (targetId) =>
  apiClient.post('/payments/prepare', {
    targetType: 'photo_order',
    targetId,
  })

// orderId는 preparePayment 응답의 tossOrderId여야 한다(photo_orders.order_id가 아니다).
// amount도 반드시 preparePayment 응답의 amountKrw를 그대로 넘겨야 한다 - 서버가 결제
// 레코드에 저장된 amount_krw와 대조하므로 다른 값을 보내면 항상 400으로 거부된다.
// paymentKey는 더 이상 프론트가 만들지 않는다 - 토스 결제창이 successUrl 콜백 쿼리로
// 돌려준 실제 값을 그대로 전달해야 한다 (DEV-25, G3-4).
//
// DEV-25: 백엔드 confirm은 토스 승인 API 응답을 기다린다(TOSS_CONFIRM_TIMEOUT_MS 기본
// 30초). axios 기본 timeout(10초)보다 짧게 두면 백엔드가 아직 처리 중인데 클라이언트가
// 먼저 타임아웃 나 버려서 "결제가 실제로 됐는지 알 수 없는" 상태를 만든다. 백엔드
// 타임아웃보다 여유 있게 35초로 늘린다.
export const confirmPayment = ({ paymentKey, orderId, amount }) =>
  apiClient.post(
    '/payments/confirm',
    { paymentKey, orderId, amount },
    { timeout: 35000 },
  )

export const startProcessing = (orderId) =>
  apiClient.post(`/photo/orders/${orderId}/start`)
