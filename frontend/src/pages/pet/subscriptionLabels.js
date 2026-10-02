// 반려동물 구독 라벨·요약 모델.
// - '청구(billing) 상태'(kind)는 plan 과 무관하게 canceled 가 아닌 구독이 있으면 표시·해지·재결제 대상이다.
// - '혜택 안내'(hasArchiveBenefits)는 서버 getPortraitQuota 판정과 같은 규칙일 때만 말한다.
//
// [2026-08-23 수정] will_premium(월 1,900원)·all(9,900원) 플랜은 DEV-17/DEV-32로
// 폐지되어 pet_archive 4,900원 단일가만 신규 가입 가능하다(백엔드
// subscriptionService.js PLANS 참조, docs/strategy/03-product-pricing.md와도 일치).
// 다만 이미 will_premium/all로 구독 중이던 기존 행은 강제취소하지 않았으므로
// (subscriptionService.js 주석) 화면에 여전히 나타날 수 있다 - PLAN_NAMES에는
// 표시용으로 남겨두되, 가격은 하드코딩하지 않는다(가격 정본은 항상 서버가 응답에
// 실어 보내는 subscription.price_krw다 - 폐지된 플랜은 원가가 이미 바뀌어
// 하드코딩 표를 유지관리할 수 없다. 결제 화면 금액이 서버 금액과 어긋나면 결제가
// 100% 실패하므로 프론트에 별도 가격표를 두지 않는 것이 원칙).
export const PLAN_NAMES = {
  pet_archive: '반려동물 아카이브',
  will_premium: 'AI 영상 편지 프리미엄',
  all: '전체 이용권',
}

export const STATUS_CONFIG = {
  active: {
    label: '이용 중',
    badgeStyle: {
      background: 'var(--color-success-light)',
      color: 'var(--color-success)',
    },
  },
  past_due: {
    label: '결제 실패',
    badgeStyle: {
      background: '#fff7ed',
      color: '#c2410c',
    },
  },
  suspended: {
    label: '구독 정지',
    badgeStyle: {
      background: 'var(--color-error-light)',
      color: 'var(--color-error)',
    },
  },
  canceled: {
    label: '해지됨',
    badgeStyle: {
      background: 'var(--color-surface-warm)',
      color: 'var(--color-text-muted)',
    },
  },
}

// 백엔드 backend/src/domains/pet/petService.js getPortraitQuota 의 구독 판정과 같아야 한다.
// 서버는 plan==='pet_archive' 이고 sub_status 가 active/past_due 일 때만 '혜택 구독'으로 본다
// (suspended 는 서버가 무료 취급). 이 규칙을 바꾸려면 서버와 함께 바꾼다.
export const ARCHIVE_PLAN = 'pet_archive'
const BENEFIT_STATUSES = ['active', 'past_due']

// 아카이브 요금제 혜택 문구(정본). PetPlanGrid(랜딩 플랜 카드)와 같은 문구를 공유한다.
export const PET_ARCHIVE_BENEFITS = [
  { id: 'photos', text: '반려동물 사진 무제한 보관' },
  { id: 'portrait', text: 'AI 초상화 월 3장' },
  { id: 'memorial', text: '추모 페이지 공개' },
]

export function readStatus(sub) {
  return sub?.subStatus ?? sub?.status ?? sub?.sub_status
}

// canceled 가 아니면 "살아있는" 구독으로 본다 (상태 필드가 없어도 live).
export function isSubscriptionLive(sub) {
  return readStatus(sub) !== 'canceled'
}

// '혜택 안내' 판정: 서버 getPortraitQuota 와 같은 규칙(pet_archive + active/past_due).
export function hasArchiveBenefits(sub) {
  return sub?.plan === ARCHIVE_PLAN && BENEFIT_STATUSES.includes(readStatus(sub))
}

// 구독 선택: 살아있는 pet_archive 우선, 없으면 canceled 가 아닌 첫 구독(plan 무관), 없으면 free.
// API 는 created_at DESC 배열을 준다.
function pickBillingSubscription(list) {
  const live = list.filter((item) => item && isSubscriptionLive(item))
  return live.find((item) => item.plan === ARCHIVE_PLAN) ?? live[0] ?? null
}

// 요약 모델 { kind, subscription, planKey, planName, isArchive, hasArchiveBenefits }
// - kind (청구 상태, plan 무관): 'free' | 'active' | 'past_due' | 'suspended' | 'unknown'
//   정확히 'active' 일 때만 active, 상태 없음/알 수 없는 값은 'unknown'(구독은 보존).
//   폐지 플랜(will_premium/all)도 결제 중이면 표시·해지·재결제 대상이다.
// - planName: 모르는 plan 키는 '이전 요금제' (날것으로 노출하지 않음)
// - hasArchiveBenefits: 혜택 안내 가능 여부. 서버 판정과 같은 규칙일 때만 true.
export function getSubscriptionSummary(list) {
  const sub = Array.isArray(list) ? pickBillingSubscription(list) : null
  if (!sub) {
    return {
      kind: 'free',
      subscription: null,
      planKey: null,
      planName: '무료',
      isArchive: false,
      hasArchiveBenefits: false,
    }
  }
  const status = readStatus(sub)
  const kind = status === 'active' || status === 'past_due' || status === 'suspended'
    ? status
    : 'unknown'
  const planKey = sub.plan ?? null
  return {
    kind,
    subscription: sub,
    planKey,
    planName: PLAN_NAMES[planKey] ?? '이전 요금제',
    isArchive: planKey === ARCHIVE_PLAN,
    hasArchiveBenefits: hasArchiveBenefits(sub),
  }
}

// 구독 유의사항 문구(정본). 구독 관리 페이지 유의사항과 같은 문구를 쓴다.
// '플랜 변경' 안내는 플랜이 하나뿐이라 뺐다.
export const SUBSCRIPTION_NOTICES = [
  { id: 'auto', text: '구독은 매월 자동 결제됩니다.' },
  { id: 'cancel', text: '해지 시 당월 이용 기간은 유지됩니다.' },
  { id: 'portrait', text: 'AI 초상화는 매달 3장까지 만들 수 있어요. 다음 달 1일에 다시 채워집니다.' },
]

// 가입 직전 안내: 카드 등록 직후 첫 결제가 일어난다.
export const FIRST_CHARGE_NOTICE = '카드 등록이 끝나면 첫 달 요금이 바로 결제돼요.'

// 결제 복귀 페이지가 /pet 로 넘기는 location.state 의 키/값 이름.
// 복귀 페이지와 useBillingReturnNotice 가 같은 상수를 쓴다.
export const BILLING_RESULT = {
  KEY: 'billingResult',
  MESSAGE_KEY: 'billingMessage',
  SUCCESS: 'success',
  FAIL: 'fail',
}
