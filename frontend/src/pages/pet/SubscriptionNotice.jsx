import { ChevronDown } from 'lucide-react'
import { SUBSCRIPTION_NOTICES, FIRST_CHARGE_NOTICE } from './subscriptionLabels.js'
import './PetNotice.css'

function NoticeList({ showFirstCharge }) {
  return (
    <ul className="pet-notice__list">
      {SUBSCRIPTION_NOTICES.map((item) => (
        <li key={item.id}>{item.text}</li>
      ))}
      {showFirstCharge && <li>{FIRST_CHARGE_NOTICE}</li>}
    </ul>
  )
}

// variant: 'inline' (항상 펼침) | 'details' (접힌 기본 상태)
export default function SubscriptionNotice({ variant, showFirstCharge = false }) {
  if (variant === 'details') {
    return (
      <details className="pet-notice">
        <summary className="pet-notice__summary">
          <span>유의사항 보기</span>
          <ChevronDown className="pet-notice__chevron" size={20} aria-hidden="true" />
        </summary>
        <NoticeList showFirstCharge={showFirstCharge} />
      </details>
    )
  }
  return <NoticeList showFirstCharge={showFirstCharge} />
}
