import { useParams, Link } from 'react-router-dom'
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
  const { pet, media, isLoading, error } = useMemorial(slug)

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
            : <PawPrint size={52} color="var(--color-primary)" aria-hidden="true" />}
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
          <Heart size={20} color="var(--color-primary)" aria-hidden="true" />
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
        <Heart size={28} color="var(--color-primary)" aria-hidden="true" />
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
