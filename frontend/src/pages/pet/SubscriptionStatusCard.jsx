import { formatKst } from '../../utils/dateKst.js'

const PLAN_NAMES = {
  pet_archive: '반려동물 아카이브',
  will_premium: 'AI 유언장 프리미엄',
  all: '전체 이용권',
}

const PLAN_PRICES = {
  pet_archive: 9900,
  will_premium: 29900,
  all: 39900,
}

const STATUS_CONFIG = {
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

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.canceled
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 12px',
        borderRadius: 'var(--radius-pill)',
        fontSize: 'var(--fs-caption)',
        fontWeight: 700,
        ...config.badgeStyle,
      }}
    >
      {config.label}
    </span>
  )
}

export default function SubscriptionStatusCard({ subscription, onCancel, onRetry, isProcessing }) {
  if (!subscription) return null

  const planName = PLAN_NAMES[subscription.plan] ?? subscription.plan
  const planPrice = PLAN_PRICES[subscription.plan]
  const status = subscription.subStatus ?? subscription.status ?? 'canceled'

  return (
    <section
      role="region"
      aria-label="현재 구독 상태"
      style={{
        background: 'var(--color-pet-soft)',
        border: '1px solid var(--color-pet)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--spacing-xl)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
        <p style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>
          현재 구독
        </p>
        <StatusBadge status={status} />
      </div>

      {/* 플랜 정보 */}
      <div>
        <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-primary)' }}>
          {planName}
        </p>
        {planPrice && (
          <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
            월 {planPrice.toLocaleString()}원
          </p>
        )}
      </div>

      {/* 상태별 부가 정보 */}
      {status === 'active' && subscription.next_billing_at && (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>
          다음 결제일: <strong style={{ color: 'var(--color-primary)' }}>{formatKst(subscription.next_billing_at)}</strong>
        </p>
      )}

      {status === 'past_due' && (
        <p
          role="alert"
          style={{ fontSize: 'var(--fs-body)', color: '#c2410c', background: '#fff7ed', borderRadius: 'var(--radius-sm)', padding: 'var(--spacing-sm) var(--spacing-md)' }}
        >
          최근 결제가 실패했습니다. 결제 수단을 확인하고 재결제를 시도해 주세요.
        </p>
      )}

      {status === 'suspended' && (
        <p
          role="alert"
          style={{ fontSize: 'var(--fs-body)', color: 'var(--color-error)', background: 'var(--color-error-light)', borderRadius: 'var(--radius-sm)', padding: 'var(--spacing-sm) var(--spacing-md)' }}
        >
          결제 수단을 확인해 주세요.
        </p>
      )}

      {/* 액션 버튼 */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
        {(status === 'past_due' || status === 'suspended') && (
          <button
            type="button"
            onClick={() => onRetry(subscription.subscriptionId)}
            disabled={isProcessing}
            style={{
              flex: 1,
              minHeight: 'var(--size-button-h)',
              minWidth: '120px',
              padding: '0 var(--spacing-lg)',
              fontSize: 'var(--fs-button)',
              fontWeight: 700,
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.7 : 1,
            }}
          >
            {isProcessing ? '처리 중...' : '재결제하기'}
          </button>
        )}

        {(status === 'active' || status === 'past_due') && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            style={{
              flex: status === 'active' ? 1 : 'none',
              minHeight: 'var(--size-button-h)',
              minWidth: '120px',
              padding: '0 var(--spacing-lg)',
              fontSize: 'var(--fs-button)',
              fontWeight: 600,
              background: 'none',
              color: 'var(--color-text-muted)',
              border: '1.5px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-pill)',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.7 : 1,
            }}
          >
            구독 해지
          </button>
        )}
      </div>
    </section>
  )
}
