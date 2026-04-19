import adminApiClient from '../../config/adminApiClient.js'

export const adminApi = {
  // 로그인
  login: (email, password) =>
    adminApiClient.post('/admin/auth/login', { email, password }),

  // 대시보드
  getDashboard: () =>
    adminApiClient.get('/admin/dashboard'),

  // 사후공개
  getReleases: () =>
    adminApiClient.get('/admin/releases'),

  approveRelease: (id) =>
    adminApiClient.post(`/admin/releases/${id}/approve`),

  rejectRelease: (id, rejectReason) =>
    adminApiClient.post(`/admin/releases/${id}/reject`, { rejectReason }),

  // 주문
  getOrders: (page = 1, status = '') =>
    adminApiClient.get('/admin/orders', { params: { page, ...(status && { status }) } }),

  // 회원
  getUsers: (page = 1, search = '') =>
    adminApiClient.get('/admin/users', { params: { page, ...(search && { search }) } }),
}
