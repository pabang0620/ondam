import apiClient from '../../config/apiClient.js'

export const memorialApi = {
  // FIX: DEV-30 - accessCode를 쿼리로 함께 보내야 한다. 백엔드가 "접근 코드 없으면
  // 비공개(404), 있어도 틀리면 403"으로 확정했기 때문에, 이 값 없이는 코드를 아무리
  // 정확히 알아도 절대 열람할 수 없었다.
  getMemorial: (slug, accessCode) =>
    apiClient.get(`/memorial/${slug}`, accessCode ? { params: { accessCode } } : undefined),
}
