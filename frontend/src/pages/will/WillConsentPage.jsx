import { AlertCircle } from 'lucide-react'
import { useWillConsent } from './useWillConsent.js'
import WillStepHeader from './WillStepHeader.jsx'
import LegalNotice from '../../components/common/LegalNotice.jsx'
import ConsentChecklist from '../../components/consent/ConsentChecklist.jsx'
import './WillConsentPage.css'

export default function WillConsentPage() {
  const {
    consents, allChecked, consentItems, toggleItem, toggleAll, handleNext, isSaving, saveError,
  } = useWillConsent()

  return (
    <div className="will-consent-page">
      <WillStepHeader currentStep={1} title="동의 확인" onNext={handleNext} nextDisabled={!allChecked || isSaving} />

      <div className="will-consent__content">
        <p className="will-consent__guide">
          AI 영상 편지 제작을 위해 아래 항목에 모두 동의해 주세요.
        </p>

        {/* 법적 유언 효력 없음 고지 - DEV-05. 동의 항목을 읽기 전에 먼저 안내 */}
        <LegalNotice theme="light" className="will-consent__legal-notice" />

        <ConsentChecklist
          items={consentItems}
          consents={consents}
          onToggleItem={toggleItem}
          onToggleAll={toggleAll}
          allChecked={allChecked}
          accentColor="--color-will"
        />

        {/* FIX: D - 동의 저장 실패를 조용히 넘기지 않고 화면에 알린다 */}
        {saveError && (
          <p role="alert" className="will-consent__error">
            <AlertCircle size={16} /> {saveError}
          </p>
        )}

        <button
          type="button"
          className="will-consent__next"
          onClick={handleNext}
          disabled={!allChecked || isSaving}
          aria-disabled={!allChecked || isSaving}
          aria-busy={isSaving}
        >
          {isSaving ? '저장하는 중...' : '다음 - 유가족 등록'}
        </button>
      </div>
    </div>
  )
}
