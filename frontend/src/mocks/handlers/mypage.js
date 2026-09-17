// [DESIGN-PREVIEW] MSW mock handler - mypage 도메인, 실제 백엔드 없이 로컬 디자인 검토용
import { http, HttpResponse } from 'msw'

// 실제 사용처 확인:
// - src/pages/mypage/mypageApi.js: 호출 엔드포인트 정의
// - src/pages/mypage/useMy.js: res.data.success / res.data.data 로 언래핑
// - src/pages/mypage/MyPage.jsx: photo_orders/wills는 snake_case(order_id/photo_type/
//   created_at, will_id/title/created_at), notification settings는 camelCase
//   (pushEnabled/emailEnabled/smsEnabled/notify*)로 실제 사용됨

let mockUser = {
  id: 'a3f1c9e2-4b6d-4e2a-9c1a-7d8e2f3b1a90',
  nickname: '김온담',
  email: 'ondam.user@example.com',
  phone: '010-1234-5678',
  profileImageUrl: null,
  role: 'user',
  createdAt: '2025-11-02T09:15:00+09:00',
}

const mockPhotoOrders = [
  {
    order_id: 'po-2026-0914-001',
    photo_type: 'funeral',
    status: 'completed',
    created_at: '2026-09-01T10:20:00+09:00',
  },
  {
    order_id: 'po-2026-0914-002',
    photo_type: 'id',
    status: 'processing',
    created_at: '2026-09-08T14:05:00+09:00',
  },
  {
    order_id: 'po-2026-0914-003',
    photo_type: 'employment',
    status: 'pending_payment',
    created_at: '2026-09-13T21:40:00+09:00',
  },
]

const mockWills = [
  {
    will_id: 'w-2026-0914-001',
    title: '사랑하는 가족에게',
    status: 'released',
    created_at: '2026-06-12T11:00:00+09:00',
  },
  {
    will_id: 'w-2026-0914-002',
    title: '',
    status: 'active',
    created_at: '2026-08-20T16:30:00+09:00',
  },
  {
    will_id: 'w-2026-0914-003',
    title: '아이들에게 남기는 말',
    status: 'draft',
    created_at: '2026-09-10T09:00:00+09:00',
  },
]

let mockNotificationSettings = {
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  notifyPhotoComplete: true,
  notifyWillEvents: true,
  notifyPayment: true,
  notifySubscription: false,
  notifyPetMemorial: true,
  notifyAdminNotice: false,
}

const mockNotifications = [
  {
    id: 'ntf-001',
    type: 'photo',
    title: '사진 처리가 완료되었습니다',
    message: '요청하신 장례 사진 보정이 완료되었습니다.',
    isRead: false,
    created_at: '2026-09-13T08:00:00+09:00',
  },
  {
    id: 'ntf-002',
    type: 'will',
    title: '영상 편지 생성이 시작되었습니다',
    message: 'AI 영상 편지 생성이 진행 중입니다. 완료되면 알려드릴게요.',
    isRead: true,
    created_at: '2026-09-10T09:05:00+09:00',
  },
  {
    id: 'ntf-003',
    type: 'payment',
    title: '결제가 완료되었습니다',
    message: '증명 사진 주문 결제가 정상적으로 처리되었습니다.',
    isRead: true,
    created_at: '2026-09-08T14:10:00+09:00',
  },
]

export const handlers = [
  http.get('/api/users/me', () => {
    return HttpResponse.json({ success: true, data: mockUser })
  }),

  http.put('/api/users/me', async ({ request }) => {
    const body = await request.json()
    mockUser = { ...mockUser, ...body }
    return HttpResponse.json({ success: true, data: mockUser })
  }),

  http.put('/api/users/me/password', () => {
    return HttpResponse.json({ success: true, data: null, message: '비밀번호가 변경되었습니다.' })
  }),

  http.delete('/api/users/me', () => {
    return HttpResponse.json({ success: true, data: null, message: '탈퇴 처리되었습니다.' })
  }),

  http.get('/api/photo/orders', () => {
    return HttpResponse.json({ success: true, data: mockPhotoOrders })
  }),

  http.get('/api/will/wills', () => {
    return HttpResponse.json({ success: true, data: mockWills })
  }),

  http.get('/api/notifications/unread-count', () => {
    const count = mockNotifications.filter((n) => !n.isRead).length
    return HttpResponse.json({ success: true, data: { count } })
  }),

  http.get('/api/notifications/settings', () => {
    return HttpResponse.json({ success: true, data: mockNotificationSettings })
  }),

  http.put('/api/notifications/settings', async ({ request }) => {
    const body = await request.json()
    mockNotificationSettings = { ...mockNotificationSettings, ...body }
    return HttpResponse.json({ success: true, data: mockNotificationSettings })
  }),

  http.get('/api/notifications', () => {
    return HttpResponse.json({
      success: true,
      data: mockNotifications,
      meta: { total: mockNotifications.length, page: 1, limit: 20 },
    })
  }),

  http.put('/api/notifications/:id/read', ({ params }) => {
    const target = mockNotifications.find((n) => n.id === params.id)
    if (target) target.isRead = true
    return HttpResponse.json({ success: true, data: null })
  }),

  http.put('/api/notifications/read-all', () => {
    mockNotifications.forEach((n) => {
      n.isRead = true
    })
    return HttpResponse.json({ success: true, data: null })
  }),
]
