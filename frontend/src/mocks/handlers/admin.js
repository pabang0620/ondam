// [DESIGN-PREVIEW] MSW mock handler - admin 도메인, 실제 백엔드 없이 로컬 디자인 검토용
//
// 계약 근거 (src/pages/admin/adminApi.js 실제 호출부 기준):
// - GET  /admin/dashboard                          -> useAdmin.js가 data.data를 stats로 사용
//     (AdminPage.jsx STAT_CONFIG: totalUsers/processingPhotos/pendingReleases/failedJobs)
// - GET  /admin/orders?page&limit&status            -> useAdminOrders.js
//     (AdminOrdersPage.jsx: orderId/userId/photoType/amountKrw/status/createdAt,
//      status ENUM 6종 - pending_payment/paid/processing/completed/failed/refunded,
//      photoType ENUM 9종 - funeral/id/job/enhance/colorize/restore/removebg/portrait/casual)
// - GET  /admin/users?page&limit&search             -> useAdminUsers.js
//     (AdminUsersPage.jsx: userId/nickname/email/role/createdAt/subscriptionPlan,
//      subscriptionPlan: pet_archive/will_premium/all/null)
// - GET  /admin/ad-spend?page&limit&channel         -> useAdminAdSpend.js
//     (AdminAdSpendPage.jsx: adSpendId/channel/periodStart/periodEnd/spendKrw/note)
// - POST/PUT/DELETE /admin/ad-spend(/:id)           -> 폼 등록·수정·삭제 (인메모리 반영)
// - GET  /admin/ad-spend/recent-channels            -> 채널 자동완성 datalist
// - GET  /admin/ad-spend/cac?startDate&endDate      -> CacPanel: totalSpendKrw/newPayingUsers/cacKrw/note
// - GET  /admin/releases?page&limit                 -> useAdminRelease.js
//     (AdminReleasePage.jsx: releaseId/willId/requesterName/requesterRelationship/
//      requesterEmail/requesterPhone/createdAt/status - pending/approved/rejected)
// - GET  /admin/releases/:id/document-url           -> handleViewDocument: data.data.url
// - POST /admin/releases/:id/approve, /reject       -> 로컬 상태만 갱신하므로 success만 필요
import { http, HttpResponse } from 'msw'

// ─── 대시보드 통계 ──────────────────────────────────────────────────────────
const DASHBOARD_STATS = {
  totalUsers: 1284,
  processingPhotos: 17,
  pendingReleases: 4,
  failedJobs: 2,
}

// ─── 주문 목록 (photo_orders) ───────────────────────────────────────────────
let orders = [
  { orderId: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000001', userId: 'u1a1a1a1-1111-4111-8111-100000000001', photoType: 'portrait', amountKrw: 29000, status: 'paid', createdAt: '2026-09-12T09:20:00+09:00' },
  { orderId: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000002', userId: 'u1a1a1a1-1111-4111-8111-100000000002', photoType: 'funeral', amountKrw: 39000, status: 'completed', createdAt: '2026-09-11T14:05:00+09:00' },
  { orderId: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000003', userId: 'u1a1a1a1-1111-4111-8111-100000000003', photoType: 'enhance', amountKrw: 9900, status: 'processing', createdAt: '2026-09-11T08:41:00+09:00' },
  { orderId: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000004', userId: 'u1a1a1a1-1111-4111-8111-100000000004', photoType: 'id', amountKrw: 15000, status: 'pending_payment', createdAt: '2026-09-10T19:30:00+09:00' },
  { orderId: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000005', userId: 'u1a1a1a1-1111-4111-8111-100000000005', photoType: 'colorize', amountKrw: 12000, status: 'failed', createdAt: '2026-09-09T11:15:00+09:00' },
  { orderId: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000006', userId: 'u1a1a1a1-1111-4111-8111-100000000006', photoType: 'restore', amountKrw: 19000, status: 'refunded', createdAt: '2026-09-08T16:50:00+09:00' },
  { orderId: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000007', userId: 'u1a1a1a1-1111-4111-8111-100000000007', photoType: 'removebg', amountKrw: 7000, status: 'completed', createdAt: '2026-09-07T10:00:00+09:00' },
  { orderId: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000008', userId: 'u1a1a1a1-1111-4111-8111-100000000008', photoType: 'casual', amountKrw: 25000, status: 'paid', createdAt: '2026-09-06T13:22:00+09:00' },
]

// ─── 회원 목록 (users) ──────────────────────────────────────────────────────
let users = [
  { userId: 'u1a1a1a1-1111-4111-8111-100000000001', nickname: '온담지킴이', email: 'guardian01@naver.com', role: 'user', createdAt: '2026-01-15T10:00:00+09:00', subscriptionPlan: 'pet_archive' },
  { userId: 'u1a1a1a1-1111-4111-8111-100000000002', nickname: '봄날의기억', email: 'springday@gmail.com', role: 'user', createdAt: '2026-02-03T11:30:00+09:00', subscriptionPlan: 'will_premium' },
  { userId: 'u1a1a1a1-1111-4111-8111-100000000003', nickname: '고요한아침', email: 'quietmorning@naver.com', role: 'user', createdAt: '2026-03-21T09:45:00+09:00', subscriptionPlan: null },
  { userId: 'u1a1a1a1-1111-4111-8111-100000000004', nickname: '하늘빛추억', email: 'skymemory@daum.net', role: 'user', createdAt: '2026-04-10T15:12:00+09:00', subscriptionPlan: 'all' },
  { userId: 'u1a1a1a1-1111-4111-8111-100000000005', nickname: '별이된당신', email: 'starryyou@gmail.com', role: 'user', createdAt: '2026-05-02T08:20:00+09:00', subscriptionPlan: null },
  { userId: 'u1a1a1a1-1111-4111-8111-100000000006', nickname: '따뜻한손길', email: 'warmtouch@naver.com', role: 'user', createdAt: '2026-06-18T17:05:00+09:00', subscriptionPlan: 'pet_archive' },
  { userId: 'u1a1a1a1-1111-4111-8111-100000000007', nickname: '초록빛정원', email: 'greengarden@gmail.com', role: 'user', createdAt: '2026-07-25T13:40:00+09:00', subscriptionPlan: null },
  { userId: 'u1a1a1a1-1111-4111-8111-100000000008', nickname: '관리자김온담', email: 'admin.kim@ondam.dev', role: 'admin', createdAt: '2025-12-01T09:00:00+09:00', subscriptionPlan: null },
]

// ─── 광고비 (ad_spend) ──────────────────────────────────────────────────────
let adSpendItems = [
  { adSpendId: 'as000001-1111-4111-8111-000000000001', channel: 'meta', periodStart: '2026-08-01', periodEnd: '2026-08-07', spendKrw: 850000, note: '가을맞이 유언영상 캠페인' },
  { adSpendId: 'as000001-1111-4111-8111-000000000002', channel: 'google', periodStart: '2026-08-01', periodEnd: '2026-08-07', spendKrw: 620000, note: '검색광고 - 사진복원 키워드' },
  { adSpendId: 'as000001-1111-4111-8111-000000000003', channel: 'naver_search', periodStart: '2026-08-08', periodEnd: '2026-08-14', spendKrw: 430000, note: '' },
  { adSpendId: 'as000001-1111-4111-8111-000000000004', channel: 'youtube', periodStart: '2026-08-08', periodEnd: '2026-08-14', spendKrw: 510000, note: '브랜드 인지도 영상' },
  { adSpendId: 'as000001-1111-4111-8111-000000000005', channel: 'instagram', periodStart: '2026-08-15', periodEnd: '2026-08-21', spendKrw: 390000, note: '반려동물 아카이브 홍보' },
  { adSpendId: 'as000001-1111-4111-8111-000000000006', channel: 'kakao', periodStart: '2026-08-15', periodEnd: '2026-08-21', spendKrw: 275000, note: '' },
  { adSpendId: 'as000001-1111-4111-8111-000000000007', channel: 'naver_gfa', periodStart: '2026-08-22', periodEnd: '2026-08-28', spendKrw: 340000, note: '추석 성묘 시즌 프로모션' },
  { adSpendId: 'as000001-1111-4111-8111-000000000008', channel: 'tiktok', periodStart: '2026-08-22', periodEnd: '2026-08-28', spendKrw: 180000, note: '숏폼 테스트 집행' },
]

const RECENT_CHANNELS = ['meta', 'google', 'naver_search', 'youtube', 'instagram', 'kakao']

// ─── 사후공개 요청 (will_releases) ──────────────────────────────────────────
let releases = [
  { releaseId: 're000001-1111-4111-8111-000000000001', willId: 'wl000001-1111-4111-8111-000000000001', requesterName: '김민서', requesterRelationship: '배우자', requesterEmail: 'minseo.kim@naver.com', requesterPhone: '010-2222-3333', createdAt: '2026-09-10T10:00:00+09:00', status: 'pending' },
  { releaseId: 're000001-1111-4111-8111-000000000002', willId: 'wl000001-1111-4111-8111-000000000002', requesterName: '이재훈', requesterRelationship: '자녀', requesterEmail: 'jaehoon.lee@gmail.com', requesterPhone: '010-3333-4444', createdAt: '2026-09-09T14:30:00+09:00', status: 'pending' },
  { releaseId: 're000001-1111-4111-8111-000000000003', willId: 'wl000001-1111-4111-8111-000000000003', requesterName: '박서연', requesterRelationship: '형제자매', requesterEmail: 'seoyeon.park@daum.net', requesterPhone: '010-4444-5555', createdAt: '2026-09-08T09:15:00+09:00', status: 'pending' },
  { releaseId: 're000001-1111-4111-8111-000000000004', willId: 'wl000001-1111-4111-8111-000000000004', requesterName: '최도윤', requesterRelationship: '자녀', requesterEmail: null, requesterPhone: '010-5555-6666', createdAt: '2026-09-07T18:45:00+09:00', status: 'pending' },
  { releaseId: 're000001-1111-4111-8111-000000000005', willId: 'wl000001-1111-4111-8111-000000000005', requesterName: '정하은', requesterRelationship: '배우자', requesterEmail: 'haeun.jung@naver.com', requesterPhone: '010-6666-7777', createdAt: '2026-09-03T11:20:00+09:00', status: 'approved' },
  { releaseId: 're000001-1111-4111-8111-000000000006', willId: 'wl000001-1111-4111-8111-000000000006', requesterName: '한지우', requesterRelationship: '자녀', requesterEmail: 'jiwoo.han@gmail.com', requesterPhone: '010-7777-8888', createdAt: '2026-09-01T16:10:00+09:00', status: 'rejected' },
]

const paginate = (list, page, limit) => {
  const start = (page - 1) * limit
  return list.slice(start, start + limit)
}

const getIntParam = (searchParams, key, fallback) => {
  const raw = searchParams.get(key)
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const handlers = [
  // 대시보드
  http.get('/api/admin/dashboard', () =>
    HttpResponse.json({ success: true, data: DASHBOARD_STATS })
  ),

  // 주문 목록
  http.get('/api/admin/orders', ({ request }) => {
    const { searchParams } = new URL(request.url)
    const page = getIntParam(searchParams, 'page', 1)
    const limit = getIntParam(searchParams, 'limit', 20)
    const status = searchParams.get('status')
    const filtered = status ? orders.filter((o) => o.status === status) : orders
    return HttpResponse.json({
      success: true,
      data: paginate(filtered, page, limit),
      meta: { total: filtered.length, page, limit },
    })
  }),

  // 회원 목록
  http.get('/api/admin/users', ({ request }) => {
    const { searchParams } = new URL(request.url)
    const page = getIntParam(searchParams, 'page', 1)
    const limit = getIntParam(searchParams, 'limit', 20)
    const search = (searchParams.get('search') ?? '').trim().toLowerCase()
    const filtered = search
      ? users.filter((u) =>
          u.nickname.toLowerCase().includes(search) || u.email.toLowerCase().includes(search)
        )
      : users
    return HttpResponse.json({
      success: true,
      data: paginate(filtered, page, limit),
      meta: { total: filtered.length, page, limit },
    })
  }),

  // 광고비 목록
  http.get('/api/admin/ad-spend', ({ request }) => {
    const { searchParams } = new URL(request.url)
    const page = getIntParam(searchParams, 'page', 1)
    const limit = getIntParam(searchParams, 'limit', 20)
    const channel = searchParams.get('channel')
    const filtered = channel ? adSpendItems.filter((a) => a.channel === channel) : adSpendItems
    return HttpResponse.json({
      success: true,
      data: paginate(filtered, page, limit),
      meta: { total: filtered.length, page, limit },
    })
  }),

  // 광고비 등록
  http.post('/api/admin/ad-spend', async ({ request }) => {
    const body = await request.json()
    const created = {
      adSpendId: `as-preview-${Date.now()}`,
      channel: body.channel,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      spendKrw: Number(body.spendKrw),
      note: body.note ?? '',
    }
    adSpendItems = [created, ...adSpendItems]
    return HttpResponse.json({ success: true, data: created })
  }),

  // 광고비 수정
  http.put('/api/admin/ad-spend/:id', async ({ request, params }) => {
    const body = await request.json()
    adSpendItems = adSpendItems.map((item) =>
      item.adSpendId === params.id
        ? {
            ...item,
            channel: body.channel,
            periodStart: body.periodStart,
            periodEnd: body.periodEnd,
            spendKrw: Number(body.spendKrw),
            note: body.note ?? '',
          }
        : item
    )
    const updated = adSpendItems.find((item) => item.adSpendId === params.id)
    return HttpResponse.json({ success: true, data: updated })
  }),

  // 광고비 삭제
  http.delete('/api/admin/ad-spend/:id', ({ params }) => {
    adSpendItems = adSpendItems.filter((item) => item.adSpendId !== params.id)
    return HttpResponse.json({ success: true, data: null })
  }),

  // 최근 사용 채널 (자동완성)
  http.get('/api/admin/ad-spend/recent-channels', () =>
    HttpResponse.json({ success: true, data: RECENT_CHANNELS })
  ),

  // CAC 조회 (블렌디드)
  http.get('/api/admin/ad-spend/cac', () => {
    const totalSpendKrw = adSpendItems.reduce((sum, item) => sum + item.spendKrw, 0)
    const newPayingUsers = 38
    return HttpResponse.json({
      success: true,
      data: {
        totalSpendKrw,
        newPayingUsers,
        cacKrw: Math.round(totalSpendKrw / newPayingUsers),
        note: '채널별 귀속은 현재 스키마로 산출 불가하여 블렌디드(전체 광고비 ÷ 전체 신규 결제자) 기준으로 계산됩니다.',
      },
    })
  }),

  // 사후공개 요청 목록
  http.get('/api/admin/releases', ({ request }) => {
    const { searchParams } = new URL(request.url)
    const page = getIntParam(searchParams, 'page', 1)
    const limit = getIntParam(searchParams, 'limit', 20)
    return HttpResponse.json({
      success: true,
      data: paginate(releases, page, limit),
      meta: { total: releases.length, page, limit },
    })
  }),

  // 사망증명서 열람 URL (짧은 만료 presigned URL 발급 흉내)
  http.get('/api/admin/releases/:id/document-url', () =>
    HttpResponse.json({
      success: true,
      data: { url: 'https://design-preview.ondam.dev/mock-death-certificate.pdf' },
    })
  ),

  // 사후공개 승인
  http.post('/api/admin/releases/:id/approve', ({ params }) => {
    releases = releases.map((r) => (r.releaseId === params.id ? { ...r, status: 'approved' } : r))
    return HttpResponse.json({ success: true, data: null })
  }),

  // 사후공개 거절
  http.post('/api/admin/releases/:id/reject', ({ params }) => {
    releases = releases.map((r) => (r.releaseId === params.id ? { ...r, status: 'rejected' } : r))
    return HttpResponse.json({ success: true, data: null })
  }),
]
