import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import './WillStepHeader.css'

const TOTAL_STEPS = 5

export default function WillStepHeader({ currentStep, title }) {
  const navigate = useNavigate()

  return (
    <header className="will-step-header">
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

      <div className="will-step-header__progress" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`will-step-header__dot ${i < currentStep ? 'is-done' : ''} ${i === currentStep - 1 ? 'is-active' : ''}`}
          />
        ))}
      </div>
    </header>
  )
}
