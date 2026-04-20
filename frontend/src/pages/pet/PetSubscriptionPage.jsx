import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, CheckCircle, Crown } from 'lucide-react'
import { usePetSubscription } from './usePetSubscription.js'
import SubscriptionStatusCard from './SubscriptionStatusCard.jsx'
import CancelSubscriptionModal from './CancelSubscriptionModal.jsx'
import { ROUTES } from '../../constants/routes.js'

const PLANS = [
  {
    key: 'pet_archive',
    name: '반려동물 아카이브',
    price: 9900,
    desc: '반려동물 추억 무제한 보관 + AI 초상화',
    highlight: true,
  },
  {
    key: 'will_premium',
    name: 'AI 유언장 프리미엄',
    price: 29900,
    desc: 'AI 유언 영상 생성 + 추모관',
    highlight: false,
  },
  {
    key: 'all',
    name: '전체 이용권',
    price: 39900,
    desc: '모든 기능 무제한 이용',
    highlight: false,
  },
]

function PlanCard({ plan, isCurrent, isProcessing, isRedirecting, onSubscribe }) {
  const isDisabled = isProcessing || isRedirecting

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: `2px solid ${isCurrent ? 'var(--color-gold)' : plan.highlight ? 'var(--color-primary)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-xl)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
        position: 'relative',
      }}
    >
      {/* 현재 구독 배지 */}
      {isCurrent && (
        <span
          style={{
            position: 'absolute',
            top: -12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-gold)',
            color: '#fff',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 700,
            padding: '2px 14px',
            borderRadius: 'var(--radius-full)',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Crown size={12} aria-hidden="true" />
          현재 구독 중
        </span>
      )}

      {/* 인기 배지 */}
      {!isCurrent && plan.highlight && (
        <span
          style={{
            position: 'absolute',
            top: -12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-primary)',
            color: '#fff',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 700,
            padding: '2px 14px',
            borderRadius: 'var(--radius-full)',
            whiteSpace: 'nowrap',
          }}
        >
          인기
        </span>
      )}

      <div>
        <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{plan.name}</p>
        <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-primary-dark)', marginTop: 4 }}>
          {plan.price.toLocaleString()}원/월
        </p>
      </div>

      <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
        <CheckCircle size={16} color="var(--color-success)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        {plan.desc}
      </p>

      {!isCurrent && (
        <button
          type="button"
          onClick={() => onSubscribe(plan.key)}
          disabled={isDisabled}
          style={{
            background: plan.highlight ? 'var(--color-primary)' : 'var(--color-surface)',
            color: plan.highlight ? '#fff' : 'var(--color-primary)',
            border: `2px solid var(--color-primary)`,
            borderRadius: 'var(--radius-full)',
            minHeight: 'var(--min-touch-target)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 700,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.7 : 1,
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          {isRedirecting ? '토스페이먼츠로 이동 중...' : '구독하기'}
        </button>
      )}
    </div>
  )
}

export default function PetSubscriptionPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const {
    currentSubscription,
    isLoading,
    error,
    isProcessing,
    isRedirecting,
    actionError,
    isCancelModalOpen,
    successMessage,
    handleSubscribe,
    handleRetryPayment,
    openCancelModal,
    closeCancelModal,
    confirmCancel,
    clearSuccessMessage,
  } = usePetSubscription()

  // 구독 성공 상태 감지 (BillingAuthSuccessPage에서 리디렉트 시)
  useEffect(() => {
    if (location.state?.subscriptionSuccess) {
      // state 소비 후 히스토리에서 제거
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, navigate, location.pathname])

  // 성공 메시지 자동 소멸
  useEffect(() => {
    if (!successMessage && !location.state?.subscriptionSuccess) return
    const timer = setTimeout(() => clearSuccessMessage(), 4000)
    return () => clearTimeout(timer)
  }, [successMessage, location.state, clearSuccessMessage])

  const hasActiveSubscription =
    currentSubscription &&
    (currentSubscription.subStatus ?? currentSubscription.status) !== 'canceled'

  const currentPlanKey = currentSubscription?.plan ?? null

  return (
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: 'var(--spacing-xl) var(--spacing-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xl)',
      }}
    >
      {/* 뒤로가기 */}
      <button
        type="button"
        onClick={() => navigate(ROUTES.PET)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          background: 'none',
          border: 'none',
          color: 'var(--color-primary)',
          fontSize: 'var(--font-size-base)',
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          minHeight: 'var(--min-touch-target)',
          alignSelf: 'flex-start',
        }}
      >
        <ChevronLeft size={20} aria-hidden="true" />
        반려동물 아카이브로
      </button>

      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
          구독 플랜
        </h1>
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-sm)' }}>
          소중한 기억만큼 합리적인 가격으로 이용하세요.
        </p>
      </div>

      {/* 성공 알림 */}
      {(successMessage || location.state?.subscriptionSuccess) && (
        <p
          role="status"
          aria-live="polite"
          style={{
            background: 'var(--color-success-light)',
            color: 'var(--color-success)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-md)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
          }}
        >
          {successMessage || '구독이 성공적으로 등록되었습니다.'}
        </p>
      )}

      {/* 로딩 */}
      {isLoading && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-base)' }}>불러오는 중...</p>
      )}

      {/* 조회 에러 */}
      {error && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-base)' }}>{error}</p>
      )}

      {/* 액션 에러 */}
      {actionError && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-base)' }}>{actionError}</p>
      )}

      {/* 현재 구독 상태 카드 */}
      {!isLoading && hasActiveSubscription && (
        <SubscriptionStatusCard
          subscription={currentSubscription}
          onCancel={openCancelModal}
          onRetry={handleRetryPayment}
          isProcessing={isProcessing}
        />
      )}

      {/* 토스 리디렉트 중 안내 */}
      {isRedirecting && (
        <p
          role="status"
          aria-live="polite"
          style={{
            textAlign: 'center',
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
            padding: 'var(--spacing-md)',
          }}
        >
          토스페이먼츠로 이동 중입니다...
        </p>
      )}

      {/* 플랜 목록 */}
      {!isLoading && (
        <>
          {hasActiveSubscription && (
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              다른 플랜으로 변경
            </h2>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'var(--spacing-xl)',
              paddingTop: hasActiveSubscription ? 0 : 'var(--spacing-md)',
            }}
          >
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                isCurrent={currentPlanKey === plan.key && hasActiveSubscription}
                isProcessing={isProcessing}
                isRedirecting={isRedirecting}
                onSubscribe={handleSubscribe}
              />
            ))}
          </div>
        </>
      )}

      {/* 유의사항 */}
      <section
        style={{
          background: 'var(--color-accent)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-lg)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.7,
        }}
      >
        <p style={{ fontWeight: 700, marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-base)' }}>유의사항</p>
        <ul style={{ listStyle: 'disc', paddingLeft: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>구독은 매월 자동 결제됩니다.</li>
          <li>해지 시 당월 이용 기간은 유지됩니다.</li>
          <li>플랜 변경은 다음 결제일부터 적용됩니다.</li>
        </ul>
      </section>

      {/* 해지 확인 모달 */}
      <CancelSubscriptionModal
        isOpen={isCancelModalOpen}
        onClose={closeCancelModal}
        onConfirm={confirmCancel}
        subscription={currentSubscription}
        isProcessing={isProcessing}
      />
    </main>
  )
}
