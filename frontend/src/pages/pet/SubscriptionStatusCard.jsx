import { formatKst } from '../../utils/dateKst.js'

// [2026-08-23 수정] will_premium(월 1,900원)·all(9,900원) 플랜은 DEV-17/DEV-32로
// 폐지되어 pet_archive 4,900원 단일가만 신규 가입 가능하다(백엔드
// subscriptionService.js PLANS 참조, docs/strategy/03-product-pricing.md와도 일치).
// 다만 이미 will_premium/all로 구독 중이던 기존 행은 강제취소하지 않았으므로
// (subscriptionService.js 주석) 화면에 여전히 나타날 수 있다 - PLAN_NAMES에는
// 표시용으로 남겨두되, 가격은 하드코딩하지 않는다(가격 정본은 항상 서버가 응답에
// 실어 보내는 subscription.price_krw다 - 폐지된 플랜은 원가가 이미 바뀌어
// 하드코딩 표를 유지관리할 수 없다. 결제 화면 금액이 서버 금액과 어긋나면 결제가
// 100% 실패하므로 프론트에 별도 가격표를 두지 않는 것이 원칙).
const PLAN_NAMES = {
  pet_archive: '반려동물 아카이브',
  will_premium: 'AI 영상 편지 프리미엄',
  all: '전체 이용권',
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
  // 가격은 하드코딩 표가 아니라 서버가 내려주는 실제 청구액(price_krw)을 그대로 쓴다 -
  // 이게 구독 시점에 실제로 청구된 금액의 단일 정본이다(폐지된 플랜이어도 정확함).
  const planPrice = subscription.price_krw ?? subscription.priceKrw
  const status = subscription.subStatus ?? subscription.status ?? 'canceled'

  return (
    <section
      role="region"
      aria-label="현재 구독 상태"
      style={{
        background: 'var(--color-pet-soft)',
        border: '1px solid var(--color-pet)',
        borderRadius: 'var(--radius-card)',
        padding: '24px',
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
            // FIX: 결함1 전수 점검 - subscriptionService.getSubscriptions는 원본 DB
            // 행(snake_case)을 그대로 스프레드하고 subStatus만 별도로 추가한다
            // (subscription_id, camelCase 변환 없음). subscription.subscriptionId는
            // 항상 undefined였고, 재결제 버튼이 POST /subscriptions/undefined/
            // retry-payment를 호출해 항상 실패했다.
            onClick={() => onRetry(subscription.subscription_id)}
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
