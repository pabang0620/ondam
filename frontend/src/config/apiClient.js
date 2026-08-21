import axios from 'axios'
import { useAuthStore } from '../store/authStore.js'
import { refreshAuth } from './authRefresh.js'

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Request interceptor: accessToken 자동 첨부
// FormData인 경우 Content-Type 제거 (multipart boundary 자동 설정), timeout 120000으로 변경
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
    config.timeout = 120000
  }

  return config
})

// FIX: DEV-28 - refresh는 config/authRefresh.js의 refreshAuth() 하나로 통일했다.
// (이전에는 이 파일이 자체 _refreshPromise/refreshAccessToken을 갖고 있어서
// store/authStore.js의 initAuth()와 서로 다른 in-flight promise로 /auth/refresh를
// 각자 불렀다 - 두 경로가 겹치면 백엔드의 refresh token 즉시회전으로 인해 뒤늦은 쪽이
// 401을 받아 정상 사용자가 로그아웃되는 문제가 있었다. 상세 근거는 authRefresh.js 참고)
//
// Response interceptor: 401 시 토큰 갱신 후 재시도
// - original._retry 플래그로 무한 루프 방지
// - /auth/login, /auth/refresh 요청 자체는 401 재시도 대상에서 제외
//   (제외하지 않으면 refresh 자신의 401이 refresh를 다시 부르는 재귀가 발생한다.
//    App.jsx의 initAuth()는 모든 페이지 로드마다 /auth/refresh를 호출하므로, 이 제외가
//    없으면 비로그인 방문자가 추모관 열람 링크 같은 공개 페이지를 열 때마다 재귀 401을
//    거쳐 아래 하드 리다이렉트로 튕겨나갔다)
// - refresh 실패 시에는 clearUser()로 로그아웃 상태만 만들고, 하드 리다이렉트는 하지
//   않는다. 공개 페이지에서는 비로그인 상태로 그대로 머물러야 하고, 보호 라우트는
//   PrivateRoute/AdminLayout이 isAuthenticated를 구독해 알아서 /login으로 이동시킨다.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    const isExcluded =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh')
    const is401 = error.response?.status === 401
    const alreadyRetried = originalRequest?._retry

    if (is401 && !alreadyRetried && !isExcluded) {
      originalRequest._retry = true
      try {
        const newToken = await refreshAuth()
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        useAuthStore.getState().clearUser()
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)

export default apiClient
