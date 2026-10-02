// [DESIGN-PREVIEW] MSW mock handler - pet 도메인, 실제 백엔드 없이 로컬 디자인 검토용
import { http, HttpResponse, delay } from 'msw'

// [개발용 시나리오 전환] 브라우저 콘솔에서 값을 넣고 새로고침한다 (개발 모드에서만 MSW 가 켜짐 - main.jsx).
//   localStorage.setItem('msw:pets', 'empty'); location.reload()
//   msw:pets : empty(0마리) | alive(생존 2) | deceased(무지개다리 1) | error(500) | slow(2초 지연) | 그 외/없음(기본 3마리)
//   msw:sub  : free([]) | past_due | suspended | canceled | error(500) | unknown(상태값 없음) | 그 외/없음(active)
//              폐지 플랜: legacy(will_premium 1,900 active) | legacy_past_due | legacy_suspended(will_premium)
//                        | legacy_all(all 9,900 active) | mixed([canceled pet_archive, active will_premium])
//   msw:sub-action : 해지/재결제 응답 제어. fail(500) | pending(재결제만 202 결과 불확실) | 그 외/없음(성공 200)
//                    (해지 성공 시 msw:sub 가 'canceled', 재결제 성공(200) 시 past_due/suspended 가 active 로 바뀐다)
//                    billing-auth(카드 등록 복귀)에도 적용: fail(500) | pending(202 + data.indeterminate) | 그 외/없음(201 성공, msw:sub 가 'active')
//   [결제 복귀 모의] 토스 결제창 없이 복귀 화면만 확인한다 (로그인 상태에서 개발 서버 콘솔/주소창 사용).
//     성공: sessionStorage.setItem('pendingSubscriptionPlan', 'pet_archive')
//           이어서 /pet/billing/success?authKey=x&customerKey=<uuid>&plan=pet_archive 로 이동
//           (BillingAuthSuccessPage 가 읽는 값: 쿼리 authKey, customerKey / sessionStorage pendingSubscriptionPlan.
//            쿼리 plan 은 읽지 않는다. 셋 중 하나라도 없으면 /pet 으로 바로 이동)
//           -> 201 이면 /pet 으로 이동해 '구독이 등록되었어요.' 알림, pending 이면 이 화면에 머무름
//     실패: /pet/billing/fail?code=PAY_PROCESS_CANCELED  (-> /pet 에서 실패 알림)
//   되돌리기: localStorage.removeItem('msw:pets'); localStorage.removeItem('msw:sub'); localStorage.removeItem('msw:sub-action')

// petApi.js가 호출하는 모든 경로는 apiClient의 baseURL('/api')을 통해 나가므로
// 여기서도 반드시 '/api'로 시작하는 절대 경로를 사용한다.

const now = Date.now()
const DAY_MS = 24 * 60 * 60 * 1000

// 재결제 성공(200) 시 msw:sub 복구 매핑: 재조회가 '결제 실패'를 다시 보여주지 않게 한다.
const RESTORED_SCENARIO = {
  past_due: 'active',
  suspended: 'active',
  legacy_past_due: 'legacy',
  legacy_suspended: 'legacy',
}

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

function readScenario(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// 응답마다 새 객체/배열을 만들어 돌려준다(원본 MOCK_PETS 변경 방지).
function buildPets(scenario) {
  const copy = (list) => list.map((pet) => ({ ...pet }))
  if (scenario === 'empty') return []
  if (scenario === 'alive') return copy(MOCK_PETS.filter((pet) => pet.pet_status === 'alive'))
  if (scenario === 'deceased') return copy(MOCK_PETS.filter((pet) => pet.pet_status === 'deceased'))
  return copy(MOCK_PETS)
}

// 폐지 플랜(will_premium/all) 구독 mock. 새 객체를 만들어 돌려준다.
function buildLegacy(plan, priceKrw, subStatus) {
  return {
    ...MOCK_SUBSCRIPTION,
    subscription_id: `sub-mock-${plan}`,
    plan,
    price_krw: priceKrw,
    subStatus,
    sub_status: subStatus,
  }
}

function buildSubscriptions(scenario) {
  const base = { ...MOCK_SUBSCRIPTION }
  switch (scenario) {
    case 'free':
      return []
    case 'past_due':
    case 'suspended':
    case 'canceled':
      return [{ ...base, subStatus: scenario }]
    case 'unknown': {
      const { subStatus: _omit, ...rest } = base
      return [rest]
    }
    case 'legacy':
      return [buildLegacy('will_premium', 1900, 'active')]
    case 'legacy_past_due':
      return [buildLegacy('will_premium', 1900, 'past_due')]
    case 'legacy_suspended':
      return [buildLegacy('will_premium', 1900, 'suspended')]
    case 'legacy_all':
      return [buildLegacy('all', 9900, 'active')]
    case 'mixed':
      // created_at DESC: 최근에 해지한 pet_archive 가 앞, 아직 결제 중인 레거시가 뒤
      return [{ ...base, subStatus: 'canceled' }, buildLegacy('will_premium', 1900, 'active')]
    default:
      return [base]
  }
}

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
  http.get('/api/pet', async () => {
    const scenario = readScenario('msw:pets')
    if (scenario === 'error') {
      return HttpResponse.json(
        { success: false, message: '반려동물 목록을 불러오지 못했습니다.' },
        { status: 500 },
      )
    }
    if (scenario === 'slow') await delay(2000)
    return HttpResponse.json({ success: true, data: buildPets(scenario) })
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
          priceKrw: 4900,
          description: '반려동물 추억 보관 + AI 초상화 월 3장',
        },
      ],
    })
  }),

  // 카드 등록 복귀 (petApi.registerBillingKey: POST /subscriptions/billing-auth)
  // 백엔드: 성공 201 {success, message, data:{subscriptionId, plan, subStatus, priceKrw, nextBillingAt, lastBilledAt}},
  //         불확정 202 {success:true, message, data:{subscriptionId, plan, indeterminate:true, message}}
  http.post('/api/subscriptions/billing-auth', async ({ request }) => {
    const action = readScenario('msw:sub-action')
    if (action === 'fail') {
      return HttpResponse.json(
        { success: false, message: '구독 등록에 실패했습니다.' },
        { status: 500 },
      )
    }
    let body = null
    try {
      body = await request.json()
    } catch {
      body = null
    }
    const plan = typeof body?.plan === 'string' ? body.plan : 'pet_archive'
    if (action === 'pending') {
      const message = '결제 결과를 확인하는 중입니다. 잠시 후 다시 확인해 주세요'
      return HttpResponse.json(
        {
          success: true,
          message,
          data: { subscriptionId: 'sub-mock-1', plan, indeterminate: true, message },
        },
        { status: 202 },
      )
    }
    try {
      localStorage.setItem('msw:sub', 'active')
    } catch {
      // localStorage 를 쓸 수 없으면 목록은 그대로다(개발용 mock)
    }
    return HttpResponse.json(
      {
        success: true,
        message: '구독이 시작되었습니다',
        data: {
          subscriptionId: 'sub-mock-1',
          plan,
          subStatus: 'active',
          priceKrw: 4900,
          nextBillingAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
          lastBilledAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    )
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

  // 구독 해지 (petApi.cancelSubscription: DELETE /subscriptions/:id)
  // 성공하면 이후 목록 조회가 해지 상태를 돌려주도록 msw:sub 를 'canceled' 로 바꾼다.
  http.delete('/api/subscriptions/:subscriptionId', ({ params }) => {
    if (readScenario('msw:sub-action') === 'fail') {
      return HttpResponse.json(
        { success: false, message: '구독 해지에 실패했습니다.' },
        { status: 500 },
      )
    }
    try {
      localStorage.setItem('msw:sub', 'canceled')
    } catch {
      // localStorage 를 쓸 수 없으면 목록은 그대로다(개발용 mock)
    }
    return HttpResponse.json({
      success: true,
      message: '구독이 취소되었습니다',
      data: { subscription_id: params.subscriptionId, sub_status: 'canceled', subStatus: 'canceled' },
    })
  }),

  // 결제 재시도 (petApi.retryPayment: POST /subscriptions/:id/retry-payment)
  // pending: 202 + data.indeterminate (usePetSubscription 의 불확정 분기), fail: 500, 그 외: 200
  http.post('/api/subscriptions/:subscriptionId/retry-payment', ({ params }) => {
    const action = readScenario('msw:sub-action')
    if (action === 'fail') {
      return HttpResponse.json(
        { success: false, message: '결제 재시도에 실패했습니다.' },
        { status: 500 },
      )
    }
    if (action === 'pending') {
      return HttpResponse.json(
        {
          success: true,
          message: '결제 결과를 확인하는 중입니다. 잠시 후 다시 확인해 주세요',
          data: {
            subscriptionId: params.subscriptionId,
            subStatus: 'past_due',
            indeterminate: true,
            message: '결제 결과를 확인하는 중입니다. 잠시 후 다시 확인해 주세요',
          },
        },
        { status: 202 },
      )
    }
    const restored = RESTORED_SCENARIO[readScenario('msw:sub')]
    if (restored) {
      try {
        localStorage.setItem('msw:sub', restored)
      } catch {
        // localStorage 를 쓸 수 없으면 목록은 그대로다(개발용 mock)
      }
    }
    return HttpResponse.json({
      success: true,
      message: '결제가 완료되었습니다',
      data: {
        subscriptionId: params.subscriptionId,
        subStatus: 'active',
        nextBillingAt: new Date(now + 30 * DAY_MS).toISOString(),
      },
    })
  }),

  // 내 구독 조회
  http.get('/api/subscriptions', () => {
    const scenario = readScenario('msw:sub')
    if (scenario === 'error') {
      return HttpResponse.json(
        { success: false, message: '구독 정보를 불러오지 못했습니다.' },
        { status: 500 },
      )
    }
    return HttpResponse.json({ success: true, data: buildSubscriptions(scenario) })
  }),
]
