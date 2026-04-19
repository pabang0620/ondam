import apiClient from '../../config/apiClient.js'

export const createPhotoOrder = (photoType) =>
  apiClient.post('/photo/orders', { photoType })

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

export const preparePayment = (targetId) =>
  apiClient.post('/payments/prepare', {
    targetType: 'photo_order',
    targetId,
    amountKrw: 9900,
  })

export const confirmPayment = (orderId) =>
  apiClient.post('/payments/confirm', {
    paymentKey: `mock_${Date.now()}`,
    orderId,
    amount: 9900,
  })
