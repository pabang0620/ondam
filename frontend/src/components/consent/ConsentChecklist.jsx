import { CheckSquare, Square } from 'lucide-react'
import './ConsentChecklist.css'

/**
 * 카드형 동의 체크리스트 UI - WillConsentPage.jsx에서 추출한 공용 컴포넌트.
 * 문구(items)만 바꿔 WILL_CONSENT_ITEMS/PHOTO_CONSENT_ITEMS 양쪽에 재사용한다.
 * 화면별 헤더·안내문·다음 버튼은 각 페이지가 그대로 유지한다(레이아웃 보존).
 */
export default function ConsentChecklist({
  items,
  consents,
  onToggleItem,
  onToggleAll,
  allChecked,
  accentColor = '--color-primary',
}) {
  return (
    <div style={{ '--consent-accent': `var(${accentColor})` }}>
      <div className="consent-checklist__items">
        {items.map(({ key, label, desc }) => (
          <button
            key={key}
            type="button"
            className={`consent-checklist__card ${consents[key] ? 'is-checked' : ''}`}
            onClick={() => onToggleItem(key)}
            aria-pressed={consents[key]}
          >
            <span className="consent-checklist__card-check" aria-hidden="true">
              {consents[key] ? <CheckSquare size={24} /> : <Square size={24} />}
            </span>
            <div className="consent-checklist__card-text">
              <span className="consent-checklist__card-label">{label}</span>
              <span className="consent-checklist__card-desc">{desc}</span>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`consent-checklist__all ${allChecked ? 'is-checked' : ''}`}
        onClick={onToggleAll}
        aria-pressed={allChecked}
      >
        <span aria-hidden="true">
          {allChecked ? <CheckSquare size={22} /> : <Square size={22} />}
        </span>
        위 항목 전체에 동의합니다
      </button>
    </div>
  )
}
