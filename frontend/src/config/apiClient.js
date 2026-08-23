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
// FIX: 본인확인 시도 횟수 2배 차감 결함 - 무인증 공개 링크(선물 수행/유언 열람/공개
// 임종 등록)는 로그인 세션과 완전히 무관하다. 이 경로들을 401 재시도 대상에서
// 제외하지 않으면:
//   (a) 비로그인 방문자 - refreshAuth()가 "리프레시 토큰이 없습니다"로 실패하고
//       그 refreshError가 서버가 실제로 보낸 메시지(예: 본인확인 "N회 남음" 안내)를
//       덮어써 화면에 엉뚱한 문구가 뜬다.
//   (b) 로그인 상태 - refreshAuth()가 성공해 시도 횟수를 차감하는 원 요청(POST
//       verify)이 자동 재시도되어, 버튼 1클릭에 서버 상태(시도 횟수)가 2번 바뀐다.
// 근본 원인은 서버가 본인확인 실패를 401로 잘못 응답하던 것이었고(백엔드에서 400으로
// 수정 완료), 이 제외 목록은 그와 무관하게 "무인증 공개 경로는 애초에 리프레시
// 대상이 아니다"를 보장하는 방어선(defense in depth)이다 - 향후 이 경로들에서 다른
// 이유로 401이 나더라도 side-effect가 있는 요청이 함부로 재시도되지 않는다.
const PUBLIC_UNAUTH_PATH_PATTERNS = ['/gifts/perform/', '/will/watch/', '/will/release/']

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh')
    const isPublicUnauthPath = PUBLIC_UNAUTH_PATH_PATTERNS.some((p) => originalRequest?.url?.includes(p))
    const isExcluded = isAuthEndpoint || isPublicUnauthPath
    const is401 = error.response?.status === 401
    const alreadyRetried = originalRequest?._retry

    if (is401 && !alreadyRetried && !isExcluded) {
      originalRequest._retry = true
      try {
        const newToken = await refreshAuth()
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        // refresh 자체가 실패해도(리프레시 토큰 없음/만료 등) 원 요청이 실제로 받은
        // 에러(error)를 그대로 전달한다 - refreshError로 치환하면 원 요청의 실제
        // 서버 메시지가 "리프레시 토큰이 없습니다" 같은 무관한 문구로 가려진다.
        console.error('[apiClient] 토큰 갱신 실패:', refreshError?.message)
        useAuthStore.getState().clearUser()
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  },
)

export default apiClient
