import { useWillPayment } from './useWillPayment.js'
import { CreditCard, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import WillStepHeader from './WillStepHeader.jsx'
import LegalNotice from '../../components/common/LegalNotice.jsx'
import './WillPaymentPage.css'

export default function WillPaymentPage() {
  const { isPaying, payError, handlePay, amount } = useWillPayment()
  // FIX: DEV-29 - amount는 더 이상 하드코딩 상수가 아니라 서버 조회 결과라 초기값이
  // null일 수 있다(로딩 중). 화면 표시 문구만 로딩 상태를 대비하고, 실제 결제 금액은
  // handlePay 내부에서 항상 그 순간의 prepare 응답 값을 쓰므로 이 표시값과 무관하게 정확하다.
  const displayAmount = amount == null ? '확인 중...' : `${amount.toLocaleString()}원`

  return (
    <div className="will-payment-page">
      <WillStepHeader currentStep={6} title="결제" />

      <div className="will-payment__content">
        {/* 주문 요약 */}
        <section className="will-payment__summary" aria-label="주문 요약">
          <h2 className="will-payment__section-title">주문 요약</h2>

          <div className="will-payment__item">
            <div className="will-payment__item-info">
              <span className="will-payment__item-name">AI 영상 편지 제작</span>
              <ul className="will-payment__item-desc">
                <li><CheckCircle size={14} aria-hidden="true" /> 음성 복제</li>
                <li><CheckCircle size={14} aria-hidden="true" /> AI 영상 생성</li>
                <li><CheckCircle size={14} aria-hidden="true" /> 암호화 보관</li>
                <li><CheckCircle size={14} aria-hidden="true" /> 유가족 전달</li>
              </ul>
            </div>
            <span className="will-payment__item-price">{displayAmount}</span>
          </div>

          <div className="will-payment__divider" aria-hidden="true" />

          <div className="will-payment__total">
            <span className="will-payment__total-label">합계</span>
            <span className="will-payment__total-price">{displayAmount}</span>
          </div>
        </section>

        {/* 보관 구독 안내 */}
        <div className="will-payment__sub-notice">
          <Lock size={16} aria-hidden="true" />
          <span>장기 보관 구독 <strong>1,900원/월</strong>은 별도 결제입니다. 지금은 제작비만 결제합니다.</span>
        </div>

        {/* 법적 유언 효력 없음 고지 - DEV-05. 결제(돈을 내는 시점) 직전에 배치 */}
        <LegalNotice theme="light" className="will-payment__legal-notice" />

        {payError && (
          <div className="will-payment__error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            {payError}
          </div>
        )}

        {/* 결제 버튼 */}
        {/* FIX: DEV-29 - amount==null(표시용 조회 실패/지연)이어도 버튼을 막지 않는다.
            handlePay는 amount 상태와 무관하게 클릭 시점에 preparePayment로 서버 정본
            금액을 다시 확인하므로, 표시 조회 실패가 결제 자체를 영구히 막게 하지 않는다. */}
        <button
          type="button"
          className="will-payment__pay-btn"
          onClick={handlePay}
          disabled={isPaying}
          aria-busy={isPaying}
        >
          <CreditCard size={22} aria-hidden="true" />
          {isPaying ? '결제 처리 중...' : `${displayAmount} 결제하기`}
        </button>

        <p className="will-payment__secure-note">
          <Lock size={12} aria-hidden="true" />
          결제 정보는 암호화되어 안전하게 처리됩니다.
        </p>
      </div>
    </div>
  )
}
