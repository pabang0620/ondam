import { create } from 'zustand'

// initAuth 중복 호출 방지용 in-flight Promise 캐시
let _initAuthPromise = null

export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  // FIX: DEV-27 - PrivateRoute/AdminLayout이 비동기 initAuth() 완료 전에 동기적으로
  // isAuthenticated=false만 보고 즉시 /login으로 리다이렉트하던 경쟁 상태를 없애기 위한
  // 초기화 상태 플래그. initAuth()가 성공/실패 어느 경로로 끝나든 finally에서 반드시
  // true로 전이된다(아래 initAuth 참고) - 보호 라우트는 이 값이 true가 되기 전까지는
  // 인증 여부를 판정하지 않고 로딩 상태를 렌더해야 한다.
  isAuthInitialized: false,

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
  //
  // FIX: DEV-28 - 예전에는 이 함수가 apiClient.post('/auth/refresh')로 직접 refresh를
  // 불렀는데, config/apiClient.js의 401 인터셉터도 자체 in-flight promise로 별도의
  // /auth/refresh를 불렀다. 백엔드는 refresh 시 즉시 토큰을 회전 + 기존 토큰을 revoke
  // 하므로, 두 요청이 겹치면 뒤늦게 도착한 쪽이 "이미 사용된 리프레시 토큰"으로 401을
  // 받고 clearUser()가 호출돼 정상 사용자가 로그아웃되는 문제가 있었다. 이제 두 경로 모두
  // config/authRefresh.js의 refreshAuth() 단일 in-flight promise를 공유한다(동적 import는
  // 순환 import 방지용 - authRefresh.js가 이 파일을 static import하므로, 이 파일이 반대로
  // static import하면 순환이 생긴다).
  initAuth: () => {
    if (_initAuthPromise) return _initAuthPromise

    _initAuthPromise = (async () => {
      try {
        const { refreshAuth } = await import('../config/authRefresh.js')
        // refreshAuth() 성공 시 내부적으로 setAuth(user, accessToken)를 호출해
        // user/accessToken/isAuthenticated를 이미 갱신한다.
        await refreshAuth()
      } catch {
        // 세션 없음/만료/타임아웃 - 로그아웃 상태로 확정한다.
        // G2-4: 인증은 어떤 환경(dev 포함)에서도 가짜 로그인 성공으로 폴백하지 않는다.
        set({ user: null, accessToken: null, isAuthenticated: false })
      } finally {
        // 성공/실패 어느 경로로 끝나든 반드시 초기화 완료로 전이한다.
        // 이게 없으면 실패 시 PrivateRoute/AdminLayout이 영구 로딩에 머무른다.
        set({ isAuthInitialized: true })
      }
    })()

    return _initAuthPromise
  },
}))
