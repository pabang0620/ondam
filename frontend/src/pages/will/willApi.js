import apiClient from '../../config/apiClient.js'

export const willApi = {
  // 음성 샘플 등록
  createVoiceSample: (data) =>
    apiClient.post('/will/voice-samples', data),

  // 음성 샘플 클론 상태 조회
  getVoiceSampleStatus: (id) =>
    apiClient.get(`/will/voice-samples/${id}/status`),

  // 유언장 생성
  createWill: (data) =>
    apiClient.post('/will/wills', data),

  // 유언장 목록
  getWills: () =>
    apiClient.get('/will/wills'),

  // 유언장 상세
  getWill: (willId) =>
    apiClient.get(`/will/wills/${willId}`),

  // 영상 생성 시작 (결제 후)
  activateWill: (willId) =>
    apiClient.post(`/will/wills/${willId}/activate`),

  // 영상 생성 상태 폴링
  getWillStatus: (willId) =>
    apiClient.get(`/will/wills/${willId}/status`),

  // 사망증명서 업로드 (비회원, 초대 토큰 경유 - 계정 불필요)
  uploadDeathCertificate: (token, formData) =>
    apiClient.post(`/will/release/${token}/upload`, formData),

  // 사후 공개 요청 (비회원)
  submitRelease: (token, data) =>
    apiClient.post(`/will/release/${token}`, data),

  // 유언 영상 열람 - 진입 시 최소 정보만 (수신인 이름, 잠금 여부) - 영상 URL 없음
  getWatchInfo: (token) =>
    apiClient.get(`/will/watch/${token}`),

  // 본인 확인 (휴대폰 뒤 4자리) - 성공 시에만 영상 URL 발급
  verifyWatchAccess: (token, phoneLast4) =>
    apiClient.post(`/will/watch/${token}/verify`, { phoneLast4 }),

  // 열람 링크 연장 요청 (만료 후 재발급, SPEC-05 3절)
  requestWatchExtension: (token) =>
    apiClient.post(`/will/watch/${token}/extend`),

  // 파일 업로드 (오디오)
  uploadAudio: (formData) =>
    apiClient.post('/uploads/audio', formData),

  // 파일 업로드 (사진)
  uploadPhoto: (formData) =>
    apiClient.post('/uploads/photo', formData),

  // 동의 항목 저장
  saveConsents: (consents) =>
    apiClient.post('/auth/consents', { consents }),

  // 결제 준비
  // FIX: DEV-29 - 금액은 서버가 targetId로 조회한 wills.price_krw를 정본으로 쓴다
  // (백엔드 preparePayment는 body의 amountKrw를 아예 읽지 않는다). 클라이언트가
  // 금액을 보내는 것 자체가 "가격이 두 곳에 존재한다"는 오해를 유발하므로 보내지 않는다.
  preparePayment: (willId) =>
    apiClient.post('/payments/prepare', {
      targetType: 'will_order',
      targetId: willId,
    }),

  // 결제 확인
  // DEV-25: 백엔드 confirm은 토스 승인 API 응답을 기다린다(TOSS_CONFIRM_TIMEOUT_MS 기본
  // 30초). axios 기본 timeout(10초)보다 짧게 두면 백엔드가 아직 처리 중인데 클라이언트가
  // 먼저 타임아웃 나 버려서 "결제가 실제로 됐는지 알 수 없는" 상태를 만든다. 백엔드
  // 타임아웃보다 여유 있게 35초로 늘린다.
  confirmPayment: ({ paymentKey, orderId, amount }) =>
    apiClient.post(
      '/payments/confirm',
      { paymentKey, orderId, amount },
      { timeout: 35000 },
    ),
}
