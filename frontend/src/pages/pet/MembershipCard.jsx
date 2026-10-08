import { useId, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { formatKstDot } from '../../utils/dateKst.js'
import {
  ARCHIVE_PLAN,
  PET_ARCHIVE_BENEFITS,
  STATUS_CONFIG,
  hasArchiveBenefits,
  readStatus,
} from './subscriptionLabels.js'
import SubscriptionNotice from './SubscriptionNotice.jsx'
import './PetMembership.css'

const PLAN_LABEL = '구독 상품'
const PRICE_LABEL = '월 요금'
const NEXT_BILLING_LABEL = '다음 결제일'
const BENEFITS_TITLE = '이용 중인 혜택'
const PAST_DUE_ALERT = '최근 결제가 실패했어요. 결제 수단을 확인하고 재결제해 주세요.'
const SUSPENDED_ALERT = '결제가 이루어지지 않아 구독이 정지됐어요. 결제 수단을 확인한 뒤 재결제해 주세요.'
const SUSPENDED_ARCHIVE_SUB = '재결제가 완료되면 혜택을 다시 이용할 수 있어요.'
const LEGACY_NOTE = '반려동물 혜택(AI 초상화 월 3장 등)은 반려동물 아카이브 구독에서 제공돼요.'
const RETRY_TEXT = '재결제하기'
const PROCESSING_TEXT = '처리 중...'
const CANCEL_TEXT = '구독 해지'
const FOLD_OPEN_TEXT = '유의사항 및 구독해지 보기'
const FOLD_CLOSE_TEXT = '유의사항 및 구독해지 접기'
const CHECK_ICON_SIZE = 20
const CHEVRON_ICON_SIZE = 20

const PILL_CLASS = {
  active: 'pet-member__pill--active',
  past_due: 'pet-member__pill--warn',
  suspended: 'pet-member__pill--warn',
  canceled: 'pet-member__pill--canceled',
}

// 브랜드 머리띠: 구독명(왼쪽) + 상태 알약(오른쪽 끝). '구독 상품' 라벨은 스크린리더 전용
function MembershipHeader({ planName, status }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.canceled
  const pillClass = PILL_CLASS[status] ?? PILL_CLASS.canceled
  return (
    <div className="pet-member__header">
      <dl className="pet-member__plan">
        <dt className="pet-member__sr-only">{PLAN_LABEL}</dt>
        <dd>{planName}</dd>
      </dl>
      <span className={`pet-member__pill ${pillClass}`}>{config.label}</span>
    </div>
  )
}

// 가격은 서버가 내려주는 실제 청구액만 쓴다(없으면 칸을 숨김). 다음 결제일은 active 일 때만:
// past_due 의 next_billing_at 은 서버가 재시도 일정으로 바꿔 쓰는 값이라 오해 소지가 있다.
function buildStats(subscription, status) {
  const price = subscription.price_krw ?? subscription.priceKrw
  const nextDate = status === 'active' ? formatKstDot(subscription.next_billing_at) : null
  const stats = []
  if (typeof price === 'number' && Number.isFinite(price)) {
    stats.push({ id: 'price', label: PRICE_LABEL, value: `월 ${price.toLocaleString()}원` })
  }
  if (nextDate) {
    stats.push({ id: 'next', label: NEXT_BILLING_LABEL, value: nextDate })
  }
  return stats
}

function MembershipRows({ stats }) {
  if (stats.length === 0) return null
  return (
    <dl className="pet-member__rows">
      {stats.map((stat) => (
        <div key={stat.id} className="pet-member__row">
          <dt>{stat.label}</dt>
          <dd>{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function PaymentAlert({ status, isArchive }) {
  if (status === 'past_due') {
    return <p role="alert" className="pet-member__alert">{PAST_DUE_ALERT}</p>
  }
  if (status === 'suspended') {
    return (
      <p role="alert" className="pet-member__alert">
        {SUSPENDED_ALERT}
        {isArchive && <span className="pet-member__alert-sub">{SUSPENDED_ARCHIVE_SUB}</span>}
      </p>
    )
  }
  return null
}

function ArchiveBenefits() {
  return (
    <div className="pet-member__section">
      <h4 className="pet-member__benefits-title">{BENEFITS_TITLE}</h4>
      <ul className="pet-member__benefit-list" role="list">
        {PET_ARCHIVE_BENEFITS.map((benefit) => (
          <li key={benefit.id}>
            <Check size={CHECK_ICON_SIZE} aria-hidden="true" />
            <span>{benefit.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LegacyNote() {
  return (
    <div className="pet-member__section">
      <p className="pet-member__text">{LEGACY_NOTE}</p>
    </div>
  )
}

// 재결제 버튼. 호출 방식은 SubscriptionStatusCard 와 동일(onRetry(subscription.subscription_id)).
function MembershipActions({ status, subscription, onRetry, isProcessing }) {
  if (status !== 'past_due' && status !== 'suspended') return null
  return (
    <button
      type="button"
      className="pet-member__retry"
      onClick={() => onRetry(subscription.subscription_id)}
      disabled={isProcessing}
    >
      {isProcessing ? PROCESSING_TEXT : RETRY_TEXT}
    </button>
  )
}

// 해지할 수 있는 상태(active/past_due)에서만 줄을 그린다. 보여줄 것이 없으면 빈 줄·구분선도 없다.
function MembershipLinks({ canCancel, onCancel, isProcessing }) {
  if (!canCancel) return null
  return (
    <div className="pet-member__links">
      <button
        type="button"
        className="pet-member__link pet-member__link--button"
        onClick={onCancel}
        disabled={isProcessing}
      >
        {CANCEL_TEXT}
      </button>
    </div>
  )
}

// 유의사항 + 구독 해지를 한 접이식 영역으로 묶는다. 접힌 동안은 마운트하지 않아
// 해지 버튼이 탭 순서·스크린리더에 노출되지 않는다.
function MembershipFold({ canCancel, onCancel, isProcessing }) {
  const [isOpen, setIsOpen] = useState(false)
  const bodyId = useId()
  return (
    <div className="pet-member__fold">
      <button
        type="button"
        className="pet-member__fold-toggle"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>{isOpen ? FOLD_CLOSE_TEXT : FOLD_OPEN_TEXT}</span>
        <ChevronDown
          size={CHEVRON_ICON_SIZE}
          className="pet-member__fold-chevron"
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div id={bodyId}>
          <div className="pet-member__notice">
            <SubscriptionNotice variant="inline" />
          </div>
          <MembershipLinks canCancel={canCancel} onCancel={onCancel} isProcessing={isProcessing} />
        </div>
      )}
    </div>
  )
}

export default function MembershipCard({ subscription, summary, onCancel, onRetry, isProcessing }) {
  if (!subscription) return null

  const status = readStatus(subscription) ?? 'canceled'
  const isCanceled = status === 'canceled'
  const isArchive = subscription.plan === ARCHIVE_PLAN
  // 혜택은 summary 가 아니라 이 카드가 받은 구독 객체로 다시 계산한다(해지 직후 로컬 canceled 에 즉시 반응).
  const showBenefits = hasArchiveBenefits(subscription)
  const showLegacy = !isArchive && !isCanceled

  return (
    <article className="pet-member pet-member--sub" aria-labelledby="pet-sub-title">
      <MembershipHeader planName={summary?.planName ?? '이전 요금제'} status={status} />
      {!isCanceled && <MembershipRows stats={buildStats(subscription, status)} />}
      {!isCanceled && (
        <div className="pet-member__main">
          <PaymentAlert status={status} isArchive={isArchive} />
          <MembershipActions
            status={status}
            subscription={subscription}
            onRetry={onRetry}
            isProcessing={isProcessing}
          />
        </div>
      )}
      {showBenefits && <ArchiveBenefits />}
      {showLegacy && <LegacyNote />}
      {!isCanceled && (
        <MembershipFold
          canCancel={status === 'active' || status === 'past_due'}
          onCancel={onCancel}
          isProcessing={isProcessing}
        />
      )}
    </article>
  )
}
