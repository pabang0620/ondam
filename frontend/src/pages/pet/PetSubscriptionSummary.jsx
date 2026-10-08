import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import { usePetSubscription } from './usePetSubscription.js'
import { readStatus } from './subscriptionLabels.js'
import MembershipCard from './MembershipCard.jsx'
import FreeUpsellCard from './FreeUpsellCard.jsx'
import CancelSubscriptionModal from './CancelSubscriptionModal.jsx'
import './PetMembership.css'

const LIVE_KINDS = ['active', 'past_due', 'suspended']
const SUCCESS_MESSAGE_MS = 4000
const STALE_TEXT = '최신 상태를 불러오지 못했어요. 잠시 후 새로고침해 주세요.'
const UNKNOWN_TEXT = '구독 정보를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.'
const SECTION_TITLE = '내 구독'
const LIVE_TITLE_SUFFIX = '님의 구독 현황'
const LIVE_TITLE_FALLBACK = '내 구독 현황'
const RECHECK_TEXT = '다시 확인'

// 구독 중(active/past_due/suspended): 구독 관리 페이지와 같은 훅·카드·해지 모달을 그대로 인라인으로 쓴다.
// 표시 기준은 부모 요약의 구독(fallbackSubscription)이다. 훅은 조회/재조회를 하지 않고
// (skipInitialFetch, refreshAfterAction=false) 액션만 담당하며, 성공 후 재조회는 부모 refetch 한 번뿐이다.
// 성공 메시지는 부모(PetSubscriptionSummary)로 올려 표시한다. 해지 성공 시 요약이 free 로 바뀌어
// 이 컴포넌트가 사라져도 메시지가 4초간 유지되도록 하기 위함이다.
function LiveSubscription({ summary, fallbackSubscription, isStale, onSuccess }) {
  const {
    currentSubscription,
    isProcessing,
    actionError,
    actionNotice,
    isCancelModalOpen,
    successMessage,
    handleRetryPayment,
    openCancelModal,
    closeCancelModal,
    confirmCancel,
    clearSuccessMessage,
  } = usePetSubscription({
    refreshAfterAction: false,
    skipInitialFetch: true,
    initialSubscription: fallbackSubscription,
  })

  useEffect(() => {
    if (!successMessage) return
    onSuccess(successMessage)
    clearSuccessMessage()
  }, [successMessage, onSuccess, clearSuccessMessage])

  // 부모 구독을 기준으로 하되, 같은 id 의 로컬 해지 표시만 겹쳐 쓴다(해지 직후 재조회 전/실패 시).
  // 화면의 구독 id 는 항상 fallbackSubscription 의 id 이므로 해지/재결제 대상 id 와 일치한다.
  const isLocallyCanceled =
    currentSubscription != null &&
    currentSubscription.subscription_id === fallbackSubscription?.subscription_id &&
    readStatus(currentSubscription) === 'canceled'
  const subscription = isLocallyCanceled ? currentSubscription : fallbackSubscription

  return (
    <div className="pet-sub__live">
      {actionError && (
        <p className="pet-sub-summary__msg pet-sub-summary__msg--error" role="alert">{actionError}</p>
      )}
      {actionNotice && (
        <p className="pet-sub-summary__msg pet-sub-summary__msg--notice" role="status" aria-live="polite">
          {actionNotice}
        </p>
      )}
      {isStale && (
        <p className="pet-sub-summary__msg pet-sub-summary__msg--notice" role="status" aria-live="polite">
          {STALE_TEXT}
        </p>
      )}
      <MembershipCard
        subscription={subscription}
        summary={summary}
        onCancel={openCancelModal}
        onRetry={handleRetryPayment}
        isProcessing={isProcessing}
      />
      <CancelSubscriptionModal
        isOpen={isCancelModalOpen}
        onClose={closeCancelModal}
        onConfirm={confirmCancel}
        subscription={subscription}
        isProcessing={isProcessing}
      />
    </div>
  )
}

function NeutralCard({ onRetry }) {
  return (
    <div className="pet-member">
      <p className="pet-member__text">{UNKNOWN_TEXT}</p>
      <div className="pet-member__links">
        <button type="button" className="pet-member__link pet-member__link--button" onClick={() => onRetry?.()}>
          {RECHECK_TEXT}
        </button>
      </div>
    </div>
  )
}

// 구독 중 제목: 회원명이 비어 있으면 '내 구독 현황'. 이름은 React 텍스트로만 렌더한다.
function buildLiveTitle(memberName) {
  const name = typeof memberName === 'string' ? memberName.trim() : ''
  return name ? `${name}${LIVE_TITLE_SUFFIX}` : LIVE_TITLE_FALLBACK
}

function isLiveSummary({ summary, isLoading, error }) {
  return !isLoading && !error && Boolean(summary) && LIVE_KINDS.includes(summary.kind)
}

function SummaryBody({ summary, isLoading, error, isStale, onSuccess, onRetry, checkout, price, canSubscribe }) {
  if (isLoading) return <div className="pet-sub__skeleton" aria-hidden="true" />
  if (error || !summary || summary.kind === 'unknown') return <NeutralCard onRetry={onRetry} />
  if (summary.kind === 'free') {
    return <FreeUpsellCard checkout={checkout} price={price} canSubscribe={canSubscribe} />
  }
  if (LIVE_KINDS.includes(summary.kind)) {
    return (
      <LiveSubscription
        summary={summary}
        fallbackSubscription={summary.subscription}
        isStale={isStale}
        onSuccess={onSuccess}
      />
    )
  }
  return <NeutralCard onRetry={onRetry} />
}

// onSubscriptionChanged: 해지/재결제 성공 시 대시보드 요약(useMySubscription)을 다시 조회하는 콜백.
// onRetry: 구독 상태를 확인하지 못했을 때 '다시 확인' 콜백(부모의 구독 refetch).
// checkout/price/canSubscribe: 무료 카드의 '구독하기'(토스 카드 등록 시작)용 객체.
export default function PetSubscriptionSummary({
  summary,
  isLoading,
  error,
  isStale = false,
  onSubscriptionChanged,
  onRetry,
  checkout,
  price,
  canSubscribe = false,
}) {
  // 성공 메시지 state 는 최상위에 둔다: 해지 성공으로 요약이 free 로 바뀌어도 4초간 유지된다.
  const [message, setMessage] = useState(null)
  // 회원명: PetPage 가 넘기는 displayName 은 '…님의 반려동물' 로 조합된 문구라 쓸 수 없어 store 의 nickname 을 직접 읽는다.
  const memberName = useAuthStore((s) => s.user?.nickname)
  const title = isLiveSummary({ summary, isLoading, error }) ? buildLiveTitle(memberName) : SECTION_TITLE

  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(() => setMessage(null), SUCCESS_MESSAGE_MS)
    return () => clearTimeout(timer)
  }, [message])

  const handleSuccess = (text) => {
    setMessage(text)
    onSubscriptionChanged?.()
  }

  return (
    <section className="pet-dash__section pet-sub" aria-labelledby="pet-sub-title" aria-busy={isLoading ? 'true' : undefined}>
      <h2 id="pet-sub-title" className="pet-dash__section-title">{title}</h2>
      {message && (
        <p className="pet-sub-summary__msg pet-sub-summary__msg--success" role="status" aria-live="polite">
          {message}
        </p>
      )}
      <SummaryBody
        summary={summary}
        isLoading={isLoading}
        error={error}
        isStale={isStale}
        onSuccess={handleSuccess}
        onRetry={onRetry}
        checkout={checkout}
        price={price}
        canSubscribe={canSubscribe}
      />
    </section>
  )
}
