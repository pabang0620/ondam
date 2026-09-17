// [DESIGN-PREVIEW] MSW mock handler - pet 도메인, 실제 백엔드 없이 로컬 디자인 검토용
import { http, HttpResponse } from 'msw'

// petApi.js가 호출하는 모든 경로는 apiClient의 baseURL('/api')을 통해 나가므로
// 여기서도 반드시 '/api'로 시작하는 절대 경로를 사용한다.

const now = Date.now()
const DAY_MS = 24 * 60 * 60 * 1000

// 반려동물 목록 (usePet) - 리스트 UI 검토를 위해 alive/deceased, 강아지/고양이 혼합 3마리
const MOCK_PETS = [
  {
    pet_id: 'pet-mock-1',
    name: '몽이',
    species: 'dog',
    breed: '말티즈',
    pet_status: 'deceased',
    profile_image_url: 'https://placedog.net/800/600?id=21',
    birth_date: '2012-05-03',
    death_date: '2025-11-20',
    memorial_slug: 'monggi',
    is_public: 0,
  },
  {
    pet_id: 'pet-mock-2',
    name: '나비',
    species: 'cat',
    breed: '코리안숏헤어',
    pet_status: 'alive',
    profile_image_url: 'https://placekitten.com/800/600',
    birth_date: '2019-09-14',
    death_date: null,
    memorial_slug: null,
    is_public: 0,
  },
  {
    pet_id: 'pet-mock-3',
    name: '콩이',
    species: 'dog',
    breed: '푸들',
    pet_status: 'alive',
    profile_image_url: 'https://placedog.net/800/600?id=42',
    birth_date: '2021-02-11',
    death_date: null,
    memorial_slug: null,
    is_public: 0,
  },
]

// 반려동물 상세(usePetDetail) - :petId는 어떤 값이 와도 이 상세 하나를 반환한다.
// deceased 상태로 두어 추모 페이지 링크·접근 코드 설정 섹션까지 함께 검토 가능하게 한다.
function buildPetDetail(petId) {
  return {
    pet_id: petId,
    name: '몽이',
    species: 'dog',
    breed: '말티즈',
    pet_status: 'deceased',
    profile_image_url: 'https://placedog.net/800/600?id=21',
    birth_date: '2012-05-03',
    death_date: '2025-11-20',
    memorial_slug: 'monggi',
    is_public: 0,
  }
}

// 반려동물 미디어 목록(usePetDetail/usePetPortrait 공용)
function buildPetMedia() {
  return [
    { media_id: 'media-mock-1', media_type: 'photo', file_url: 'https://placedog.net/800/600?id=21', caption: '산책 나온 몽이' },
    { media_id: 'media-mock-2', media_type: 'photo', file_url: 'https://placedog.net/800/600?id=33', caption: '낮잠 자는 몽이' },
    { media_id: 'media-mock-3', media_type: 'photo', file_url: 'https://placedog.net/800/600?id=54', caption: '생일 기념 사진' },
  ]
}

// 내 구독(usePetSubscription) - active 상태로 두어 SubscriptionStatusCard 전체 UI 검토
const MOCK_SUBSCRIPTION = {
  subscription_id: 'sub-mock-1',
  plan: 'pet_archive',
  price_krw: 4900,
  subStatus: 'active',
  next_billing_at: new Date(now + 20 * DAY_MS).toISOString(),
}

export const handlers = [
  // 반려동물 목록
  http.get('/api/pet', () => {
    return HttpResponse.json({ success: true, data: MOCK_PETS })
  }),

  // 반려동물 미디어 목록 - '/api/pet/:petId' 보다 먼저 등록해도 상관없지만
  // path-to-regexp가 세그먼트 수가 다른 경로를 혼동하지 않으므로 순서는 무관하다.
  http.get('/api/pet/:petId/media', () => {
    return HttpResponse.json({ success: true, data: buildPetMedia() })
  }),

  // 추모 페이지 접근 코드 조회 (소유자 전용)
  http.get('/api/pet/:petId/memorial-code', () => {
    return HttpResponse.json({ success: true, data: { memorialAccessCode: '482913' } })
  }),

  // AI 초상화 남은 매수 조회
  http.get('/api/pet/:petId/portrait/quota', () => {
    return HttpResponse.json({
      success: true,
      data: {
        isSubscribed: true,
        remaining: 2,
        limit: 3,
        resetsAt: new Date(now + 20 * DAY_MS).toISOString(),
      },
    })
  }),

  // AI 초상화 상태 조회 (폴링 - 항상 완료 상태로 응답)
  http.get('/api/pet/:petId/portrait/status', () => {
    return HttpResponse.json({
      success: true,
      data: {
        status: 'completed',
        portraitUrl: 'https://placedog.net/800/800?id=71',
      },
    })
  }),

  // 반려동물 상세 - 어떤 petId가 오더라도 동일한 mock 상세를 반환
  http.get('/api/pet/:petId', ({ params }) => {
    return HttpResponse.json({ success: true, data: buildPetDetail(params.petId) })
  }),

  // 구독 플랜 목록 (비인증)
  http.get('/api/subscriptions/plans', () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          plan: 'pet_archive',
          name: '반려동물 아카이브',
          price_krw: 4900,
          description: '반려동물 추억 보관 + AI 초상화 월 3장',
        },
      ],
    })
  }),

  // 결제 내역 조회
  http.get('/api/subscriptions/:subscriptionId/payment-logs', () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          payment_log_id: 'paylog-mock-1',
          subscription_id: 'sub-mock-1',
          amount_krw: 4900,
          status: 'success',
          paid_at: new Date(now - 10 * DAY_MS).toISOString(),
        },
        {
          payment_log_id: 'paylog-mock-2',
          subscription_id: 'sub-mock-1',
          amount_krw: 4900,
          status: 'success',
          paid_at: new Date(now - 40 * DAY_MS).toISOString(),
        },
      ],
      meta: { total: 2, page: 1, limit: 20 },
    })
  }),

  // 내 구독 조회
  http.get('/api/subscriptions', () => {
    return HttpResponse.json({ success: true, data: [MOCK_SUBSCRIPTION] })
  }),
]
