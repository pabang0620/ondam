import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { usePetNew } from './usePetNew.js'

const SPECIES_OPTIONS = [
  { value: 'dog', label: '강아지' },
  { value: 'cat', label: '고양이' },
  { value: 'rabbit', label: '토끼' },
  { value: 'bird', label: '새' },
  { value: 'hamster', label: '햄스터' },
  { value: 'fish', label: '물고기' },
  { value: 'reptile', label: '파충류' },
  { value: 'other', label: '기타' },
]

const fieldStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-xs)',
}

const labelStyle = {
  fontSize: 'var(--fs-body)',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
}

const inputStyle = (hasError) => ({
  border: `1.5px solid ${hasError ? 'var(--color-error)' : 'var(--color-border-strong)'}`,
  borderRadius: 'var(--radius-sm)',
  padding: '0 var(--spacing-md)',
  minHeight: 'var(--size-input-h)',
  fontSize: 'var(--fs-body)',
  width: '100%',
  outline: 'none',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  transition: 'border-color var(--transition-fast)',
})

const errorStyle = {
  fontSize: 'var(--fs-caption)',
  color: 'var(--color-error)',
}

function FieldError({ id, message }) {
  if (!message) return null
  return <span id={id} role="alert" style={errorStyle}>{message}</span>
}

export default function PetNewPage() {
  const navigate = useNavigate()
  const { form, errors, isSubmitting, submitError, handleChange, handleSubmit } = usePetNew()

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: 'var(--spacing-xl) var(--spacing-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xl)',
      }}
    >
      {/* 뒤로가기 */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          background: 'none',
          border: 'none',
          color: 'var(--color-primary)',
          fontSize: 'var(--fs-body)',
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          minHeight: 'var(--min-touch-target)',
          alignSelf: 'flex-start',
        }}
        aria-label="이전 페이지로"
      >
        <ChevronLeft size={20} aria-hidden="true" />
        뒤로
      </button>

      <div>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: 'var(--ls-heading-ko)' }}>
          반려동물 등록
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-sm)' }}>
          소중한 반려동물 정보를 입력해 주세요.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        {/* 이름 */}
        <div style={fieldStyle}>
          <label htmlFor="pet-name" style={labelStyle}>
            이름 <span style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <input
            id="pet-name"
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="반려동물 이름"
            style={inputStyle(!!errors.name)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
            aria-required="true"
            required
            autoComplete="off"
            maxLength={30}
          />
          <FieldError id="name-error" message={errors.name} />
        </div>

        {/* 종류 */}
        <div style={fieldStyle}>
          <label htmlFor="pet-species" style={labelStyle}>
            종류 <span style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <select
            id="pet-species"
            value={form.species}
            onChange={(e) => handleChange('species', e.target.value)}
            style={{ ...inputStyle(!!errors.species), padding: '0 var(--spacing-md)' }}
            aria-invalid={!!errors.species}
            aria-describedby={errors.species ? 'species-error' : undefined}
            aria-required="true"
            required
          >
            <option value="">종류를 선택해 주세요</option>
            {SPECIES_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <FieldError id="species-error" message={errors.species} />
        </div>

        {/* 품종 */}
        <div style={fieldStyle}>
          <label htmlFor="pet-breed" style={labelStyle}>품종</label>
          <input
            id="pet-breed"
            type="text"
            value={form.breed}
            onChange={(e) => handleChange('breed', e.target.value)}
            placeholder="예: 말티즈, 페르시안 (선택)"
            style={inputStyle(false)}
            maxLength={50}
          />
        </div>

        {/* 생년월일 */}
        <div style={fieldStyle}>
          <label htmlFor="pet-birth" style={labelStyle}>생년월일</label>
          <input
            id="pet-birth"
            type="date"
            value={form.birthDate}
            onChange={(e) => handleChange('birthDate', e.target.value)}
            style={inputStyle(false)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* 사망일 */}
        <div style={fieldStyle}>
          <label htmlFor="pet-death" style={labelStyle}>무지개다리 날짜</label>
          <input
            id="pet-death"
            type="date"
            value={form.deathDate}
            onChange={(e) => handleChange('deathDate', e.target.value)}
            style={inputStyle(false)}
            max={new Date().toISOString().split('T')[0]}
          />
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}>
            이미 무지개다리를 건넌 경우에만 입력해 주세요.
          </span>
        </div>

        {/* 제출 에러 */}
        {submitError && (
          <p role="alert" style={{ fontSize: 'var(--fs-body)', color: 'var(--color-error)' }}>
            {submitError}
          </p>
        )}

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          style={{
            background: isSubmitting ? 'var(--color-text-muted)' : 'var(--color-pet)',
            color: 'var(--color-surface)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            minHeight: 'var(--size-button-h)',
            fontSize: 'var(--fs-button)',
            fontWeight: 700,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            transition: 'background var(--transition-base)',
            width: '100%',
          }}
        >
          {isSubmitting ? '등록 중...' : '등록하기'}
        </button>
      </form>
    </main>
  )
}
