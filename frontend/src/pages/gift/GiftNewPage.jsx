import { useRef } from 'react'
import { Camera, Video, Loader2, Gift } from 'lucide-react'
import useGiftNew from './useGiftNew.js'
import './GiftNewPage.css'

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

// 움직임 줄이기 설정을 존중한다. matchMedia 미지원 환경은 즉시 이동('auto')
function getScrollBehavior() {
  const reduce =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return reduce ? 'auto' : 'smooth'
}

function GiftNewPage() {
  const formRef = useRef(null)
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

  // 배너 버튼: 아래 주문 폼 섹션(항상 렌더됨)으로 스크롤하고 포커스도 옮긴다
  const handleStart = () => {
    const target = formRef.current
    if (!target) return
    target.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' })
    target.focus({ preventScroll: true })
  }

  return (
    <div className="gift-new-page">
      {/* Hero - 버튼을 누르면 바로 아래 주문 폼으로 스크롤 */}
      <section className="gift-hero">
        <div className="gift-hero__inner">
          <h1 className="gift-hero__title">소중한 분께 온담을 선물하세요</h1>
          <p className="gift-hero__sub">
            결제는 지금, 사진과 녹음은 받는 분이 편하실 때 링크로 해요
          </p>
          <button type="button" className="gift-hero__cta" onClick={handleStart}>
            선물 시작하기
            <Gift size={20} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* 주문 폼 (outer = 전체 너비 배경 / inner = 600px). 배너 버튼의 스크롤·포커스 대상 */}
      <section className="gift-form" ref={formRef} tabIndex={-1}>
        <div className="gift-form__inner">
          <div className="gift-form__steps">
            <section>
              <h2 className="gift-form__step-title">
                <span className="gift-form__step-badge">1</span>
                <span>선물할 상품을 선택해 주세요</span>
              </h2>
              <div className="gift-product-list">
                {PRODUCTS.map(({ type, label, price, desc, icon: Icon }) => {
                  const isSelected = productType === type
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setProductType(type)}
                      className={`gift-product-card${isSelected ? ' is-selected' : ''}`}
                    >
                      <span className="gift-product-card__body">
                        <span className="gift-product-card__label">{label} · {price}</span>
                        <span className="gift-product-card__desc">{desc}</span>
                      </span>
                      <Icon className="gift-product-card__icon" size={28} aria-hidden="true" />
                    </button>
                  )
                })}
              </div>
            </section>
  
            <section>
              <h2 className="gift-form__step-title">
                <span className="gift-form__step-badge">2</span>
                <span>받는 분 정보를 입력해 주세요</span>
              </h2>
              <div className="gift-field-list">
                <div className="gift-field">
                  <label htmlFor="recipientName" className="gift-field__label">받는 분 이름</label>
                  <input
                    id="recipientName"
                    type="text"
                    className="gift-field__input"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="예: 김리멤버"
                  />
                </div>
                <div className="gift-field">
                  <label htmlFor="recipientPhone" className="gift-field__label">받는 분 휴대폰 번호</label>
                  <input
                    id="recipientPhone"
                    type="tel"
                    inputMode="numeric"
                    className="gift-field__input"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    aria-describedby="recipientPhone-hint"
                  />
                  <p id="recipientPhone-hint" className="gift-field__hint">
                    링크를 열 때 본인 확인(뒤 4자리)에 사용돼요. 실제 문자 발송은 되지 않으니
                    링크는 직접 전달해 주세요.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {error && <p role="alert" className="gift-error">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            aria-busy={isSubmitting}
            className="gift-submit"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="gift-submit__spinner" aria-hidden="true" />
                처리 중...
              </>
            ) : (
              '다음: 결제'
            )}
          </button>
        </div>
      </section>
    </div>
  )
}

export default GiftNewPage
