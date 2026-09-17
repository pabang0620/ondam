// [DESIGN-PREVIEW] MSW mock handler - 실제 백엔드 없이 로컬 디자인 검토용
//
// 계약 근거:
// - POST /api/auth/refresh, POST /api/auth/login 응답 포맷: { success, data: { accessToken, user } }
//   (src/config/authRefresh.js, src/pages/auth/loginApi.js)
// - user 필드는 src/pages/mypage/MyPage.jsx가 실제로 참조하는
//   nickname/email 을 기준으로 채운다 (mypageApi.getMe -> GET /users/me 응답과 동일 모양).
// - 관리자 세션은 완전히 분리된 엔드포인트(POST /api/admin/auth/refresh, /api/admin/auth/login)를
//   쓰며(src/config/adminApiClient.js, src/pages/admin/adminApi.js), AdminLayout.jsx는
//   user.role === 'admin' 그리고 NAV_ITEMS.roles 매칭을 위해 user.adminRole
//   ('super' | 'manager' | 'reviewer')을 읽는다. 사이드바 하단 표시는 user.name을 쓴다.
import { http, HttpResponse } from 'msw'

const DUMMY_USER = {
  userId: 'design-preview-user-0001',
  email: 'preview.user@ondam.dev',
  nickname: '디자인검토',
  name: '디자인검토',
  phone: '010-1234-5678',
  profileImageUrl: null,
  role: 'user',
}

const DUMMY_ADMIN_USER = {
  userId: 'design-preview-admin-0001',
  email: 'preview.admin@ondam.dev',
  name: '디자인검토 관리자',
  role: 'admin',
  adminRole: 'super',
}

const DUMMY_ACCESS_TOKEN = 'design-preview-access-token'
const DUMMY_ADMIN_ACCESS_TOKEN = 'design-preview-admin-access-token'

export const handlers = [
  // 일반 사용자 세션 복원 (App 초기 로드 시 authStore.initAuth -> refreshAuth)
  http.post('/api/auth/refresh', () =>
    HttpResponse.json({
      success: true,
      data: { accessToken: DUMMY_ACCESS_TOKEN, user: DUMMY_USER },
    })
  ),

  // 일반 사용자 로그인 폼 제출
  http.post('/api/auth/login', () =>
    HttpResponse.json({
      success: true,
      data: { accessToken: DUMMY_ACCESS_TOKEN, user: DUMMY_USER },
    })
  ),

  // 관리자 세션 복원 (AdminLayout 마운트 시 refreshAdminAuth)
  http.post('/api/admin/auth/refresh', () =>
    HttpResponse.json({
      success: true,
      data: { accessToken: DUMMY_ADMIN_ACCESS_TOKEN, user: DUMMY_ADMIN_USER },
    })
  ),

  // 관리자 로그인 폼 제출
  http.post('/api/admin/auth/login', () =>
    HttpResponse.json({
      success: true,
      data: { accessToken: DUMMY_ADMIN_ACCESS_TOKEN, user: DUMMY_ADMIN_USER },
    })
  ),
]
