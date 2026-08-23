import apiClient from '../../config/apiClient.js'

export const petApi = {
  // 반려동물 목록
  // FIX: 결함4 - signal 미전달로 usePet.js/usePetDetail.js/usePetPortrait.js/
  // usePetSubscription.js의 AbortController.abort()가 무효했던 문제 수정
  getPets: (signal) =>
    apiClient.get('/pet', { signal }),

  // 반려동물 등록
  createPet: (data) =>
    apiClient.post('/pet', data),

  // 반려동물 상세
  getPet: (petId, signal) =>
    apiClient.get(`/pet/${petId}`, { signal }),

  // 추모 페이지 접근 코드 조회 (소유자 전용)
  // [FIX D17] 백엔드가 memorial_access_code를 일반 펫 CRUD 응답에서 뺐다(응답 노출
  // 최소화) - 이제 코드가 필요한 순간에만 이 전용 경로로 따로 조회한다.
  getMemorialAccessCode: (petId, signal) =>
    apiClient.get(`/pet/${petId}/memorial-code`, { signal }),

  // 반려동물 수정
  updatePet: (petId, data) =>
    apiClient.put(`/pet/${petId}`, data),

  // 상태 변경 (alive → deceased)
  updatePetStatus: (petId, nextStatus) =>
    apiClient.patch(`/pet/${petId}/status`, { nextStatus }),

  // 미디어 목록
  getPetMedia: (petId, signal) =>
    apiClient.get(`/pet/${petId}/media`, { signal }),

  // 미디어 추가
  addPetMedia: (petId, data) =>
    apiClient.post(`/pet/${petId}/media`, data),

  // 사진 업로드
  uploadPhoto: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post('/uploads/photo', formData)
  },

  // 구독 플랜 목록
  getSubscriptionPlans: (signal) =>
    apiClient.get('/subscriptions/plans', { signal }),

  // 내 구독 조회
  getMySubscription: (signal) =>
    apiClient.get('/subscriptions', { signal }),

  // 구독 신청
  subscribe: ({ plan, authKey, customerKey }) =>
    apiClient.post('/subscriptions', { plan, authKey, customerKey }),

  // 빌링키 등록 (토스 인증 콜백 후 호출)
  registerBillingKey: ({ authKey, customerKey, plan }) =>
    apiClient.post('/subscriptions/billing-auth', { authKey, customerKey, plan }),

  // 구독 해지
  cancelSubscription: (subscriptionId) =>
    apiClient.delete(`/subscriptions/${subscriptionId}`),

  // 재결제 시도
  retryPayment: (subscriptionId) =>
    apiClient.post(`/subscriptions/${subscriptionId}/retry-payment`),

  // 결제 내역 조회
  getPaymentLogs: (subscriptionId, page = 1) =>
    apiClient.get(`/subscriptions/${subscriptionId}/payment-logs`, { params: { page } }),

  // 반려동물 삭제 (소프트삭제)
  deletePet: (petId) =>
    apiClient.delete(`/pet/${petId}`),

  // 미디어 삭제
  deleteMedia: (petId, mediaId) =>
    apiClient.delete(`/pet/${petId}/media/${mediaId}`),

  // AI 초상화 생성 요청
  createPortrait: (petId, data) =>
    apiClient.post(`/pet/${petId}/portrait`, data),

  // AI 초상화 상태 조회
  getPortraitStatus: (petId) =>
    apiClient.get(`/pet/${petId}/portrait/status`),

  // AI 초상화 남은 매수 조회 (구독자 월 3매 / 무료 티어 평생 1회 체험)
  getPortraitQuota: (petId) =>
    apiClient.get(`/pet/${petId}/portrait/quota`),
}
