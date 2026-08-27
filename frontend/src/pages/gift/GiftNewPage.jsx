import { Gift, Camera, Video, Loader2 } from 'lucide-react'
import useGiftNew from './useGiftNew.js'

const PRODUCTS = [
  {
    type: 'photo',
    label: 'AI 사진관 세트',
    price: '9,900원',
    desc: '오래된 사진을 복원하고 결과물 4종을 만들어 드려요',
    icon: Camera,
  },
  {
    type: 'will',
    label: '마지막 영상 편지',
    price: '49,000원',
    desc: '사진과 목소리로 소중한 분께 남기는 영상 편지예요',
    icon: Video,
  },
]

function GiftNewPage() {
  const {
    productType,
    setProductType,
    recipientName,
    setRecipientName,
    recipientPhone,
    setRecipientPhone,
    isSubmitting,
    error,
    canSubmit,
    handleSubmit,
  } = useGiftNew()

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--spacing-sm)' }}>
          <Gift size={28} color="var(--color-primary)" aria-hidden="true" />
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: 'var(--ls-heading-ko)' }}>
            선물하기
          </h1>
        </div>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          부모님께 리멤버미 서비스를 선물해 드리세요. 결제는 지금 하시고, 사진 올리기·녹음은
          부모님이 편하실 때 링크로 직접 하시면 돼요.
        </p>
      </header>

      <section>
        <p style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
          1. 선물할 상품을 선택해 주세요
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {PRODUCTS.map(({ type, label, price, desc, icon: Icon }) => {
            const isSelected = productType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => setProductType(type)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--spacing-md)',
                  textAlign: 'left',
                  padding: '20px',
                  minHeight: 'var(--min-touch-target)',
                  borderRadius: 'var(--radius-card)',
                  border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: isSelected ? 'var(--color-surface-warm)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  transition: 'border-color var(--transition-base), background-color var(--transition-base)',
                }}
              >
                <Icon size={28} color="var(--color-primary)" aria-hidden="true" />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {label} · {price}
                  </span>
                  <span style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
                    {desc}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <p style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
          2. 받는 분 정보를 입력해 주세요
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="recipientName" style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              받는 분 이름
            </label>
            <input
              id="recipientName"
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="예: 김리멤버"
              style={{
                height: 'var(--size-input-h)',
                minHeight: 'var(--min-touch-target)',
                padding: '0 16px',
                fontSize: 'var(--fs-body)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                background: 'var(--color-surface)',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="recipientPhone" style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              받는 분 휴대폰 번호
            </label>
            <input
              id="recipientPhone"
              type="tel"
              inputMode="numeric"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="010-1234-5678"
              style={{
                height: 'var(--size-input-h)',
                minHeight: 'var(--min-touch-target)',
                padding: '0 16px',
                fontSize: 'var(--fs-body)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                background: 'var(--color-surface)',
              }}
            />
            <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}>
              링크를 열 때 본인 확인(뒤 4자리)에 사용돼요. 실제 문자 발송은 되지 않으니
              링크는 직접 전달해 주세요.
            </p>
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)', background: 'var(--color-error-light)', border: '1px solid var(--color-error)', borderRadius: 'var(--radius-sm)', padding: 'var(--spacing-md)' }}>
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        aria-disabled={!canSubmit}
        aria-busy={isSubmitting}
        style={{
          width: '100%',
          height: 'var(--size-button-h)',
          minHeight: 'var(--min-touch-target)',
          background: canSubmit ? 'var(--color-primary)' : 'var(--color-border)',
          color: canSubmit ? 'var(--color-text-on-dark)' : 'var(--color-text-muted)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          fontSize: 'var(--fs-button)',
          fontWeight: 700,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-sm)',
        }}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            처리 중...
          </>
        ) : (
          '다음: 결제'
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}

export default GiftNewPage
