import { useWillConsent } from './useWillConsent.js'
import { CheckSquare, Square } from 'lucide-react'
import WillStepHeader from './WillStepHeader.jsx'
import './WillConsentPage.css'

export default function WillConsentPage() {
  const { consents, allChecked, consentItems, toggleItem, toggleAll, handleNext } =
    useWillConsent()

  return (
    <div className="will-consent-page">
      <WillStepHeader currentStep={1} title="동의 확인" />

      <div className="will-consent__content">
        <p className="will-consent__guide">
          AI 유언장 제작을 위해 아래 항목에 모두 동의해 주세요.
        </p>

        <div className="will-consent__items">
          {consentItems.map(({ key, label, desc }) => (
            <button
              key={key}
              type="button"
              className={`will-consent__card ${consents[key] ? 'is-checked' : ''}`}
              onClick={() => toggleItem(key)}
              aria-pressed={consents[key]}
            >
              <span className="will-consent__card-check" aria-hidden="true">
                {consents[key]
                  ? <CheckSquare size={24} />
                  : <Square size={24} />}
              </span>
              <div className="will-consent__card-text">
                <span className="will-consent__card-label">{label}</span>
                <span className="will-consent__card-desc">{desc}</span>
              </div>
            </button>
          ))}
        </div>

        {/* 전체 동의 */}
        <button
          type="button"
          className={`will-consent__all ${allChecked ? 'is-checked' : ''}`}
          onClick={toggleAll}
          aria-pressed={allChecked}
        >
          <span aria-hidden="true">
            {allChecked ? <CheckSquare size={22} /> : <Square size={22} />}
          </span>
          위 항목 전체에 동의합니다
        </button>

        <button
          type="button"
          className="will-consent__next"
          onClick={handleNext}
          disabled={!allChecked}
          aria-disabled={!allChecked}
        >
          다음 — 유가족 등록
        </button>
      </div>
    </div>
  )
}
