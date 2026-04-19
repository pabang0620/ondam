import axios from 'axios'
import { useAuthStore } from '../store/authStore.js'

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

// Response interceptor: 401 시 토큰 갱신 후 재시도
// - original._retry 플래그로 무한 루프 방지
// - /auth/login 엔드포인트는 401 재시도 제외
// - refresh 실패 시 clearUser() 후 /login 으로 이동
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    const isLogin = originalRequest?.url?.includes('/auth/login')
    const is401 = error.response?.status === 401
    const alreadyRetried = originalRequest?._retry

    if (is401 && !alreadyRetried && !isLogin) {
      originalRequest._retry = true
      try {
        const { data } = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true },
        )
        const newToken = data.data.accessToken
        useAuthStore.getState().setAccessToken(newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        useAuthStore.getState().clearUser()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)

export default apiClient
