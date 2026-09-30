import { useWillBeneficiaries } from './useWillBeneficiaries.js'
import { UserPlus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import WillStepHeader from './WillStepHeader.jsx'
import './WillBeneficiariesPage.css'

const RELATIONSHIP_OPTIONS = ['배우자', '자녀', '부모', '형제/자매', '친척', '친구', '기타']

// 필드별 aria-describedby 값 (힌트 + 오류 id를 공백으로 연결)
function describedBy(...ids) {
  const joined = ids.filter(Boolean).join(' ')
  return joined || undefined
}

export default function WillBeneficiariesPage() {
  const {
    beneficiaries,
    form,
    errors,
    canAdd,
    isAdding,
    setIsAdding,
    updateForm,
    addBeneficiary,
    removeBeneficiary,
    handleNext,
  } = useWillBeneficiaries()

  return (
    <div className="will-ben-page">
      <WillStepHeader currentStep={2} title="유가족 등록" />

      <div className="will-ben__content">
        <p className="will-ben__guide">
          영상 편지를 받을 유가족을 등록해 주세요.
          <br />
          사망 확인 후 등록된 연락처로 영상이 전달됩니다.
        </p>

        {/* 등록된 유가족 목록 */}
        {beneficiaries.length > 0 && (
          <ul className="will-ben__list" aria-label="등록된 유가족 목록">
            {beneficiaries.map((b) => (
              <li key={b.id} className="will-ben__card">
                <div className="will-ben__card-info">
                  <span className="will-ben__card-name">{b.name}</span>
                  <span className="will-ben__card-meta">
                    {[b.relationship, b.phone].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <button
                  type="button"
                  className="will-ben__card-remove"
                  onClick={() => removeBeneficiary(b.id)}
                  aria-label={`${b.name} 삭제`}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* 추가 폼 토글 */}
        <button
          type="button"
          className="will-ben__add-toggle"
          onClick={() => setIsAdding((v) => !v)}
          aria-expanded={isAdding}
        >
          <UserPlus size={20} aria-hidden="true" />
          유가족 추가
          {isAdding ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </button>

        {isAdding && (
          <div className="will-ben__form" role="group" aria-label="유가족 정보 입력">
            <div className="will-ben__field">
              <label className="will-ben__label" htmlFor="ben-name">이름 *</label>
              <input
                id="ben-name"
                type="text"
                className="will-ben__input"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="홍길동"
                autoComplete="name"
                required
                aria-required="true"
                aria-invalid={errors.name ? 'true' : 'false'}
                aria-describedby={describedBy(errors.name && 'ben-name-error')}
              />
              {errors.name && (
                <p id="ben-name-error" className="will-ben__field-error">{errors.name}</p>
              )}
            </div>

            <div className="will-ben__field">
              <label className="will-ben__label" htmlFor="ben-email">이메일 *</label>
              <input
                id="ben-email"
                type="email"
                className="will-ben__input"
                value={form.email}
                onChange={(e) => updateForm('email', e.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
                required
                aria-required="true"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={describedBy(errors.email && 'ben-email-error')}
              />
              {errors.email && (
                <p id="ben-email-error" className="will-ben__field-error">{errors.email}</p>
              )}
            </div>

            <div className="will-ben__field">
              <label className="will-ben__label" htmlFor="ben-phone">휴대폰 번호 *</label>
              <input
                id="ben-phone"
                type="tel"
                inputMode="tel"
                className="will-ben__input"
                value={form.phone}
                onChange={(e) => updateForm('phone', e.target.value)}
                placeholder="010-0000-0000"
                autoComplete="tel"
                required
                aria-required="true"
                aria-invalid={errors.phone ? 'true' : 'false'}
                aria-describedby={describedBy('ben-phone-hint', errors.phone && 'ben-phone-error')}
              />
              <p id="ben-phone-hint" className="will-ben__field-hint">
                열람 시 본인확인(뒤 4자리)에 사용됩니다
              </p>
              {errors.phone && (
                <p id="ben-phone-error" className="will-ben__field-error">{errors.phone}</p>
              )}
            </div>

            <div className="will-ben__field">
              <label className="will-ben__label" htmlFor="ben-rel">관계 *</label>
              <select
                id="ben-rel"
                className="will-ben__input"
                value={form.relationship}
                onChange={(e) => updateForm('relationship', e.target.value)}
                required
                aria-required="true"
                aria-invalid={errors.relationship ? 'true' : 'false'}
                aria-describedby={describedBy(errors.relationship && 'ben-rel-error')}
              >
                <option value="">선택</option>
                {RELATIONSHIP_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {errors.relationship && (
                <p id="ben-rel-error" className="will-ben__field-error">{errors.relationship}</p>
              )}
            </div>

            <button
              type="button"
              className="will-ben__add-btn"
              onClick={addBeneficiary}
              disabled={!canAdd}
            >
              추가 완료
            </button>
          </div>
        )}

        <button
          type="button"
          className="will-ben__next"
          onClick={handleNext}
          disabled={beneficiaries.length === 0}
          aria-disabled={beneficiaries.length === 0}
        >
          다음 - 음성 녹음
        </button>
      </div>
    </div>
  )
}
