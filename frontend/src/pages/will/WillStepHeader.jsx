import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import './WillStepHeader.css'

// FIX: 결함7 - 실제 흐름(useWillConsent/useWillBeneficiaries/useWillRecord/
// useWillPhoto/useWillPreview.js의 navigate() 대상 순서로 확인)은 동의 확인 →
// 유가족 등록 → 음성 녹음 → 사진 업로드 → 미리보기 → 결제 6단계다. TOTAL_STEPS가
// 5로 고정돼 있어 마지막 결제 단계까지 6개 화면이 5단계 안에 욱여넣어졌고, 그
// 결과 "유가족 등록"과 "음성 녹음"이 둘 다 "2 / 5"로 겹쳐 표시됐다.
const TOTAL_STEPS = 6

export default function WillStepHeader({ currentStep, title }) {
  const navigate = useNavigate()

  return (
    <header className="will-step-header">
      <div className="will-step-header__inner">
        <button
          type="button"
          className="will-step-header__back"
          onClick={() => navigate(-1)}
          aria-label="이전으로"
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>

        <div className="will-step-header__info">
          <span className="will-step-header__step">
            {currentStep} / {TOTAL_STEPS}
          </span>
          <span className="will-step-header__title">{title}</span>
        </div>

        <div className="will-step-header__progress" role="progressbar" aria-label="영상 편지 제작 진행도" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuetext={`${TOTAL_STEPS}단계 중 ${currentStep}단계`}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`will-step-header__dot ${i < currentStep ? 'is-done' : ''} ${i === currentStep - 1 ? 'is-active' : ''}`}
            />
          ))}
        </div>
      </div>
    </header>
  )
}
