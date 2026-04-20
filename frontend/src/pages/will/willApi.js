import apiClient from '../../config/apiClient.js'

export const willApi = {
  // 음성 샘플 등록
  createVoiceSample: (data) =>
    apiClient.post('/will/voice-samples', data),

  // 음성 샘플 클론 상태 조회
  getVoiceSampleStatus: (id) =>
    apiClient.get(`/will/voice-samples/${id}/status`),

  // 유언장 생성
  createWill: (data) =>
    apiClient.post('/will/wills', data),

  // 유언장 목록
  getWills: () =>
    apiClient.get('/will/wills'),

  // 유언장 상세
  getWill: (willId) =>
    apiClient.get(`/will/wills/${willId}`),

  // 영상 생성 시작 (결제 후)
  activateWill: (willId) =>
    apiClient.post(`/will/wills/${willId}/activate`),

  // 영상 생성 상태 폴링
  getWillStatus: (willId) =>
    apiClient.get(`/will/wills/${willId}/status`),

  // 사후 공개 요청 (비회원)
  submitRelease: (token, data) =>
    apiClient.post(`/will/release/${token}`, data),

  // 유언 영상 조회 (비회원)
  watchWill: (token) =>
    apiClient.get(`/will/watch/${token}`),

  // 파일 업로드 (오디오)
  uploadAudio: (formData) =>
    apiClient.post('/uploads/audio', formData),

  // 파일 업로드 (사진)
  uploadPhoto: (formData) =>
    apiClient.post('/uploads/photo', formData),

  // 동의 항목 저장
  saveConsents: (consents) =>
    apiClient.post('/auth/consents', { consents }),

  // 결제 준비
  preparePayment: (willId, amountKrw) =>
    apiClient.post('/payments/prepare', {
      targetType: 'will_order',
      targetId: willId,
      amountKrw,
    }),

  // 결제 확인
  confirmPayment: ({ paymentKey, orderId, amount }) =>
    apiClient.post('/payments/confirm', { paymentKey, orderId, amount }),
}
