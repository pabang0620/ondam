import { Link, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'
import { SPECIES_LABEL } from './PetCard.jsx'
import { usePetEdit } from './usePetEdit.js'
import { BREED_MAX, NAME_MAX } from './petEditForm.js'
import './PetEditPage.css'

function FieldError({ id, message }) {
  if (!message) return null
  return <span id={id} role="alert" className="pet-edit__error">{message}</span>
}

function BackLink() {
  return (
    <Link to={ROUTES.PET} className="pet-edit__back">
      <ChevronLeft size={20} aria-hidden="true" />
      내 반려동물
    </Link>
  )
}

function StatusView({ children }) {
  return (
    <main className="pet-edit pet-edit--status">
      <BackLink />
      {children}
    </main>
  )
}

export default function PetEditPage() {
  const { petId } = useParams()
  const {
    pet, form, today, errors, isLoading, loadError,
    isSubmitting, submitError, handleChange, handleSubmit, reload,
  } = usePetEdit(petId)

  if (isLoading) {
    return (
      <StatusView>
        <p role="status" className="pet-edit__message">불러오는 중...</p>
      </StatusView>
    )
  }

  if (loadError || !form) {
    // 403/404 는 다시 시도해도 같으므로 재시도 버튼은 그 외 오류에만 둔다
    const retryable = ![403, 404].includes(loadError?.status)
    return (
      <StatusView>
        <p role="alert" className="pet-edit__message pet-edit__message--error">
          {loadError?.message}
        </p>
        {retryable && (
          <button type="button" className="pet-edit__btn pet-edit__btn--secondary" onClick={reload}>
            다시 시도
          </button>
        )}
      </StatusView>
    )
  }

  const speciesLabel = SPECIES_LABEL[pet.species] ?? pet.species ?? SPECIES_LABEL.other

  return (
    <main className="pet-edit">
      <BackLink />
      <h1 className="pet-edit__title">반려동물 정보 수정</h1>

      <form onSubmit={handleSubmit} noValidate className="pet-edit__form">
        <div className="pet-edit__field">
          <label htmlFor="pet-edit-name" className="pet-edit__label">
            이름 <span className="pet-edit__required" aria-hidden="true">*</span>
          </label>
          <input
            id="pet-edit-name"
            type="text"
            className="pet-edit__input"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            maxLength={NAME_MAX}
            autoComplete="off"
            required
            aria-required="true"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'pet-edit-name-error' : undefined}
          />
          <FieldError id="pet-edit-name-error" message={errors.name} />
        </div>

        <div className="pet-edit__field">
          <label htmlFor="pet-edit-species" className="pet-edit__label">종류</label>
          <input
            id="pet-edit-species"
            type="text"
            className="pet-edit__input pet-edit__input--readonly"
            value={speciesLabel}
            readOnly
            aria-describedby="pet-edit-species-note"
          />
          <span id="pet-edit-species-note" className="pet-edit__hint">종류는 바꿀 수 없어요.</span>
        </div>

        <div className="pet-edit__field">
          <label htmlFor="pet-edit-breed" className="pet-edit__label">품종</label>
          <input
            id="pet-edit-breed"
            type="text"
            className="pet-edit__input"
            value={form.breed}
            onChange={(e) => handleChange('breed', e.target.value)}
            maxLength={BREED_MAX}
            autoComplete="off"
            aria-invalid={Boolean(errors.breed)}
            aria-describedby={errors.breed ? 'pet-edit-breed-error' : undefined}
          />
          <FieldError id="pet-edit-breed-error" message={errors.breed} />
        </div>

        <div className="pet-edit__field">
          <label htmlFor="pet-edit-birth" className="pet-edit__label">생년월일</label>
          <input
            id="pet-edit-birth"
            type="date"
            className="pet-edit__input"
            value={form.birthDate}
            onChange={(e) => handleChange('birthDate', e.target.value)}
            max={today}
            aria-invalid={Boolean(errors.birthDate)}
            aria-describedby={errors.birthDate ? 'pet-edit-birth-error' : undefined}
          />
          <FieldError id="pet-edit-birth-error" message={errors.birthDate} />
        </div>

        {submitError && (
          <p role="alert" className="pet-edit__submit-error">{submitError}</p>
        )}

        <div className="pet-edit__actions">
          <button
            type="submit"
            className="pet-edit__btn pet-edit__btn--primary"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? '저장 중...' : '저장하기'}
          </button>
          <Link to={ROUTES.PET} className="pet-edit__btn pet-edit__btn--secondary">취소</Link>
        </div>
      </form>
    </main>
  )
}
