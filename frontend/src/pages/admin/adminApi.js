import adminApiClient from '../../config/adminApiClient.js'

export const adminApi = {
  // 로그인
  login: (email, password) =>
    adminApiClient.post('/admin/auth/login', { email, password }),

  // 로그아웃 - HttpOnly 쿠키('art') 및 서버측 refresh token 정리
  logout: () => adminApiClient.post('/admin/auth/logout'),

  // 대시보드
  getDashboard: () =>
    adminApiClient.get('/admin/dashboard'),

  // 사후공개
  getReleases: (page = 1, limit = 20) =>
    adminApiClient.get('/admin/releases', { params: { page, limit } }),

  // 사망증명서 열람 URL - 상세 열람 시점에 그때그때 짧은 만료로 발급받는다
  // (목록 응답에는 URL이 없다 - 영구 버킷 URL을 그대로 내려주지 않기 위함)
  getReleaseDocumentUrl: (id) =>
    adminApiClient.get(`/admin/releases/${id}/document-url`),

  approveRelease: (id) =>
    adminApiClient.post(`/admin/releases/${id}/approve`),

  rejectRelease: (id, rejectReason) =>
    adminApiClient.post(`/admin/releases/${id}/reject`, { rejectReason }),

  // 주문
  getOrders: (page = 1, status = '', limit = 20) =>
    adminApiClient.get('/admin/orders', { params: { page, limit, ...(status && { status }) } }),

  // 회원
  getUsers: (page = 1, search = '', limit = 20) =>
    adminApiClient.get('/admin/users', { params: { page, limit, ...(search && { search }) } }),

  // 광고비 입력 (12-analytics-plan.md 2-10절, super/manager 전용)
  getAdSpendList: (page = 1, limit = 20, channel = '') =>
    adminApiClient.get('/admin/ad-spend', { params: { page, limit, ...(channel && { channel }) } }),

  createAdSpend: (payload) =>
    adminApiClient.post('/admin/ad-spend', payload),

  updateAdSpend: (id, payload) =>
    adminApiClient.put(`/admin/ad-spend/${id}`, payload),

  deleteAdSpend: (id) =>
    adminApiClient.delete(`/admin/ad-spend/${id}`),

  getRecentChannels: () =>
    adminApiClient.get('/admin/ad-spend/recent-channels'),

  // CAC (블렌디드 - 채널별 귀속은 현재 스키마로 산출 불가, 응답의 note 필드 참고)
  getCac: (startDate, endDate) =>
    adminApiClient.get('/admin/ad-spend/cac', { params: { startDate, endDate } }),
}
