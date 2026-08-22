import { CreditCard, Loader2 } from 'lucide-react'
import usePhotoPayment from './usePhotoPayment.js'

function PhotoPaymentPage() {
  const { orderId, amount, isPaying, error, handlePay } = usePhotoPayment()

  // FIX: DEV-29 - amount는 더 이상 하드코딩 상수가 아니라 서버 조회 결과라 초기값이
  // null일 수 있다(로딩 중). 실제 결제 금액은 handlePay 내부에서 그 순간의 prepare
  // 응답 값을 쓰므로 이 표시값과 무관하게 정확하다.
  const formattedAmount = amount == null ? '확인 중...' : `${amount.toLocaleString('ko-KR')}원`

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
        padding: '32px var(--spacing-md) 48px',
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

      {/* 주문 요약 카드 — 24px padding */}
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
          <span style={{ fontSize: 'var(--fs-caption)', fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'right', maxWidth: '60%' }}>{orderId}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-body)' }}>서비스</span>
          <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-text-primary)' }}>AI 사진관 1세트 (결과물 4장)</span>
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
            {formattedAmount}
          </span>
        </div>
      </section>

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
            {formattedAmount} 결제하기
          </>
        )}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}

export default PhotoPaymentPage
