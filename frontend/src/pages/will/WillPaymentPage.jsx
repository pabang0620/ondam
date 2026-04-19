import { useWillPayment } from './useWillPayment.js'
import { CreditCard, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import WillStepHeader from './WillStepHeader.jsx'
import './WillPaymentPage.css'

export default function WillPaymentPage() {
  const { isPaying, payError, handlePay } = useWillPayment()

  return (
    <div className="will-payment-page">
      <WillStepHeader currentStep={5} title="결제" />

      <div className="will-payment__content">
        {/* 주문 요약 */}
        <section className="will-payment__summary" aria-label="주문 요약">
          <h2 className="will-payment__section-title">주문 요약</h2>

          <div className="will-payment__item">
            <div className="will-payment__item-info">
              <span className="will-payment__item-name">AI 유언장 제작</span>
              <ul className="will-payment__item-desc">
                <li><CheckCircle size={14} aria-hidden="true" /> 음성 복제</li>
                <li><CheckCircle size={14} aria-hidden="true" /> AI 영상 생성</li>
                <li><CheckCircle size={14} aria-hidden="true" /> 암호화 보관</li>
                <li><CheckCircle size={14} aria-hidden="true" /> 유가족 전달</li>
              </ul>
            </div>
            <span className="will-payment__item-price">49,000원</span>
          </div>

          <div className="will-payment__divider" aria-hidden="true" />

          <div className="will-payment__total">
            <span className="will-payment__total-label">합계</span>
            <span className="will-payment__total-price">49,000원</span>
          </div>
        </section>

        {/* 보관 구독 안내 */}
        <div className="will-payment__sub-notice">
          <Lock size={16} aria-hidden="true" />
          <span>장기 보관 구독 <strong>1,900원/월</strong>은 별도 결제입니다. 지금은 제작비만 결제합니다.</span>
        </div>

        {payError && (
          <div className="will-payment__error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            {payError}
          </div>
        )}

        {/* 결제 버튼 */}
        <button
          type="button"
          className="will-payment__pay-btn"
          onClick={handlePay}
          disabled={isPaying}
          aria-busy={isPaying}
        >
          <CreditCard size={22} aria-hidden="true" />
          {isPaying ? '결제 처리 중...' : '49,000원 결제하기'}
        </button>

        <p className="will-payment__secure-note">
          <Lock size={12} aria-hidden="true" />
          결제 정보는 암호화되어 안전하게 처리됩니다.
        </p>
      </div>
    </div>
  )
}
