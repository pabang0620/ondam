import { create } from 'zustand'

const IS_DEV = import.meta.env.DEV

// 개발 환경에서 모든 페이지(admin 포함) 접근 가능하도록 admin role 부여
const MOCK_USER = {
  user_id: 'mock-user-001',
  email: 'demo@ondam.kr',
  nickname: '데모 사용자',
  role: 'admin',
}

// initAuth 중복 호출 방지용 in-flight Promise 캐시
let _initAuthPromise = null

export const useAuthStore = create((set) => ({
  user: IS_DEV ? MOCK_USER : null,
  accessToken: IS_DEV ? 'mock-token' : null,
  isAuthenticated: IS_DEV,

  setAuth: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true }),

  setAccessToken: (accessToken) =>
    set({ accessToken }),

  clearUser: () => {
    _initAuthPromise = null
    set({ user: null, accessToken: null, isAuthenticated: false })
  },

  // 앱 초기화 시 /auth/refresh 로 세션 복원
  // StrictMode에서 useEffect가 두 번 호출되어도 API 요청은 1회만 발생
  initAuth: () => {
    if (_initAuthPromise) return _initAuthPromise

    _initAuthPromise = (async () => {
      try {
        const { default: apiClient } = await import('../config/apiClient.js')
        const { data } = await apiClient.post('/auth/refresh')
        if (data.success) {
          set({ user: data.data.user, accessToken: data.data.accessToken, isAuthenticated: true })
        }
      } catch {
        if (IS_DEV) {
          // 개발 환경에서만 mock으로 폴백 (백엔드 미연결 개발 환경)
          set({ user: MOCK_USER, accessToken: 'mock-token', isAuthenticated: true })
        } else {
          // 프로덕션: 인증 실패 → 로그아웃 상태
          set({ user: null, accessToken: null, isAuthenticated: false })
        }
      }
    })()

    return _initAuthPromise
  },
}))
