import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'
import './WillStepHeader.css'

// FIX: 결함7 - 실제 흐름(useWillConsent/useWillBeneficiaries/useWillRecord/
// useWillPhoto/useWillPreview.js의 navigate() 대상 순서로 확인)은 동의 확인 →
// 유가족 등록 → 음성 녹음 → 사진 업로드 → 편지 쓰기 → 결제 6단계다.
const TOTAL_STEPS = 6

// 단계 이름 (인덱스 = 단계 - 1). 접근 가능한 버튼 이름에만 사용한다.
const STEP_TITLES = ['동의 확인', '유가족 등록', '음성 녹음', '사진 업로드', '편지 쓰기', '결제']

// 단계별 "이전" 이동 경로 (인덱스 = 단계 - 1). 1단계의 이전은 영상편지 소개 페이지.
const PREV_ROUTES = [
  ROUTES.WILL,
  ROUTES.WILL_CONSENT,
  ROUTES.WILL_BENEFICIARIES,
  ROUTES.WILL_RECORD,
  ROUTES.WILL_PHOTO,
  ROUTES.WILL_PREVIEW,
]

export default function WillStepHeader({ currentStep, title, onNext, nextDisabled = false }) {
  const navigate = useNavigate()

  const prevTitle = currentStep >= 2 ? STEP_TITLES[currentStep - 2] : null
  const prevLabel = prevTitle ? `이전 단계 - ${prevTitle}` : '이전 단계'
  const nextTitle = STEP_TITLES[currentStep] // 마지막 단계면 undefined
  const nextLabel = nextTitle ? `다음 단계 - ${nextTitle}` : '다음 단계'

  const isNextDisabled = !onNext || nextDisabled || currentStep >= TOTAL_STEPS
  const prevRoute = PREV_ROUTES[currentStep - 1]

  return (
    <header className="will-step-header">
      <div className="will-step-header__inner">
        <div className="will-step-header__row">
          <button
            type="button"
            className="will-step-header__nav"
            onClick={() => prevRoute && navigate(prevRoute)}
            disabled={!prevRoute}
            aria-label={prevLabel}
          >
            <ChevronLeft size={24} aria-hidden="true" />
          </button>

          <div className="will-step-header__heading">
            <span className="will-step-header__title">{title}</span>{' '}
            <span className="will-step-header__count">
              {currentStep}/{TOTAL_STEPS}
            </span>
          </div>

          <button
            type="button"
            className="will-step-header__nav"
            onClick={() => { if (!isNextDisabled) onNext() }}
            disabled={isNextDisabled}
            aria-disabled={isNextDisabled}
            aria-label={nextLabel}
          >
            <ChevronRight size={24} aria-hidden="true" />
          </button>
        </div>

        <div
          className="will-step-header__progress"
          role="progressbar"
          aria-label="영상 편지 제작 진행도"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-valuetext={`${TOTAL_STEPS}단계 중 ${currentStep}단계`}
        >
          <div
            className="will-step-header__progress-fill"
            style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>
    </header>
  )
}
