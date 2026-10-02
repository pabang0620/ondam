import { useId } from 'react'
import { ARCHIVE_PLAN, PET_ARCHIVE_BENEFITS } from './subscriptionLabels.js'
import SubscriptionNotice from './SubscriptionNotice.jsx'
import './PetMembership.css'

const FREE_TITLE = '무료로 이용 중이에요'
const SUBSCRIBE_TEXT = '구독하기'
const REDIRECT_TEXT = '토스페이먼츠로 이동 중...'
const REDIRECT_STATUS_TEXT = '토스페이먼츠로 이동 중입니다...'
const PRICE_LOADING_TEXT = '요금 정보를 불러오는 중...'
const PRICE_ERROR_TEXT = '요금 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'

function PriceLine({ price }) {
  if (price?.isLoading) {
    return <p className="pet-member__text pet-free__price" role="status">{PRICE_LOADING_TEXT}</p>
  }
  if (price?.error || !price?.priceKrw) {
    return <p className="pet-member__text pet-free__price" role="status">{PRICE_ERROR_TEXT}</p>
  }
  return (
    <p className="pet-member__text pet-free__price">
      반려동물 아카이브 월 {price.priceKrw.toLocaleString()}원
    </p>
  )
}

// 무료 사용자용 업셀 카드. 가격은 서버 값만 표시하고, 자동 결제 고지를 구독하기 버튼 위에 둔다.
export default function FreeUpsellCard({ checkout, price, canSubscribe = false }) {
  const titleId = useId()
  const valueText = `아카이브: ${PET_ARCHIVE_BENEFITS.map((benefit) => benefit.text).join(' · ')}`
  const hasPrice = Boolean(price?.priceKrw) && !price?.error && !price?.isLoading
  const isRedirecting = Boolean(checkout?.isRedirecting)
  const isDisabled = !canSubscribe || isRedirecting || !hasPrice
  const label = hasPrice
    ? `반려동물 아카이브 월 ${price.priceKrw.toLocaleString()}원 ${SUBSCRIBE_TEXT}`
    : undefined

  return (
    <article className="pet-member pet-member--free" aria-labelledby={titleId}>
      <h3 id={titleId} className="pet-member__title">{FREE_TITLE}</h3>
      <p className="pet-member__text">{valueText}</p>
      <PriceLine price={price} />
      <SubscriptionNotice variant="inline" showFirstCharge />
      {checkout?.error && <p className="pet-sub-summary__msg pet-sub-summary__msg--error" role="alert">{checkout.error}</p>}
      {isRedirecting && <p className="pet-member__text" role="status">{REDIRECT_STATUS_TEXT}</p>}
      <button
        type="button"
        className="pet-member__retry"
        aria-label={label}
        disabled={isDisabled}
        onClick={() => checkout?.start(ARCHIVE_PLAN)}
      >
        {isRedirecting ? REDIRECT_TEXT : SUBSCRIBE_TEXT}
      </button>
    </article>
  )
}
