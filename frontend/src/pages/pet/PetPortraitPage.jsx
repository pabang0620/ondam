import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Sparkles, CheckCircle } from 'lucide-react'
import { usePetPortrait } from './usePetPortrait.js'
import { ROUTES } from '../../constants/routes.js'
import './PetPortraitPage.css'

export default function PetPortraitPage() {
  const { petId } = useParams()
  const navigate = useNavigate()
  const {
    media,
    isLoading,
    mediaError,
    refetchMedia,
    styles,
    selectedStyle,
    setSelectedStyle,
    selectedMediaId,
    setSelectedMediaId,
    isGenerating,
    generateError,
    result,
    handleGenerate,
    quota,
    quotaError,
  } = usePetPortrait(petId)

  // quota를 아직 못 불러왔으면(null) 매수를 알 수 없으므로 생성 버튼을 켜지 않는다
  const hasRemaining = quota != null && quota.remaining > 0
  const canGenerate = selectedStyle && selectedMediaId && !isGenerating && hasRemaining

  return (
    <main className="pet-portrait-page">
      {/* 뒤로가기 */}
      <button
        type="button"
        onClick={() => navigate(`/pet/${petId}`)}
        aria-label="반려동물 정보 페이지로"
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
      >
        <ChevronLeft size={20} aria-hidden="true" />
        반려동물 정보로
      </button>

      <div>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: 'var(--ls-heading-ko)' }}>
          AI 초상화 만들기
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-sm)' }}>
          원하는 스타일과 사진을 선택하면 AI가 멋진 초상화를 만들어 드립니다.
        </p>
      </div>

      {/* 남은 매수 안내 */}
      {quotaError && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)' }}>{quotaError}</p>
      )}
      {!quotaError && quota != null && (
        <section
          role="status"
          aria-live="polite"
          style={{
            background: hasRemaining ? 'var(--color-pet-soft)' : 'var(--color-surface-warm)',
            border: `1px solid ${hasRemaining ? 'var(--color-pet)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-card)',
            padding: 'var(--spacing-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
          }}
        >
          <p style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--color-primary)' }}>
            {quota.isSubscribed
              ? `이번 달 남은 AI 초상화: ${quota.remaining}장 (총 ${quota.limit}장)`
              : `무료 체험 AI 초상화: ${quota.remaining}장 남음`}
          </p>
          {quota.isSubscribed && quota.remaining === 0 && quota.resetsAt && (
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>
              {new Date(quota.resetsAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}에 다시 3장이 채워져요.
            </p>
          )}
          {!quota.isSubscribed && quota.remaining === 0 && (
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>
              무료 체험을 이미 사용하셨습니다. 구독하시면 매달 3장의 AI 초상화를 만들 수 있어요.{' '}
              <Link to={ROUTES.PET_SUBSCRIPTION} style={{ color: 'var(--color-pet)', fontWeight: 700 }}>
                구독 안내 보기
              </Link>
            </p>
          )}
        </section>
      )}

      {/* 완성 결과 */}
      {result && (
        <section
          style={{
            background: 'var(--color-pet-soft)',
            border: '2px solid var(--color-pet)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-xl)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
          }}
          role="status"
          aria-live="polite"
        >
          <CheckCircle size={36} color="var(--color-success)" style={{ margin: '0 auto' }} aria-hidden="true" />
          <p style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>
            AI 초상화가 생성되었습니다!
          </p>
          {result.url && (
            <img
              src={result.url}
              alt="AI 초상화"
              loading="lazy"
              style={{
                width: '100%',
                maxWidth: 320,
                borderRadius: 'var(--radius-card)',
                margin: '0 auto',
                objectFit: 'cover',
              }}
            />
          )}
          <button
            onClick={() => navigate(`/pet/${petId}`)}
            style={{
              background: 'var(--color-pet)',
              color: 'var(--color-surface)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              minHeight: 'var(--size-button-h)',
              fontSize: 'var(--fs-button)',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background var(--transition-base)',
            }}
          >
            반려동물 페이지로
          </button>
        </section>
      )}

      {/* 스타일 선택 + 사진 선택 */}
      {!result && (
        <>
          {/* AI 초상화 스타일 선택: 카드 그리드, 선택 시 border 2px var(--color-pet) */}
          <section>
            <h2 style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, marginBottom: 'var(--spacing-md)', color: 'var(--color-primary)' }}>
              스타일 선택
            </h2>
            <div
              className="pet-portrait-style-grid"
              role="radiogroup"
              aria-label="초상화 스타일"
            >
              {styles.map((style) => {
                const isSelected = selectedStyle === style.key
                return (
                  <button
                    key={style.key}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedStyle(style.key)}
                    style={{
                      background: isSelected ? 'var(--color-pet-soft)' : 'var(--color-surface)',
                      border: `${isSelected ? '2px' : '1px'} solid ${isSelected ? 'var(--color-pet)' : 'var(--color-border)'}`,
                      borderRadius: 'var(--radius-card)',
                      padding: 'var(--spacing-lg)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      minHeight: 'var(--min-touch-target)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      transition: 'border-color var(--transition-base), background var(--transition-base)',
                    }}
                  >
                    <Sparkles
                      size={24}
                      color={isSelected ? 'var(--color-pet)' : 'var(--color-text-muted)'}
                      aria-hidden="true"
                    />
                    <p style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--color-primary)' }}>{style.label}</p>
                    <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      {style.desc}
                    </p>
                  </button>
                )
              })}
            </div>
          </section>

          {/* 사진 선택 */}
          <section>
            <h2 style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, marginBottom: 'var(--spacing-md)', color: 'var(--color-primary)' }}>
              사진 선택
            </h2>

            {isLoading && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-body)' }}>불러오는 중...</p>
            )}

            {/* FIX: DEV-27 - 조회 실패를 "등록된 사진 없음"과 구분해서 보여준다 (G2-2) */}
            {!isLoading && mediaError && (
              <div
                role="alert"
                style={{
                  border: '1px solid var(--color-error-muted)',
                  borderRadius: 'var(--radius-card)',
                  padding: 'var(--spacing-lg)',
                  textAlign: 'center',
                  color: 'var(--color-error)',
                  fontSize: 'var(--fs-body)',
                  background: 'var(--color-error-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-sm)',
                }}
              >
                <p>{mediaError}</p>
                <button
                  type="button"
                  onClick={refetchMedia}
                  style={{
                    alignSelf: 'center',
                    background: 'none',
                    border: '1.5px solid var(--color-error-muted)',
                    borderRadius: 'var(--radius-pill)',
                    color: 'var(--color-error)',
                    fontSize: 'var(--fs-body)',
                    fontWeight: 600,
                    minHeight: 'var(--min-touch-target)',
                    padding: '0 var(--spacing-lg)',
                    cursor: 'pointer',
                  }}
                >
                  다시 시도
                </button>
              </div>
            )}

            {!isLoading && !mediaError && media.length === 0 && (
              <div
                style={{
                  border: '2px dashed var(--color-border-strong)',
                  borderRadius: 'var(--radius-card)',
                  padding: 'var(--spacing-xl)',
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--fs-body)',
                  background: 'var(--color-surface-warm)',
                }}
              >
                <p>등록된 사진이 없습니다.</p>
                <p>반려동물 페이지에서 먼저 사진을 업로드해 주세요.</p>
              </div>
            )}

            {!isLoading && !mediaError && media.length > 0 && (
              <div
                className="pet-portrait-photo-grid"
                role="radiogroup"
                aria-label="초상화 기준 사진"
              >
                {media.filter((m) => m.media_type === 'photo').map((item) => {
                  const isSelected = selectedMediaId === item.media_id
                  return (
                    <button
                      key={item.media_id}
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedMediaId(item.media_id)}
                      style={{
                        border: `${isSelected ? '3px' : '2px'} solid ${isSelected ? 'var(--color-pet)' : 'transparent'}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: 0,
                        cursor: 'pointer',
                        aspectRatio: '1',
                        overflow: 'hidden',
                        background: 'var(--color-pet-soft)',
                        position: 'relative',
                        transition: 'border-color var(--transition-base)',
                      }}
                    >
                      <img
                        src={item.file_url}
                        alt={item.caption || '선택 가능한 사진'}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.onerror = null; e.target.style.display = 'none' }}
                      />
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            background: 'var(--color-pet)',
                            borderRadius: '50%',
                            width: 22,
                            height: 22,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          aria-hidden="true"
                        >
                          <CheckCircle size={14} color="var(--color-surface)" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* 에러 */}
          {generateError && (
            <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)' }}>
              {generateError}
            </p>
          )}

          {/* 생성 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            aria-busy={isGenerating}
            style={{
              background: canGenerate ? 'var(--color-pet)' : 'var(--color-text-muted)',
              color: 'var(--color-surface)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              minHeight: 'var(--size-button-h)',
              fontSize: 'var(--fs-button)',
              fontWeight: 700,
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-sm)',
              transition: 'background var(--transition-base)',
            }}
          >
            <Sparkles size={20} aria-hidden="true" />
            {isGenerating ? 'AI 초상화 생성 중...' : 'AI 초상화 생성'}
          </button>
        </>
      )}
    </main>
  )
}
