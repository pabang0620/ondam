import { useEffect, useRef } from 'react'
import { useWillBeneficiaries } from './useWillBeneficiaries.js'
import { UserPlus, Trash2 } from 'lucide-react'
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

  const canAdd = Boolean(form.name.trim() && form.email.trim() && form.phone.trim())
  const showForm = beneficiaries.length === 0 || isAdding

  const nameInputRef = useRef(null)
  const moreBtnRef = useRef(null)
  // 카드가 열리거나 닫힌 직후 포커스를 옮길 대상 ('name' | 'more' | null)
  const focusTargetRef = useRef(null)

  useEffect(() => {
    const target = focusTargetRef.current
    focusTargetRef.current = null
    if (target === 'name') nameInputRef.current?.focus()
    if (target === 'more') moreBtnRef.current?.focus()
  }, [showForm])

  const handleAdd = () => {
    if (!canAdd) return
    focusTargetRef.current = 'more'
    addBeneficiary()
  }

  const handleOpenForm = () => {
    focusTargetRef.current = 'name'
    setIsAdding(true)
  }

  const handleCancel = () => {
    focusTargetRef.current = 'more'
    setIsAdding(false)
  }

  return (
    <div className="will-ben-page">
      <WillStepHeader
        currentStep={2}
        title="유가족 등록"
        onNext={handleNext}
        nextDisabled={beneficiaries.length === 0}
      />

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

        {!showForm && (
          <button
            ref={moreBtnRef}
            type="button"
            className="will-ben__more"
            onClick={handleOpenForm}
          >
            <UserPlus size={20} aria-hidden="true" />
            다른 유가족 추가
          </button>
        )}

        {showForm && (
          <div className="will-ben__form" role="group" aria-label="유가족 정보 입력">
            <div className="will-ben__field">
              <label className="will-ben__label" htmlFor="ben-name">이름 *</label>
              <input
                id="ben-name"
                ref={nameInputRef}
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
              onClick={handleAdd}
              disabled={!canAdd}
              aria-disabled={!canAdd}
            >
              <UserPlus size={20} aria-hidden="true" />
              유가족 추가
            </button>

            {beneficiaries.length > 0 && (
              <button type="button" className="will-ben__cancel" onClick={handleCancel}>
                취소
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          className="will-ben__next"
          onClick={handleNext}
          disabled={beneficiaries.length === 0}
          aria-disabled={beneficiaries.length === 0}
        >
          <span className="will-ben__next-sub">유가족 {beneficiaries.length}명 등록</span>
          <span className="will-ben__next-main">다음 - 음성 녹음</span>
        </button>
      </div>
    </div>
  )
}
