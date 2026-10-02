import { useLocation } from 'react-router-dom'
import { CreditCard, Loader2 } from 'lucide-react'
import useGiftPayment from './useGiftPayment.js'

// 표시 전용 - 실제 결제 금액은 서버가 preparePayment 응답으로 확정한 값을 쓴다(G3).
const PRICE_LABELS = { photo: '9,900원 (AI 사진관 세트)', will: '49,000원 (마지막 영상 편지)' }

function GiftPaymentPage() {
  const location = useLocation()
  const { giftId, isPaying, error, handlePay } = useGiftPayment()
  const productType = location.state?.productType
  const priceLabel = PRICE_LABELS[productType] ?? '결제 금액 확인 중...'

  if (!giftId) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--spacing-xl) var(--spacing-md)', textAlign: 'center' }}>
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-lg)' }}>
          유효하지 않은 선물 주문입니다. 처음부터 다시 시도해 주세요.
        </p>
      </main>
    )
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '32px var(--spacing-md) 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xl)',
      }}
    >
      <header>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--spacing-sm)', letterSpacing: 'var(--ls-heading-ko)' }}>
          선물 결제
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          결제가 끝나면 받는 분께 전달할 링크가 만들어져요.
        </p>
      </header>

      <section
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-md)',
        }}
      >
        <p style={{ fontWeight: 600, fontSize: 'var(--fs-body-lg)', color: 'var(--color-text-primary)' }}>주문 요약</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--spacing-md)', borderTop: '2px solid var(--color-border-strong)' }}>
          <span style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600, color: 'var(--color-text-primary)' }}>결제 금액</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-primary)' }}>{priceLabel}</span>
        </div>
      </section>

      {error && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)', background: 'var(--color-error-light)', border: '1px solid var(--color-error)', borderRadius: 'var(--radius-sm)', padding: 'var(--spacing-md)' }}>
          {error}
        </p>
      )}

      <button
        onClick={handlePay}
        disabled={isPaying}
        aria-disabled={isPaying}
        aria-busy={isPaying}
        style={{
          width: '100%',
          height: 'var(--size-button-h)',
          minHeight: 'var(--min-touch-target)',
          background: isPaying ? 'var(--color-border)' : 'var(--color-primary)',
          color: isPaying ? 'var(--color-text-muted)' : 'var(--color-text-on-dark)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          fontSize: 'var(--fs-button)',
          fontWeight: 700,
          cursor: isPaying ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-sm)',
        }}
      >
        {isPaying ? (
          <>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            결제 처리 중...
          </>
        ) : (
          <>
            <CreditCard size={20} />
            결제하기
          </>
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}

export default GiftPaymentPage
