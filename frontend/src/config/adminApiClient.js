import axios from 'axios'
import { useAuthStore } from '../store/authStore.js'

const adminApiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

adminApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// FIX: DEV-28 - 이전에는 401을 받으면 window.location.href로 하드 리다이렉트했다.
// 이 전체 새로고침이 authStore를 초기 상태로 리셋하고 App.jsx의 initAuth()를 다시
// 태우는데, /auth/refresh는 rt 쿠키만 있으면 role:'admin'을 다시 복원시킨다. 그 결과
// AdminLayout이 role만 보고 통과 → adminToken 없어 401 → 다시 하드 리다이렉트가
// 반복되는 무한루프가 발생했다. apiClient.js와 동일한 원칙으로, 여기서는 상태만
// 정리하고 실제 이동은 AdminLayout/AdminLoginPage의 가드(라우터)가 담당하게 한다.
// clearUser()로 isAuthenticated를 reactive하게 false로 만들어야 AdminLayout이
// 구독 중인 store 변경을 감지해 즉시 재렌더 → Navigate로 이어진다(하드 리로드 없이).
//
// FIX: DEV-31 - 단, 관리자 "로그인 요청 자체"의 401은 세션 정리 대상에서 제외한다.
// adminApi.login도 이 클라이언트를 쓰기 때문에, 일반 사용자로 로그인한 상태에서
// /admin/login에 비밀번호를 잘못 입력하면 그 401이 clearUser()를 호출해 전역 사용자
// 세션까지 로그아웃되는 부작용이 있었다. 로그인 실패는 폼에 에러를 보여주면 되는
// 상황이지 기존 세션을 끊을 이유가 없다. apiClient.js가 /auth/login·/auth/refresh를
// 401 처리 대상에서 제외하는 것과 동일한 원칙이다.
adminApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAdminLoginRequest = error.config?.url?.includes('/admin/auth/login')

    if (error.response?.status === 401 && !isAdminLoginRequest) {
      localStorage.removeItem('adminToken')
      useAuthStore.getState().clearUser()
    }
    return Promise.reject(error)
  },
)

export default adminApiClient
