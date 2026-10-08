import { useId } from 'react'
import { Image, Sparkles, UserRound, Flower2 } from 'lucide-react'
import { PET_ARCHIVE_BENEFITS } from './subscriptionLabels.js'
import SubscriptionNotice from './SubscriptionNotice.jsx'

// 아카이브 혜택 문구는 subscriptionLabels.js 가 정본이고, 아이콘만 id 별로 여기서 붙인다.
const BENEFIT_ICONS = { photos: Image, portrait: Sparkles, memorial: Flower2 }

const STATUS_NOTES = {
  checking: '구독 정보를 확인하는 중...',
  subscribed: '이미 구독 중이에요',
  unavailable: '구독 상태를 확인한 뒤 구독할 수 있어요.',
}
const REDIRECT_TEXT = '토스페이먼츠로 이동 중...'
const REDIRECT_STATUS_TEXT = '토스페이먼츠로 이동 중입니다...'

// [정합성 수정, 2026-08-22] 펫 구독은 pet_archive 단일 플랜(4,900원)으로 확정됐다.
// 정본: PetSubscriptionPage.jsx + backend subscriptionService.js의 PLANS.
// 이전 3티어(무료/스탠다드 4,900/프리미엄 9,900) 표기는 백엔드 zod enum(['pet_archive'])이
// 이미 거부하는 죽은 동선이었다.
const PLANS = [
  {
    key: 'free',
    label: '무료',
    price: '0원',
    unit: '',
    features: [
      { icon: Image, text: '반려동물 사진 보관' },
      { icon: Sparkles, text: 'AI 초상화 평생 1회 체험' },
      { icon: UserRound, text: '기본 프로필 페이지' },
    ],
    highlight: false,
    selectable: false,
  },
  {
    key: 'pet_archive',
    label: '반려동물 아카이브',
    price: '4,900원',
    unit: '/월',
    features: PET_ARCHIVE_BENEFITS.map(({ id, text }) => ({ icon: BENEFIT_ICONS[id], text })),
    highlight: true,
    selectable: true,
  },
]

// 구독 버튼 영역: (상태/오류 안내) → 구독 버튼 → 자동결제·해지 유의사항.
// 유의사항이 버튼 아래에 오므로 aria-describedby 로 버튼에 연결해 스크린리더가 결제 전에 읽게 한다.
function SubscribeAction({ plan, checkout, canSubscribe, status }) {
  const noticeId = useId()
  const isRedirecting = Boolean(checkout?.isRedirecting)
  if (!canSubscribe && status && STATUS_NOTES[status]) {
    return <p className="pet-plan-card__note" role="status">{STATUS_NOTES[status]}</p>
  }
  return (
    <>
      {checkout?.error && (
        <p className="pet-sub-summary__msg pet-sub-summary__msg--error pet-plan-card__status" role="alert">
          {checkout.error}
        </p>
      )}
      {isRedirecting && (
        <p className="pet-plan-card__note" role="status">{REDIRECT_STATUS_TEXT}</p>
      )}
      <button
        type="button"
        className={`pet-plan-card__btn${plan.highlight ? ' pet-plan-card__btn--primary' : ''}`}
        onClick={() => checkout?.start(plan.key)}
        disabled={!canSubscribe || isRedirecting}
        aria-label={`${plan.label} 플랜 선택`}
        aria-describedby={noticeId}
      >
        {isRedirecting ? REDIRECT_TEXT : '구독하기'}
      </button>
      <div id={noticeId} className="pet-plan-card__notice">
        <SubscriptionNotice variant="inline" showFirstCharge />
      </div>
    </>
  )
}

function PlanCard({ plan, checkout, canSubscribe, status }) {
  return (
    <div className={`pet-plan-card${plan.highlight ? ' pet-plan-card--highlight' : ''}`}>
      {plan.highlight && <span className="pet-plan-card__badge">인기</span>}
      <h3 className="pet-plan-card__label">{plan.label}</h3>
      <p className="pet-plan-card__main">
        <span className="pet-plan-card__price">{plan.price}</span>
        {plan.unit && <span className="pet-plan-card__unit">{plan.unit}</span>}
      </p>
      {!plan.selectable && (
        <p className="pet-plan-card__free-note">가입 시 자동으로 적용돼요</p>
      )}
      <ul className="pet-plan-card__features">
        {plan.features.map(({ icon: Icon, text }) => (
          <li key={text} className="pet-plan-card__feature">
            {Icon && (
              <Icon className="pet-plan-card__check" size={20} aria-hidden="true" />
            )}
            <span>{text}</span>
          </li>
        ))}
      </ul>
      {plan.selectable && (
        <SubscribeAction plan={plan} checkout={checkout} canSubscribe={canSubscribe} status={status} />
      )}
    </div>
  )
}

// status: null(구독 가능/비로그인) | 'checking' | 'subscribed' | 'unavailable'
export default function PetPlanGrid({ checkout, canSubscribe = false, status = null }) {
  return (
    <div className="pet-plans-grid">
      {PLANS.map((plan) => (
        <PlanCard key={plan.key} plan={plan} checkout={checkout} canSubscribe={canSubscribe} status={status} />
      ))}
    </div>
  )
}
