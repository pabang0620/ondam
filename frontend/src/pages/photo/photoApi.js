import apiClient from '../../config/apiClient.js'

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
export const confirmPayment = ({ orderId, amount }) =>
  apiClient.post('/payments/confirm', {
    paymentKey: `mock_${Date.now()}`,
    orderId,
    amount,
  })

export const startProcessing = (orderId) =>
  apiClient.post(`/photo/orders/${orderId}/start`)
