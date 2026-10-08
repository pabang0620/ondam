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

// [DESIGN-PREVIEW] 로그아웃 유지 플래그.
// 실제 서버는 로그아웃 시 리프레시 토큰을 폐기하므로 새로고침해도 로그아웃이 유지된다.
// 목업도 이를 흉내 내기 위해 localStorage에 플래그를 남긴다(MSW 핸들러는 브라우저
// 메인 스레드에서 실행되므로 localStorage 접근 가능).
// 플래그 해제: 로그인하거나, 개발자도구 > Application > Local Storage에서
// 'ondam:mock-logged-out' 키를 삭제 후 새로고침.
const LOGGED_OUT_FLAG_KEY = 'ondam:mock-logged-out'

const isMockLoggedOut = () => {
  try {
    return localStorage.getItem(LOGGED_OUT_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

const setMockLoggedOut = () => {
  try {
    localStorage.setItem(LOGGED_OUT_FLAG_KEY, '1')
  } catch {
    // 저장소 접근 불가 시 무시 (목업이므로 로그아웃 유지만 포기)
  }
}

const clearMockLoggedOut = () => {
  try {
    localStorage.removeItem(LOGGED_OUT_FLAG_KEY)
  } catch {
    // 무시
  }
}

export const handlers = [
  // 일반 사용자 세션 복원 (App 초기 로드 시 authStore.initAuth -> refreshAuth)
  // 로그아웃 플래그가 있으면 실제 서버처럼 401 (initAuth가 비로그인으로 확정)
  http.post('/api/auth/refresh', () => {
    if (isMockLoggedOut()) {
      return HttpResponse.json(
        { success: false, message: '리프레시 토큰이 없습니다.' },
        { status: 401 }
      )
    }
    return HttpResponse.json({
      success: true,
      data: { accessToken: DUMMY_ACCESS_TOKEN, user: DUMMY_USER },
    })
  }),

  // 일반 사용자 로그인 폼 제출 (로그아웃 플래그 제거)
  http.post('/api/auth/login', () => {
    clearMockLoggedOut()
    return HttpResponse.json({
      success: true,
      data: { accessToken: DUMMY_ACCESS_TOKEN, user: DUMMY_USER },
    })
  }),

  // 일반 사용자 로그아웃 (Header.handleLogout) - 새로고침 후에도 로그아웃 유지
  http.post('/api/auth/logout', () => {
    setMockLoggedOut()
    return HttpResponse.json({ success: true, message: '로그아웃 성공' })
  }),

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
