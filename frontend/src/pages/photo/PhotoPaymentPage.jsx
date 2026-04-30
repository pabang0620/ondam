import { CreditCard, Info, Loader2 } from 'lucide-react'
import usePhotoPayment from './usePhotoPayment.js'

function PhotoPaymentPage() {
  const { orderId, amount, isPaying, error, handlePay } = usePhotoPayment()

  const formattedAmount = amount.toLocaleString('ko-KR')

  if (!orderId) {
    return (
      <main
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: 'var(--spacing-xl) var(--spacing-md)',
          textAlign: 'center',
        }}
      >
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-lg)' }}>
          유효하지 않은 주문입니다. 처음부터 다시 시도해 주세요.
        </p>
      </main>
    )
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: 'var(--spacing-xl) var(--spacing-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xl)',
        background: 'var(--color-bg)',
      }}
    >
      <header>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 800, color: 'var(--color-photo)', marginBottom: 'var(--spacing-sm)', letterSpacing: 'var(--ls-heading-ko)' }}>
          결제
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          주문 내용을 확인하고 결제를 진행해 주세요.
        </p>
      </header>

      {/* 주문 요약 카드 */}
      <section
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--spacing-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-md)',
        }}
      >
        <p style={{ fontWeight: 700, fontSize: 'var(--fs-body-lg)', color: 'var(--color-text-primary)' }}>주문 요약</p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: 'var(--spacing-md) 0',
            borderTop: '1px solid var(--color-border)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-body)' }}>주문 번호</span>
          <span style={{ fontSize: 'var(--fs-body)', fontFamily: 'monospace' }}>{orderId}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-body)' }}>서비스</span>
          <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-text-primary)' }}>AI 사진관 1세트</span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 'var(--spacing-md)',
            borderTop: '2px solid var(--color-border-strong)',
          }}
        >
          <span style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>결제 금액</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-photo)' }}>
            {formattedAmount}원
          </span>
        </div>
      </section>

      {/* Mock 안내 배너 */}
      <div
        role="status"
        style={{
          background: 'var(--color-surface-warm)',
          border: '1px solid var(--color-warm-accent-soft)',
          borderRadius: 'var(--radius-sm)',
          padding: 'var(--spacing-md)',
          display: 'flex',
          gap: 'var(--spacing-sm)',
          alignItems: 'flex-start',
        }}
      >
        <Info size={18} color="var(--color-warm-accent)" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          현재 결제는 테스트 모드로 동작합니다. 실제 금액이 청구되지 않습니다.
          토스페이먼츠 정식 연동 전까지 모의 결제로 진행됩니다.
        </p>
      </div>

      {/* 에러 */}
      {error && (
        <p
          role="alert"
          style={{
            color: 'var(--color-error)',
            fontSize: 'var(--fs-body)',
            background: 'var(--color-error-light)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--spacing-md)',
          }}
        >
          {error}
        </p>
      )}

      {/* 결제 버튼 */}
      <button
        onClick={handlePay}
        disabled={isPaying}
        aria-disabled={isPaying}
        aria-busy={isPaying}
        style={{
          width: '100%',
          height: 'var(--size-button-h)',
          minHeight: 'var(--size-button-h)',
          background: isPaying ? 'var(--color-border)' : 'var(--color-photo)',
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
          transition: 'background-color var(--transition-base)',
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
            {formattedAmount}원 결제하기
          </>
        )}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}

export default PhotoPaymentPage
