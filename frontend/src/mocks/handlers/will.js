// [DESIGN-PREVIEW] MSW mock handler - will 도메인, 실제 백엔드 없이 로컬 디자인 검토용
import { http, HttpResponse } from 'msw'

// 공개 샘플 미디어(라이선스 프리) - 실제 영상/음성 파일이 필요한 화면(watch/vault 등)의
// <video>/<a download> 미리보기가 깨지지 않도록 실존하는 공개 URL을 사용한다.
const SAMPLE_VIDEO_URL = 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4'
const SAMPLE_PHOTO_URL = 'https://picsum.photos/seed/ondam-will/800/800'
const SAMPLE_DOC_URL = 'https://picsum.photos/seed/ondam-death-cert/800/1000'

// willApi.getWills / WillVaultPage가 실제로 읽는 필드(snake_case: will_id/created_at)에
// 정확히 맞춘 더미 목록. 배지 종류(draft/paid/active/released)를 모두 보여줄 수 있게 구성.
const MOCK_WILLS = [
  {
    will_id: 'mock-will-0001',
    title: '사랑하는 가족에게',
    status: 'active',
    created_at: '2026-09-01T09:00:00+09:00',
  },
  {
    will_id: 'mock-will-0002',
    title: '아이들에게 남기는 말',
    status: 'paid',
    created_at: '2026-09-05T14:30:00+09:00',
  },
  {
    will_id: 'mock-will-0003',
    title: '나의 영상 편지',
    status: 'draft',
    created_at: '2026-09-10T18:12:00+09:00',
  },
]

export const handlers = [
  // ── 유언장(will) 목록 / 상세 / 상태 ─────────────────────────────────────
  // GET /api/will/wills - 보관함 목록 (WillVaultPage)
  http.get('/api/will/wills', () => {
    return HttpResponse.json({ success: true, data: MOCK_WILLS })
  }),

  // GET /api/will/wills/:willId - 상세 (useWillPayment가 price_krw만 사용)
  http.get('/api/will/wills/:willId', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        will_id: params.willId,
        title: '사랑하는 가족에게',
        status: 'paid',
        price_krw: 49000,
        content_text: '항상 고맙고 사랑한다는 말을 전하고 싶었어요.',
        created_at: '2026-09-05T14:30:00+09:00',
      },
    })
  }),

  // GET /api/will/wills/:willId/status - 영상 생성 폴링 (useWillProcessing)
  // 요청대로 처리 상태는 completed로 고정 - 폴링 즉시 완료되어 보관함으로 이동한다.
  http.get('/api/will/wills/:willId/status', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        job: {
          jobId: `mock-job-${params.willId}`,
          jobType: 'will_video_generate',
          jobStatus: 'completed',
          progress: 100,
          errorMessage: null,
        },
      },
    })
  }),

  // POST /api/will/wills - 유언장 생성 (useWillPreview)
  http.post('/api/will/wills', () => {
    return HttpResponse.json({
      success: true,
      data: { will_id: 'mock-will-0099' },
    })
  }),

  // POST /api/will/wills/:willId/activate - 영상 생성 시작 (결제 후)
  http.post('/api/will/wills/:willId/activate', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: { will_id: params.willId, status: 'processing' },
    })
  }),

  // ── 음성 샘플 ───────────────────────────────────────────────────────────
  // POST /api/will/voice-samples - 음성 샘플 등록 (useWillRecord)
  http.post('/api/will/voice-samples', () => {
    return HttpResponse.json({
      success: true,
      data: { voiceSampleId: 'mock-voice-sample-0001' },
    })
  }),

  // GET /api/will/voice-samples/:id/status - 클론 상태 조회
  http.get('/api/will/voice-samples/:id/status', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: { voiceSampleId: params.id, status: 'completed' },
    })
  }),

  // ── 사후 공개(release) - 비회원, 초대 토큰 경유 ──────────────────────────
  // POST /api/will/release/:token/upload - 사망증명서 업로드
  http.post('/api/will/release/:token/upload', () => {
    return HttpResponse.json({
      success: true,
      data: {
        s3Key: 'wills/mock-user/mock-will/death-cert/mock-cert.jpg',
        url: SAMPLE_DOC_URL,
      },
    })
  }),

  // POST /api/will/release/:token - 사후 공개 요청 접수
  http.post('/api/will/release/:token', () => {
    return HttpResponse.json({
      success: true,
      message: '서류가 접수되었습니다. 관리자 검토 후 1~3 영업일 이내에 안내드립니다.',
      data: null,
    })
  }),

  // ── 유언 영상 열람(watch) - 비회원, 초대 토큰 경유 ───────────────────────
  // GET /api/will/watch/:token - 진입 시 최소 정보 (useWillWatch가 읽는 필드에 정확히 맞춤)
  http.get('/api/will/watch/:token', () => {
    return HttpResponse.json({
      success: true,
      data: {
        beneficiaryName: '김민준',
        willTitle: '사랑하는 가족에게',
        expired: false,
        locked: false,
      },
    })
  }),

  // POST /api/will/watch/:token/verify - 본인 확인 성공 시 영상 URL 발급
  http.post('/api/will/watch/:token/verify', () => {
    return HttpResponse.json({
      success: true,
      data: {
        will: { title: '사랑하는 가족에게' },
        videoUrl: SAMPLE_VIDEO_URL,
        downloadUrl: SAMPLE_VIDEO_URL,
      },
    })
  }),

  // POST /api/will/watch/:token/extend - 열람 링크 연장 요청 (재발급 토큰은 응답에 담기지 않음)
  http.post('/api/will/watch/:token/extend', () => {
    return HttpResponse.json({
      success: true,
      message: '등록된 연락처로 새 링크를 보내드렸습니다.',
      data: null,
    })
  }),

  // ── 업로드 (오디오/사진) - will 녹음/사진 단계에서 사용 ──────────────────
  // POST /api/uploads/audio
  http.post('/api/uploads/audio', () => {
    return HttpResponse.json({
      success: true,
      data: {
        s3Key: 'wills/mock-user/mock-will/audio/voice-sample.webm',
        url: SAMPLE_VIDEO_URL,
      },
    })
  }),

  // POST /api/uploads/photo
  http.post('/api/uploads/photo', () => {
    return HttpResponse.json({
      success: true,
      data: {
        s3Key: 'wills/mock-user/mock-will/photo/profile.jpg',
        url: SAMPLE_PHOTO_URL,
      },
    })
  }),

  // ── 동의 항목 저장 - useWillConsent ──────────────────────────────────────
  // POST /api/auth/consents
  http.post('/api/auth/consents', () => {
    return HttpResponse.json({
      success: true,
      message: '동의 내역이 저장되었습니다.',
      data: null,
    })
  }),

  // ── 결제 - useWillPayment / WillPaymentSuccessPage ──────────────────────
  // POST /api/payments/prepare
  http.post('/api/payments/prepare', () => {
    return HttpResponse.json({
      success: true,
      data: {
        tossOrderId: 'mock-order-20260914-0001',
        amountKrw: 49000,
      },
    })
  }),

  // POST /api/payments/confirm
  http.post('/api/payments/confirm', () => {
    return HttpResponse.json({
      success: true,
      data: {
        payment: {
          target_id: 'mock-will-0001',
          payment_key: 'mock_payment_key_0001',
          order_id: 'mock-order-20260914-0001',
          amount: 49000,
          status: 'DONE',
        },
      },
    })
  }),
]
