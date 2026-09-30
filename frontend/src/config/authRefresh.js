import axios from 'axios'
import { useAuthStore } from '../store/authStore.js'

// FIX: DEV-28 - refresh 진입점을 이 모듈 하나로 통일한다.
// 이전에는 store/authStore.js의 initAuth()와 config/apiClient.js의 401 인터셉터가
// 각자 독립적인 in-flight promise(_initAuthPromise / _refreshPromise)로 /auth/refresh를
// 불렀다. 백엔드는 refresh 시 즉시 refreshToken을 회전시키고 기존 토큰을 revoke하므로,
// 두 경로가 겹치면(예: 카카오 콜백의 /users/me 401이 인터셉터 refresh를 발화시키는
// 시점에 App의 initAuth() refresh가 아직 진행 중인 경우) 뒤늦게 도착한 쪽이 "이미 사용된
// 리프레시 토큰"으로 401을 받아 정상 사용자가 로그아웃되는 문제가 있었다.
// 이제 아래 단일 함수와 단일 in-flight promise만 존재하며, initAuth()와 apiClient.js의
// 401 인터셉터 둘 다 이 함수를 호출한다.
//
// 순환 import 방지: 이 모듈은 authStore.js를 static import하지만, authStore.js는 이
// 모듈을 initAuth() 내부에서 동적 import(await import(...))로만 참조한다. 즉 모듈
// 평가(로드) 시점에는 authStore.js -> authRefresh.js 방향의 static 참조가 없으므로
// 순환 로드가 발생하지 않는다.
let _refreshPromise = null

export function refreshAuth() {
  if (!_refreshPromise) {
    _refreshPromise = axios
      .post('/api/auth/refresh', {}, { withCredentials: true, timeout: 10000 })
      .then(({ data }) => {
        if (!data.success) {
          // 2xx인데 success:false면 서버가 세션을 거부한 것 - apiClient가 로그아웃 판정에 쓴다
          const err = new Error(data.message || 'refresh failed')
          err.isAuthRejected = true
          throw err
        }
        const { accessToken, user } = data.data
        // FIX: DEV-28 - accessToken만 세팅하면 clearUser() 이후 refresh가 뒤늦게 성공하는
        // 순서에서 API 호출은 되는데 isAuthenticated는 false로 남아 UI가 로그아웃 상태로
        // 보이는 문제가 있었다. setAuth()로 user·accessToken·isAuthenticated를 함께 복구한다.
        useAuthStore.getState().setAuth(user, accessToken)
        return accessToken
      })
      .finally(() => {
        _refreshPromise = null
      })
  }
  return _refreshPromise
}
