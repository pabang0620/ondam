import apiClient from '../../config/apiClient.js'

export const petApi = {
  // 반려동물 목록
  getPets: () =>
    apiClient.get('/pet'),

  // 반려동물 등록
  createPet: (data) =>
    apiClient.post('/pet', data),

  // 반려동물 상세
  getPet: (petId) =>
    apiClient.get(`/pet/${petId}`),

  // 반려동물 수정
  updatePet: (petId, data) =>
    apiClient.put(`/pet/${petId}`, data),

  // 상태 변경 (alive → deceased)
  updatePetStatus: (petId, nextStatus) =>
    apiClient.patch(`/pet/${petId}/status`, { nextStatus }),

  // 미디어 목록
  getPetMedia: (petId) =>
    apiClient.get(`/pet/${petId}/media`),

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
  getSubscriptionPlans: () =>
    apiClient.get('/subscriptions/plans'),

  // 내 구독 조회
  getMySubscription: () =>
    apiClient.get('/subscriptions'),

  // 구독 신청
  subscribe: (plan) =>
    apiClient.post('/subscriptions', { plan, tossBillingKey: 'mock_key' }),

  // 구독 해지
  cancelSubscription: (subscriptionId) =>
    apiClient.delete(`/subscriptions/${subscriptionId}`),

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
}
