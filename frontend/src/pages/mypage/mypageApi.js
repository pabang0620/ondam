import apiClient from '../../config/apiClient.js'

export const mypageApi = {
  // FIX: 결함4 - signal 미전달로 useMy.js의 AbortController.abort()가 무효했던 문제 수정
  getMe: (signal) =>
    apiClient.get('/users/me', { signal }),

  getPhotoOrders: (signal) =>
    apiClient.get('/photo/orders', { signal }),

  getWills: (signal) =>
    apiClient.get('/will/wills', { signal }),

  getUnreadCount: (signal) =>
    apiClient.get('/notifications/unread-count', { signal }),

  getNotificationSettings: () =>
    apiClient.get('/notifications/settings'),

  updateNotificationSettings: (settings) =>
    apiClient.put('/notifications/settings', settings),

  // 프로필 수정 (nickname, phone, profileImageUrl)
  updateProfile: (data) =>
    apiClient.put('/users/me', data),

  // 비밀번호 변경
  changePassword: (currentPassword, newPassword) =>
    apiClient.put('/users/me/password', { currentPassword, newPassword }),

  // 회원 탈퇴
  withdraw: () =>
    apiClient.delete('/users/me'),

  // 알림 목록 조회
  getNotifications: (params) =>
    apiClient.get('/notifications', { params }),

  // 알림 단건 읽음 처리
  markAsRead: (notificationId) =>
    apiClient.put(`/notifications/${notificationId}/read`),

  // 알림 전체 읽음 처리
  markAllAsRead: () =>
    apiClient.put('/notifications/read-all'),
}
