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
      }}
    >
      <header>
        <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: 'var(--spacing-sm)' }}>
          결제
        </p>
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
          주문 내용을 확인하고 결제를 진행해 주세요.
        </p>
      </header>

      {/* 주문 요약 카드 */}
      <section
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-md)',
        }}
      >
        <p style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>주문 요약</p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: 'var(--spacing-md) 0',
            borderTop: '1px solid var(--color-border)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>주문 번호</span>
          <span style={{ fontSize: 'var(--font-size-base)', fontFamily: 'monospace' }}>{orderId}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>서비스</span>
          <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600 }}>AI 사진관 1세트</span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 'var(--spacing-md)',
            borderTop: '2px solid var(--color-border)',
          }}
        >
          <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>결제 금액</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary-dark)' }}>
            {formattedAmount}원
          </span>
        </div>
      </section>

      {/* Mock 안내 배너 */}
      <div
        role="status"
        style={{
          background: '#fffbeb',
          border: '1px solid #f6d860',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--spacing-md)',
          display: 'flex',
          gap: 'var(--spacing-sm)',
          alignItems: 'flex-start',
        }}
      >
        <Info size={18} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 'var(--font-size-sm)', color: '#92400e', lineHeight: 1.6 }}>
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
            fontSize: 'var(--font-size-base)',
            background: '#fff5f5',
            border: '1px solid #fed7d7',
            borderRadius: 'var(--radius-md)',
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
          minHeight: 'var(--min-touch-target)',
          background: isPaying ? 'var(--color-border)' : 'var(--color-primary)',
          color: isPaying ? 'var(--color-text-muted)' : '#fff',
          border: 'none',
          borderRadius: 'var(--radius-full)',
          fontSize: 'var(--font-size-lg)',
          fontWeight: 700,
          cursor: isPaying ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-sm)',
          transition: 'background 0.2s',
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
