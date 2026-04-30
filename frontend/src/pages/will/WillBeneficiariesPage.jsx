import { useWillBeneficiaries } from './useWillBeneficiaries.js'
import { UserPlus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import WillStepHeader from './WillStepHeader.jsx'
import './WillBeneficiariesPage.css'

const RELATIONSHIP_OPTIONS = ['배우자', '자녀', '부모', '형제/자매', '친척', '친구', '기타']

export default function WillBeneficiariesPage() {
  const {
    beneficiaries,
    form,
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
          유언 영상을 받을 유가족을 등록해 주세요.
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
                    {b.relationship} · {b.phone}
                  </span>
                  {b.message && (
                    <span className="will-ben__card-msg">&ldquo;{b.message}&rdquo;</span>
                  )}
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
              />
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
              />
            </div>

            <div className="will-ben__field">
              <label className="will-ben__label" htmlFor="ben-phone">연락처 *</label>
              <input
                id="ben-phone"
                type="tel"
                className="will-ben__input"
                value={form.phone}
                onChange={(e) => updateForm('phone', e.target.value)}
                placeholder="010-0000-0000"
                autoComplete="tel"
                required
                aria-required="true"
              />
            </div>

            <div className="will-ben__field">
              <label className="will-ben__label" htmlFor="ben-rel">관계</label>
              <select
                id="ben-rel"
                className="will-ben__input"
                value={form.relationship}
                onChange={(e) => updateForm('relationship', e.target.value)}
              >
                <option value="">선택</option>
                {RELATIONSHIP_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="will-ben__field">
              <label className="will-ben__label" htmlFor="ben-msg">개인 메시지</label>
              <textarea
                id="ben-msg"
                className="will-ben__textarea"
                value={form.message}
                onChange={(e) => updateForm('message', e.target.value)}
                placeholder="이 분께만 전하고 싶은 말을 적어주세요."
                rows={3}
              />
            </div>

            <button
              type="button"
              className="will-ben__add-btn"
              onClick={addBeneficiary}
              disabled={!form.name.trim() || !form.email.trim() || !form.phone.trim()}
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
