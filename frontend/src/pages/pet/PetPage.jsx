import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import { usePet } from './usePet.js'
import { useMySubscription } from './useMySubscription.js'
import { usePetCheckout } from './usePetCheckout.js'
import { useArchivePlanPrice } from './useArchivePlanPrice.js'
import { useBillingReturnNotice } from './useBillingReturnNotice.js'
import { ROUTES } from '../../constants/routes.js'
import PetLanding from './PetLanding.jsx'
import PetDashboard from './PetDashboard.jsx'
import PetDashboardSkeleton from './PetDashboardSkeleton.jsx'
import PetBillingNotice from './PetBillingNotice.jsx'
import PetSubscriptionSummary from './PetSubscriptionSummary.jsx'
import './PetPage.css'

const DEFAULT_TITLE = '내 반려동물'

// 구독 조회 결과 → 랜딩 플랜 카드용 상태. null 이면 구독하기 가능(또는 비로그인).
const SUB_STATUS = { CHECKING: 'checking', SUBSCRIBED: 'subscribed', UNAVAILABLE: 'unavailable' }

// 구독하기 가능 여부는 "무료 확정" 일 때만 true(로딩/오류/unknown/구독 중은 모두 false).
function resolveSubscribeGate({ isAuthenticated, enabled, subscription }) {
  if (!isAuthenticated) return { isFree: false, canSubscribe: true, status: null }
  if (!enabled || subscription.isLoading) {
    return { isFree: false, canSubscribe: false, status: SUB_STATUS.CHECKING }
  }
  const kind = subscription.summary?.kind
  if (!subscription.error && kind === 'free') return { isFree: true, canSubscribe: true, status: null }
  const isLive = !subscription.error && kind != null && kind !== 'unknown'
  return {
    isFree: false,
    canSubscribe: false,
    status: isLive ? SUB_STATUS.SUBSCRIBED : SUB_STATUS.UNAVAILABLE,
  }
}

export default function PetPage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const nickname = useAuthStore((s) => s.user?.nickname)
  const { pets, isLoading, error, refetch } = usePet({ enabled: isAuthenticated })
  // 0마리 구독자도 상태를 알아야 해지/이중 가입 차단이 가능하다. 목록 로딩 완료 + 목록 오류 아님이면 조회.
  const subscriptionEnabled = isAuthenticated && !isLoading && !error
  const subscription = useMySubscription({ enabled: subscriptionEnabled })
  const gate = resolveSubscribeGate({ isAuthenticated, enabled: subscriptionEnabled, subscription })
  const { canSubscribe } = gate
  const checkout = usePetCheckout({ canSubscribe })
  const price = useArchivePlanPrice({ enabled: gate.isFree })
  const { notice, dismiss } = useBillingReturnNotice()

  const handleRegister = () => {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN)
      return
    }
    navigate(ROUTES.PET_NEW)
  }

  const trimmed = nickname?.trim()
  const displayName = trimmed ? `${trimmed}님의 반려동물` : DEFAULT_TITLE
  const deceasedPets = pets.filter((pet) => pet.pet_status === 'deceased')
  const alivePets = pets.filter((pet) => pet.pet_status !== 'deceased')

  // 무료가 아닌 확정 상태(구독 중/unknown/오류)일 때만 랜딩 위에 '내 구독' 영역을 둔다.
  const showLandingSummary =
    gate.status === SUB_STATUS.SUBSCRIBED || gate.status === SUB_STATUS.UNAVAILABLE
  const subscriptionSlot = showLandingSummary ? (
    <PetSubscriptionSummary
      summary={subscription.summary}
      isLoading={false}
      error={subscription.error}
      isStale={subscription.isStale}
      onSubscriptionChanged={subscription.refetch}
      onRetry={subscription.refetch}
    />
  ) : null

  const renderBody = () => {
    if (isLoading && isAuthenticated) return <PetDashboardSkeleton />
    if (!isAuthenticated || (!error && pets.length === 0)) {
      return (
        <PetLanding
          onRegister={handleRegister}
          checkout={checkout}
          canSubscribe={canSubscribe}
          subscriptionStatus={gate.status}
          subscriptionSlot={subscriptionSlot}
        />
      )
    }
    return (
      <PetDashboard
        displayName={error ? DEFAULT_TITLE : displayName}
        alivePets={alivePets}
        deceasedPets={deceasedPets}
        error={error}
        onRetry={() => refetch()}
        onRegister={handleRegister}
        subscription={subscription}
        checkout={checkout}
        price={price}
        canSubscribe={canSubscribe}
      />
    )
  }

  return (
    <main className="pet-page">
      <PetBillingNotice notice={notice} onDismiss={dismiss} />
      {renderBody()}
    </main>
  )
}
