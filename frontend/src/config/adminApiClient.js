import axios from 'axios'
import { create } from 'zustand'

// ─── 관리자 accessToken (메모리 전용) ──────────────────────────────────────────
// phase0-followups B-3: XSS로 탈취 가능한 localStorage 대신 메모리에만 보관한다.
// 페이지 새로고침으로 사라지는 것이 정상 동작이며, 세션 복원은 refreshAdminAuth()가
// HttpOnly 쿠키('art')를 통해 담당한다.
let adminAccessToken = null

export const getAdminAccessToken = () => adminAccessToken

export const setAdminAccessToken = (token) => {
  adminAccessToken = token
}

export const clearAdminAccessToken = () => {
  adminAccessToken = null
}

// ─── 관리자 user 세션 상태 (useAuthStore와 완전히 분리된 전용 store) ───────────
// 교차검증 HIGH-1: 예전에는 관리자 로그인/refresh가 useAuthStore.setAuth()를 호출해
// 일반 사용자와 "같은 store"를 공유했다. 그 결과:
//  (a) AdminLayout의 refreshAdminAuth()와 App.jsx의 전역 initAuth()(일반 rt 쿠키
//      기반)가 동시에 떠서, 관리자가 일반 사용자로도 로그인돼 있는 상태(rt 쿠키
//      보유)로 /admin을 새로고침하면 나중에 끝난 initAuth()가 setAuth(일반사용자,
//      사용자토큰)으로 덮어써 유효한 관리자 세션인데 role !== 'admin'으로 튕겼다.
//  (b) apiClient.js가 useAuthStore.getState().accessToken을 그대로 Authorization에
//      실으므로, 관리자 로그인 직후 공개 사이트로 이동하면 모든 일반 API가 userId
//      없는 관리자 토큰으로 호출돼 빈 결과·오동작을 냈다.
// 두 문제의 공통 뿌리(store 공유)를 없애기 위해 관리자 user 정보를 이 전용 store에
// 둔다. adminAccessToken(위 모듈 스코프 변수)과 이 store가 합쳐 "관리자 세션"을
// 이룬다 - useAuthStore는 이제 관리자 로그인 흐름에서 전혀 쓰이지 않는다.
export const useAdminAuthStore = create((set) => ({
  adminUser: null,
  setAdminUser: (adminUser) => set({ adminUser }),
  clearAdminUser: () => set({ adminUser: null }),
}))

// 메모리 토큰 + 관리자 user store를 한 번에 정리하는 조합 헬퍼.
// 로그아웃 성공, refresh 실패, 401 재갱신 실패 - 세 경로 모두 이걸 쓴다.
export const clearAdminSession = () => {
  clearAdminAccessToken()
  useAdminAuthStore.getState().clearAdminUser()
}

// 관리자 로그아웃 - 서버(art 쿠키 무효화) + 클라이언트 상태 정리를 함께 수행한다.
// 서버 호출이 실패(네트워크 오류·이미 만료된 세션의 401 등)해도 클라이언트측
// 정리는 항상 수행한다 - 호출부(Header/AdminLayout)가 "관리자 세션 정리 실패가
// 자신의 로그아웃 흐름을 막지 않아야 한다"는 요구를 신경 쓰지 않아도 되게 한다.
export const logoutAdminSession = async () => {
  try {
    await adminApiClient.post('/admin/auth/logout')
  } catch {
    // 서버 오류/세션 없음이어도 클라이언트측 정리는 계속 진행
  } finally {
    clearAdminSession()
  }
}

// ─── 관리자 세션 갱신 (refreshAuth()의 관리자 버전) ────────────────────────────
// config/authRefresh.js와 동일한 in-flight promise 공유 원칙 - 동시에 여러 요청이
// 401을 받아도 /admin/auth/refresh는 1회만 호출한다.
let _adminRefreshPromise = null

export function refreshAdminAuth() {
  if (!_adminRefreshPromise) {
    _adminRefreshPromise = axios
      .post('/api/admin/auth/refresh', {}, { withCredentials: true, timeout: 10000 })
      .then(({ data }) => {
        if (!data.success) {
          throw new Error(data.message || 'admin refresh failed')
        }
        const { accessToken, user } = data.data
        setAdminAccessToken(accessToken)
        // FIX: HIGH-1 - useAuthStore(일반 사용자 store)를 더 이상 건드리지 않는다.
        // 관리자 user는 위 useAdminAuthStore 전용 store에만 반영한다.
        useAdminAuthStore.getState().setAdminUser(user)
        return { accessToken, user }
      })
      .catch((err) => {
        clearAdminSession()
        throw err
      })
      .finally(() => {
        _adminRefreshPromise = null
      })
  }
  return _adminRefreshPromise
}

const adminApiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

adminApiClient.interceptors.request.use((config) => {
  if (adminAccessToken) config.headers.Authorization = `Bearer ${adminAccessToken}`
  return config
})

// 401 시 관리자 세션 갱신 후 재시도 - config/apiClient.js와 동일한 원칙
// - original._retry 플래그로 무한 루프 방지
// - /admin/auth/login, /admin/auth/refresh 요청 자체는 재시도·세션 정리 대상에서 제외
//   (로그인 실패는 폼 에러로 처리하면 되고, refresh 자신의 401이 refresh를 다시
//    부르는 재귀를 막아야 한다)
adminApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const url = originalRequest?.url ?? ''

    const isExcluded = url.includes('/admin/auth/login') || url.includes('/admin/auth/refresh')
    const is401 = error.response?.status === 401
    const alreadyRetried = originalRequest?._retry

    if (is401 && !alreadyRetried && !isExcluded) {
      originalRequest._retry = true
      try {
        const { accessToken } = await refreshAdminAuth()
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return adminApiClient(originalRequest)
      } catch (refreshError) {
        // FIX: HIGH-1 - 예전에는 여기서 useAuthStore.getState().clearUser()를 호출해
        // 관리자 세션 갱신 실패가 일반 사용자 세션까지 로그아웃시켰다(두 store가
        // 같았을 때의 잔재). 이제 관리자 세션만 정리한다.
        clearAdminSession()
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)

export default adminApiClient
