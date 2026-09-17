// [DESIGN-PREVIEW] MSW mock handler - gift 도메인, 실제 백엔드 없이 로컬 디자인 검토용
//
// 계약 근거 (GET 계열만 mock - POST는 DEV-24에 따라 훅 폴백 금지 원칙과 무관하게
// 이 작업 범위 밖이라 건드리지 않는다):
// - GET /api/gifts/mine (page, limit) 응답: { success, data: [...] }
//   src/pages/gift/useGiftMine.js가 data.data를 배열로 받아 그대로 gifts에 저장.
//   src/pages/gift/GiftMinePage.jsx가 실제로 참조하는 필드는 스네이크케이스
//   (gift_id, product_type, status, recipient_name, payment_id) - giftApi.js의
//   나머지 함수(createGiftOrder 등 카멜케이스 페이로드)와 다르므로 혼동 주의.
//   status는 useGiftMine.js의 STATUS_LABELS 키(paid/link_sent/opened/in_progress/
//   completed/declined/refunded/expired) 중 하나여야 라벨이 정상 표시된다.
//   canResend/canCancel 버튼 노출 조건(GiftMinePage.jsx)까지 재현하려고 payment_id를
//   채워 넣고 status를 다양하게 섞는다.
//
// - GET /api/gifts/perform/:token 응답: { success, data: {...} }
//   src/pages/gift/useGiftPerform.js가 data.data를 그대로 info로 저장하고
//   locked/alreadyVerified로 phase를 분기한다. alreadyVerified: true로 두어
//   POST /gifts/perform/:token/verify(이 작업 범위 밖) 없이도 바로 INTRO 화면
//   (GiftPerformPage.jsx의 IntroStep - giverNickname, productType 사용)을
//   디자인 검토할 수 있게 한다.
import { http, HttpResponse } from 'msw'

const DUMMY_GIFTS = [
  {
    gift_id: 'design-preview-gift-0001',
    product_type: 'photo',
    status: 'link_sent',
    recipient_name: '김순자',
    payment_id: 'design-preview-payment-0001',
  },
  {
    gift_id: 'design-preview-gift-0002',
    product_type: 'will',
    status: 'in_progress',
    recipient_name: '박영수',
    payment_id: 'design-preview-payment-0002',
  },
  {
    gift_id: 'design-preview-gift-0003',
    product_type: 'photo',
    status: 'completed',
    recipient_name: '이말순',
    payment_id: 'design-preview-payment-0003',
  },
]

const DUMMY_PERFORM_INFO = {
  giftId: 'design-preview-gift-0001',
  locked: false,
  alreadyVerified: true,
  giverNickname: '디자인검토',
  productType: 'photo',
}

export const handlers = [
  // 내가 보낸 선물 목록 (GiftMinePage)
  http.get('/api/gifts/mine', () =>
    HttpResponse.json({
      success: true,
      data: DUMMY_GIFTS,
      meta: { total: DUMMY_GIFTS.length, page: 1, limit: 20 },
    })
  ),

  // 선물 수행 링크 정보 조회 - 무인증 공개 경로 (GiftPerformPage)
  http.get('/api/gifts/perform/:token', () =>
    HttpResponse.json({
      success: true,
      data: DUMMY_PERFORM_INFO,
    })
  ),
]
