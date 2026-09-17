// [DESIGN-PREVIEW] MSW mock handler - photo 도메인, 실제 백엔드 없이 로컬 디자인 검토용
//
// 커버 범위: src/pages/photo/photoApi.js 가 호출하는 모든 엔드포인트.
// - GET/POST 계열은 실제 훅(usePhotoOrder/usePhotoPayment/usePhotoProcessing/usePhotoResult)이
//   response.data.data에서 꺼내 쓰는 필드명을 그대로 맞춰서 응답한다 (필드명 미스매치 방지).
// - DEV-24 원칙: 클라이언트 훅은 절대 수정하지 않는다. 네트워크 계층(MSW)에서만 성공
//   응답을 만들어 "백엔드가 정상 동작하는 것처럼" 보이게 한다.
// - GET /photo/orders/:orderId/status는 폴링될 때마다 progress가 올라가다가 completed로
//   끝나서 PhotoProcessingPage -> PhotoResultPage로 자연스럽게 전환된다.
//
// 주의: /auth/consents는 auth 도메인 엔드포인트지만 photoApi.js(savePhotoConsents)가 직접
// 호출하며 주문 생성 전 필수 단계라 이 파일에 함께 mock한다(다른 도메인 담당자가 별도로
// auth.js에서도 이 경로를 다룰 수 있으니 충돌 시 하나만 남기면 된다).

import { http, HttpResponse } from 'msw'

// GET /photo/orders/:orderId/status 폴링 시 마다 진행률을 올려서 몇 번의 폴링 뒤
// completed 상태로 종료시킨다 (orderId별로 독립적으로 진행되도록 Map으로 추적).
const processingProgressByOrderId = new Map()

function getNextProcessingProgress(orderId) {
  const current = processingProgressByOrderId.get(orderId) ?? 0
  const next = Math.min(current + 35, 100)
  processingProgressByOrderId.set(orderId, next)
  return next
}

function buildMockPhotoOrder(orderId, overrides = {}) {
  return {
    order_id: orderId,
    id: orderId,
    photo_type: 'funeral',
    status: 'paid',
    price_krw: 9900,
    source_image_url: 'https://picsum.photos/seed/ondam-photo-source/800/600',
    created_at: '2026-09-10T09:00:00+09:00',
    ...overrides,
  }
}

function buildMockResultFiles(orderId) {
  return [
    {
      file_id: `${orderId}-raw`,
      kind: 'raw',
      file_url: 'https://picsum.photos/seed/ondam-photo-raw/800/600',
    },
    {
      file_id: `${orderId}-enhanced-1`,
      kind: 'enhanced',
      variantKey: 'restore',
      variantLabel: '화질 복원본',
      file_url: 'https://picsum.photos/seed/ondam-photo-1/800/600',
    },
    {
      file_id: `${orderId}-enhanced-2`,
      kind: 'enhanced',
      variantKey: 'colorize',
      variantLabel: '컬러 복원본',
      file_url: 'https://picsum.photos/seed/ondam-photo-2/800/600',
    },
    {
      file_id: `${orderId}-enhanced-3`,
      kind: 'enhanced',
      variantKey: 'bg_remove',
      variantLabel: '배경 제거본',
      file_url: 'https://picsum.photos/seed/ondam-photo-3/800/600',
    },
    {
      file_id: `${orderId}-enhanced-4`,
      kind: 'enhanced',
      variantKey: 'suit',
      variantLabel: '정장 합성본',
      file_url: 'https://picsum.photos/seed/ondam-photo-4/800/600',
    },
  ]
}

export const handlers = [
  // 초상권·AI 생성물 동의 저장 (usePhotoOrder.handleSubmit 최초 단계)
  http.post('/api/auth/consents', () => {
    return HttpResponse.json({
      success: true,
      message: '동의가 저장되었습니다.',
      data: { savedCount: 2 },
    })
  }),

  // 사진 업로드 (usePhotoOrder.handleFileUpload) - data.data.s3Key / data.data.url 사용
  http.post('/api/uploads/photo', () => {
    return HttpResponse.json({
      success: true,
      message: '업로드가 완료되었습니다.',
      data: {
        s3Key: 'photos/mock-user-uuid/mock-job-uuid/original.jpg',
        url: 'https://picsum.photos/seed/ondam-photo-upload/800/600',
      },
    })
  }),

  // 사진 주문 생성 (usePhotoOrder.handleSubmit) - data.data.orderId ?? data.data.id 사용
  http.post('/api/photo/orders', async ({ request }) => {
    const body = await request.json().catch(() => ({}))
    const orderId = `mock-photo-order-${Date.now()}`
    return HttpResponse.json({
      success: true,
      message: '주문이 생성되었습니다.',
      data: buildMockPhotoOrder(orderId, {
        photo_type: body?.photoType ?? 'funeral',
        source_image_url: body?.sourceImageUrl ?? 'https://picsum.photos/seed/ondam-photo-source/800/600',
        status: 'pending_payment',
      }),
    })
  }),

  // 사진 주문 목록 조회
  http.get('/api/photo/orders', () => {
    return HttpResponse.json({
      success: true,
      data: [
        buildMockPhotoOrder('mock-photo-order-1', { photo_type: 'funeral', status: 'completed' }),
        buildMockPhotoOrder('mock-photo-order-2', { photo_type: 'id', status: 'processing' }),
        buildMockPhotoOrder('mock-photo-order-3', { photo_type: 'job', status: 'pending_payment' }),
      ],
      meta: { total: 3, page: 1, limit: 20 },
    })
  }),

  // 사진 주문 상세 조회 (usePhotoPayment) - res.data.data.price_krw 사용
  http.get('/api/photo/orders/:orderId', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: buildMockPhotoOrder(params.orderId, { status: 'paid' }),
    })
  }),

  // 사진 처리 상태 폴링 (usePhotoProcessing) - data.data.status/progress/jobId 사용.
  // 몇 번 폴링되면 completed로 종료되어 결과 페이지로 자동 이동한다.
  http.get('/api/photo/orders/:orderId/status', ({ params }) => {
    const progress = getNextProcessingProgress(params.orderId)
    const status = progress >= 100 ? 'completed' : 'processing'
    return HttpResponse.json({
      success: true,
      data: {
        status,
        progress,
        jobId: `mock-job-${params.orderId}`,
      },
    })
  }),

  // 사진 처리 결과 조회 (usePhotoResult) - data.data.order / data.data.files 사용
  http.get('/api/photo/orders/:orderId/result', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        order: buildMockPhotoOrder(params.orderId, { status: 'completed' }),
        files: buildMockResultFiles(params.orderId),
      },
    })
  }),

  // 재처리 요청 (usePhotoResult.handleRetry)
  http.post('/api/photo/orders/:orderId/retry', ({ params }) => {
    processingProgressByOrderId.delete(params.orderId)
    return HttpResponse.json({
      success: true,
      message: '재처리 요청이 접수되었습니다.',
      data: { orderId: params.orderId, status: 'processing' },
    })
  }),

  // AI 처리 시작 (PhotoPaymentSuccessPage)
  http.post('/api/photo/orders/:orderId/start', ({ params }) => {
    return HttpResponse.json({
      success: true,
      message: 'AI 처리가 시작되었습니다.',
      data: { orderId: params.orderId, status: 'processing' },
    })
  }),

  // 결제 준비 (usePhotoPayment.handlePay) - data.data.tossOrderId/amountKrw 사용
  http.post('/api/payments/prepare', () => {
    return HttpResponse.json({
      success: true,
      data: {
        tossOrderId: `mock_toss_order_${Date.now()}`,
        amountKrw: 9900,
      },
    })
  }),

  // 결제 승인 콜백 (PhotoPaymentSuccessPage) - target_id를 일부러 비워서 프론트가
  // sessionStorage의 pendingPhotoOrderId(실제 photo_orders.order_id)로 폴백하게 한다.
  http.post('/api/payments/confirm', () => {
    return HttpResponse.json({
      success: true,
      message: '결제가 승인되었습니다.',
      data: {
        payment: {
          payment_key: `mock_payment_key_${Date.now()}`,
          status: 'DONE',
          approved_at: new Date().toISOString(),
        },
      },
    })
  }),
]
