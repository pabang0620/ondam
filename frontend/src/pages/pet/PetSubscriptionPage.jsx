import { useNavigate } from 'react-router-dom'
import { ChevronLeft, CheckCircle, Crown } from 'lucide-react'
import { usePetSubscription } from './usePetSubscription.js'
import { ROUTES } from '../../constants/routes.js'

const STATIC_PLANS = [
  {
    key: 'free',
    label: '무료',
    price: '0원',
    priceNum: 0,
    features: ['반려동물 1마리 등록', '사진 10장 보관', '기본 프로필 페이지'],
    highlight: false,
  },
  {
    key: 'standard',
    label: '스탠다드',
    price: '4,900원/월',
    priceNum: 4900,
    features: ['반려동물 3마리', '사진 100장 보관', 'AI 초상화 1회', '추모 페이지 공개'],
    highlight: true,
  },
  {
    key: 'premium',
    label: '프리미엄',
    price: '9,900원/월',
    priceNum: 9900,
    features: ['무제한 반려동물', '사진 무제한', 'AI 초상화 무제한', '추모 페이지 공개', '전용 슬러그'],
    highlight: false,
  },
]

function PlanCard({ plan, isCurrent, isProcessing, onSubscribe, onCancel, subscriptionId }) {
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
        <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{plan.label}</p>
        <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-primary-dark)', marginTop: 4 }}>
          {plan.price}
        </p>
      </div>

      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', flex: 1 }}>
        {plan.features.map((f) => (
          <li
            key={f}
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
            }}
          >
            <CheckCircle size={15} color="var(--color-success)" aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>

      {/* 버튼 */}
      {isCurrent && plan.priceNum > 0 ? (
        <button
          onClick={() => onCancel(subscriptionId)}
          disabled={isProcessing}
          style={{
            background: 'none',
            color: 'var(--color-text-muted)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-full)',
            minHeight: 'var(--min-touch-target)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            opacity: isProcessing ? 0.7 : 1,
          }}
        >
          {isProcessing ? '처리 중...' : '구독 해지'}
        </button>
      ) : !isCurrent && plan.priceNum > 0 ? (
        <button
          onClick={() => onSubscribe(plan.key)}
          disabled={isProcessing}
          style={{
            background: plan.highlight ? 'var(--color-primary)' : 'var(--color-surface)',
            color: plan.highlight ? '#fff' : 'var(--color-primary)',
            border: `2px solid ${plan.highlight ? 'var(--color-primary)' : 'var(--color-primary)'}`,
            borderRadius: 'var(--radius-full)',
            minHeight: 'var(--min-touch-target)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 700,
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            opacity: isProcessing ? 0.7 : 1,
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          {isProcessing ? '처리 중...' : '구독하기'}
        </button>
      ) : (
        <button
          disabled
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-text-muted)',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            minHeight: 'var(--min-touch-target)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
            cursor: 'default',
          }}
        >
          {isCurrent ? '무료 플랜 이용 중' : '무료로 시작'}
        </button>
      )}
    </div>
  )
}

export default function PetSubscriptionPage() {
  const navigate = useNavigate()
  const {
    currentSubscription,
    isLoading,
    error,
    isProcessing,
    actionError,
    handleSubscribe,
    handleCancel,
  } = usePetSubscription()

  const currentPlanKey = currentSubscription?.plan ?? 'free'

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

      {isLoading && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-base)' }}>불러오는 중...</p>
      )}

      {error && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-base)' }}>{error}</p>
      )}

      {actionError && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-base)' }}>{actionError}</p>
      )}

      {!isLoading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--spacing-xl)',
            paddingTop: 'var(--spacing-md)',
          }}
        >
          {STATIC_PLANS.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              isCurrent={currentPlanKey === plan.key}
              isProcessing={isProcessing}
              subscriptionId={currentSubscription?.subscriptionId}
              onSubscribe={handleSubscribe}
              onCancel={handleCancel}
            />
          ))}
        </div>
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
    </main>
  )
}
