import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, CheckCircle, Crown } from 'lucide-react'
import { usePetSubscription } from './usePetSubscription.js'
import SubscriptionStatusCard from './SubscriptionStatusCard.jsx'
import CancelSubscriptionModal from './CancelSubscriptionModal.jsx'
import { ROUTES } from '../../constants/routes.js'
import './PetSubscriptionPage.css'

// FIX: HIGH-2 - will_premium(유언장 보관 구독)은 오너 확정에 따라 폐지되었고,
// 백엔드 subscriptionRoutes.js의 zod enum(['pet_archive'])에서도 이미 제거됐다.
// 이 카드가 남아 있으면 사용자가 토스 빌링 인증까지 마친 뒤 400을 받는다.
//
// [DEV-32, 2026-08-22 오너 확정] `all`(전체 이용권, 9,900원) 플랜도 동일한
// 이유로 제거했다 - 어느 기획 문서에도 없는 유령 플랜이었고, 백엔드
// subscriptionService.js의 PLANS/subscriptionRoutes.js의 zod enum에서도 이미
// 제거됐다. 펫 아카이브는 티어를 나누지 않고 pet_archive 단일가로 확정한다.
const PLANS = [
  { key: 'pet_archive', name: '반려동물 아카이브', price: 4900, desc: '반려동물 추억 보관 + AI 초상화 월 3장', highlight: true },
]

function PlanCard({ plan, isCurrent, isProcessing, isRedirecting, onSubscribe }) {
  const isDisabled = isProcessing || isRedirecting

  return (
    <div
      style={{
        background: isCurrent || plan.highlight ? 'var(--color-pet-soft)' : 'var(--color-surface)',
        border: `${isCurrent ? '2px' : '1px'} solid ${
          isCurrent ? 'var(--color-accent-brand-text)' :
          plan.highlight ? 'var(--color-pet)' :
          'var(--color-border-strong)'
        }`,
        borderRadius: 'var(--radius-card)',
        padding: '24px',
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
            background: 'var(--color-accent-brand-text)',
            color: 'var(--color-surface)',
            fontSize: 'var(--fs-caption)',
            fontWeight: 600,
            padding: '2px 14px',
            borderRadius: 'var(--radius-pill)',
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
            background: 'var(--color-pet)',
            color: 'var(--color-surface)',
            fontSize: 'var(--fs-caption)',
            fontWeight: 600,
            padding: '2px 14px',
            borderRadius: 'var(--radius-pill)',
            whiteSpace: 'nowrap',
          }}
        >
          인기
        </span>
      )}

      <div>
        <p style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600, color: 'var(--color-primary)' }}>{plan.name}</p>
        <p style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, color: 'var(--color-primary)', marginTop: 4 }}>
          {plan.price.toLocaleString()}원/월
        </p>
      </div>

      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
        <CheckCircle size={16} color="var(--color-success)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        {plan.desc}
      </p>

      {!isCurrent && (
        <button
          type="button"
          onClick={() => onSubscribe(plan.key)}
          disabled={isDisabled}
          style={{
            background: plan.highlight ? 'var(--color-pet)' : 'var(--color-surface)',
            color: plan.highlight ? 'var(--color-surface)' : 'var(--color-primary)',
            border: `1.5px solid ${plan.highlight ? 'var(--color-pet)' : 'var(--color-primary)'}`,
            borderRadius: 'var(--radius-pill)',
            minHeight: 'var(--size-button-h)',
            fontSize: 'var(--fs-button)',
            fontWeight: 700,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.7 : 1,
            transition: 'background var(--transition-base), color var(--transition-base)',
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
    actionNotice,
    isCancelModalOpen,
    successMessage,
    handleSubscribe,
    handleRetryPayment,
    openCancelModal,
    closeCancelModal,
    confirmCancel,
    clearSuccessMessage,
  } = usePetSubscription()

  useEffect(() => {
    if (location.state?.subscriptionSuccess) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, navigate, location.pathname])

  useEffect(() => {
    if (!successMessage && !location.state?.subscriptionSuccess) return
    const timer = setTimeout(() => clearSuccessMessage(), 4000)
    return () => clearTimeout(timer)
  }, [successMessage, location.state, clearSuccessMessage])

  const hasActiveSubscription =
    currentSubscription &&
    (currentSubscription.subStatus ?? currentSubscription.status) !== 'canceled'

  const currentPlanKey = currentSubscription?.plan ?? null

  // [DEV-32] pet_archive 단일 플랜이라 "다른 플랜"이 없다. 이미 pet_archive를
  // 구독 중이면(레거시 all/will_premium 구독은 예외 - 갈아탈 옵션으로 남겨둔다)
  // 빈 그리드+의미 없는 "다른 플랜으로 변경" 헤더를 보여주지 않는다.
  const otherPlans = PLANS.filter((plan) => !(hasActiveSubscription && plan.key === currentPlanKey))

  return (
    <main className="pet-subscription-page">
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
          fontSize: 'var(--fs-body)',
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
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: 'var(--ls-heading-ko)' }}>
          구독 플랜
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-sm)' }}>
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
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--spacing-md)',
            fontSize: 'var(--fs-body)',
            fontWeight: 600,
          }}
        >
          {successMessage || '구독이 성공적으로 등록되었습니다.'}
        </p>
      )}

      {/* 로딩 */}
      {isLoading && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-body)' }}>불러오는 중...</p>
      )}

      {/* 조회 에러 */}
      {error && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)' }}>{error}</p>
      )}

      {/* 액션 에러 */}
      {actionError && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)' }}>{actionError}</p>
      )}

      {/* FIX: HIGH-1 - 202(불확정) 결과 안내. 성공(초록)도 실패(빨강)도 아닌 별도 색으로
          표시해 "재결제 완료"로 오인하지 않게 한다. 재시도를 유도하는 문구는 넣지 않는다. */}
      {actionNotice && (
        <p
          role="status"
          aria-live="polite"
          style={{
            background: 'var(--color-surface-warm)',
            color: 'var(--color-accent-brand-text)',
            border: '1px solid var(--color-accent-brand)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--spacing-md)',
            fontSize: 'var(--fs-body)',
            fontWeight: 600,
          }}
        >
          {actionNotice}
        </p>
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
            fontSize: 'var(--fs-body)',
            color: 'var(--color-text-secondary)',
            padding: 'var(--spacing-md)',
          }}
        >
          토스페이먼츠로 이동 중입니다...
        </p>
      )}

      {/* 플랜 목록 - 이미 pet_archive 구독 중이면 갈아탈 다른 플랜이 없어 숨긴다 */}
      {!isLoading && otherPlans.length > 0 && (
        <>
          {hasActiveSubscription && (
            <h2 style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              다른 플랜으로 변경
            </h2>
          )}

          <div
            className="pet-subscription-plans-grid"
            style={{ paddingTop: hasActiveSubscription ? 0 : 'var(--spacing-md)' }}
          >
            {otherPlans.map((plan) => (
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
          background: 'var(--color-surface-warm)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
          padding: '20px 24px',
          fontSize: 'var(--fs-caption)',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.7,
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: 'var(--spacing-sm)', fontSize: 'var(--fs-body)', color: 'var(--color-primary)' }}>유의사항</p>
        <ul style={{ listStyle: 'disc', paddingLeft: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>구독은 매월 자동 결제됩니다.</li>
          <li>해지 시 당월 이용 기간은 유지됩니다.</li>
          <li>플랜 변경은 다음 결제일부터 적용됩니다.</li>
          <li>AI 초상화는 매달 3장까지 만들 수 있어요. 다음 달 1일에 다시 채워집니다.</li>
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
