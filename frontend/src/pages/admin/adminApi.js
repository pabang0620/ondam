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
}
