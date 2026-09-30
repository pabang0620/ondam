import { useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { Heart, PawPrint } from 'lucide-react'
import { useMemorial } from './useMemorial.js'
import './MemorialPage.css'

function formatYear(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).getFullYear()
}

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function MemorialPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  // FIX: DEV-30 - 링크에 ?accessCode=가 실려 오면 그 값으로 바로 조회한다.
  const initialAccessCode = searchParams.get('accessCode') || ''
  const { pet, media, isLoading, isRetrying, error, retryWithAccessCode } = useMemorial(slug, initialAccessCode)

  const [codeInput, setCodeInput] = useState('')
  const [emptyCodeError, setEmptyCodeError] = useState(false)

  const handleCodeSubmit = async (e) => {
    e.preventDefault()
    if (isRetrying) return
    const code = codeInput.trim()
    // FIX: 빈 입력은 아무 반응 없이 무시하지 않고 안내한다
    if (!code) {
      setEmptyCodeError(true)
      return
    }
    setEmptyCodeError(false)
    await retryWithAccessCode(code)
  }

  if (isLoading) {
    return (
      <main className="memorial-page">
        <div className="memorial-loading" role="status" aria-live="polite">
          불러오는 중...
        </div>
      </main>
    )
  }

  if (error || !pet) {
    return (
      <main className="memorial-page">
        <div className="memorial-error">
          <p role="alert">{error || '추모 페이지를 찾을 수 없습니다.'}</p>

          {/* FIX: DEV-30 - 링크 없이 코드만 전달받은 가족을 위한 수동 입력 폴백 */}
          <form
            onSubmit={handleCodeSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', width: '100%', maxWidth: 320 }}
          >
            <label htmlFor="memorial-access-code" style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>
              가족에게 받은 접근 코드가 있다면 입력해 주세요
            </label>
            <input
              id="memorial-access-code"
              type="text"
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value)
                if (emptyCodeError) setEmptyCodeError(false)
              }}
              // 코드는 대소문자·철자 그대로 비교되므로 자동 대문자/교정을 끈다
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              aria-invalid={emptyCodeError}
              aria-describedby={emptyCodeError ? 'memorial-access-code-empty' : undefined}
              style={{
                minHeight: 'var(--size-input-h)',
                fontSize: 'var(--fs-body)',
                padding: '0 var(--spacing-md)',
                border: '1.5px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
              }}
            />
            {emptyCodeError && (
              <p id="memorial-access-code-empty" role="alert" style={{ fontSize: 'var(--fs-body)', color: 'var(--color-error)' }}>
                접근 코드를 입력한 뒤 &quot;확인하기&quot;를 눌러 주세요.
              </p>
            )}
            <button
              type="submit"
              disabled={isRetrying}
              aria-busy={isRetrying}
              style={{
                minHeight: 'var(--size-button-h)',
                fontSize: 'var(--fs-button)',
                fontWeight: 700,
                background: 'var(--color-memorial)',
                color: 'var(--color-text-on-dark)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                cursor: isRetrying ? 'not-allowed' : 'pointer',
              }}
            >
              {isRetrying ? '확인 중...' : '확인하기'}
            </button>
          </form>

          <Link to="/" className="memorial-home-link">온담 홈으로</Link>
        </div>
      </main>
    )
  }

  const birthYear = formatYear(pet.birthDate)
  const deathYear = formatYear(pet.deathDate)
  const lifespan = birthYear && deathYear
    ? `${birthYear} ~ ${deathYear}`
    : birthYear
      ? `${birthYear} ~`
      : null

  return (
    <main className="memorial-page" aria-label={`${pet.name} 추모 페이지`}>
      {/* 헤더 */}
      <header className="memorial-header">
        <div className="memorial-header__avatar">
          {pet.profileImageUrl
            ? (
              <img
                src={pet.profileImageUrl}
                alt={pet.name}
                className="memorial-header__avatar-img"
                onError={(e) => { e.target.onerror = null; e.target.src = '' }}
              />
            )
            : <PawPrint size={52} color="var(--color-text-on-dark)" aria-hidden="true" />}
        </div>

        <div className="memorial-header__info">
          <h1 className="memorial-header__name">{pet.name}</h1>
          {lifespan && (
            <p className="memorial-header__lifespan">{lifespan}</p>
          )}
          {pet.breed && (
            <p className="memorial-header__breed">{pet.breed}</p>
          )}
        </div>

        <div className="memorial-header__message">
          <Heart size={20} color="var(--color-warm-accent-soft)" aria-hidden="true" />
          <p>영원히 기억할게요</p>
        </div>
      </header>

      {/* 생몰년도 상세 */}
      {(pet.birthDate || pet.deathDate) && (
        <section className="memorial-dates">
          {pet.birthDate && (
            <div className="memorial-dates__item">
              <span className="memorial-dates__label">태어난 날</span>
              <span className="memorial-dates__value">{formatDate(pet.birthDate)}</span>
            </div>
          )}
          {pet.deathDate && (
            <div className="memorial-dates__item">
              <span className="memorial-dates__label">무지개다리</span>
              <span className="memorial-dates__value">{formatDate(pet.deathDate)}</span>
            </div>
          )}
        </section>
      )}

      {/* 사진 갤러리 */}
      {media.length > 0 && (
        <section className="memorial-gallery" aria-label="추억 갤러리">
          <h2 className="memorial-gallery__title">함께한 순간들</h2>
          <div className="memorial-gallery__grid">
            {media.map((item) => (
              <div key={item.mediaId} className="memorial-gallery__item">
                <img
                  src={item.url}
                  alt={item.caption || `${pet.name}의 사진`}
                  loading="lazy"
                  className="memorial-gallery__img"
                  onError={(e) => { e.target.onerror = null; e.target.style.display = 'none' }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 추모 메시지 */}
      <section className="memorial-tribute">
        <p className="memorial-tribute__text">
          {pet.name}는 영원히 우리 마음속에 살아있습니다.
        </p>
        <p className="memorial-tribute__sub">
          함께했던 모든 순간이 소중한 기억으로 남아 있습니다.
        </p>
      </section>

      {/* 온담 링크 */}
      <footer className="memorial-footer">
        <Link to="/" className="memorial-footer__link">
          온담에서 반려동물의 기억을 간직하세요
        </Link>
      </footer>
    </main>
  )
}
