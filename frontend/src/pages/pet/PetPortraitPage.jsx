import { useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Sparkles, CheckCircle, Info, Palette, Droplets, PenTool, ImagePlus, Loader2 } from 'lucide-react'
import { usePetPortrait } from './usePetPortrait.js'
import { ROUTES } from '../../constants/routes.js'
import './PetPortraitPage.css'

// 스타일 key -> 의미가 맞는 아이콘 (유화=팔레트, 수채화=물방울, 일러스트=펜툴)
const STYLE_ICONS = {
  oil: Palette,
  watercolor: Droplets,
  illustration: PenTool,
}

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
    isUploading,
    uploadError,
    handleMediaUpload,
  } = usePetPortrait(petId)
  const fileInputRef = useRef(null)
  const photos = media.filter((m) => m.media_type === 'photo')

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleMediaUpload(file)
    e.target.value = ''
  }

  // quota를 아직 못 불러왔으면(null) 매수를 알 수 없으므로 생성 버튼을 켜지 않는다
  const hasRemaining = quota != null && quota.remaining > 0
  const canGenerate = Boolean(selectedStyle) && Boolean(selectedMediaId) && !isGenerating && !isUploading && hasRemaining

  // 버튼이 비활성인 이유(선택 누락)를 안내 문구 앞에 붙인다. 둘 다 선택했으면 null.
  let selectionHint = null
  if (!selectedStyle && !selectedMediaId) selectionHint = '스타일과 사진을 고르면 만들 수 있어요'
  else if (!selectedStyle) selectionHint = '스타일을 골라 주세요'
  else if (!selectedMediaId) selectionHint = '사진을 골라 주세요'

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

      <header className="pet-portrait-header">
        <h1>AI 초상화 만들기</h1>
        <p>원하는 스타일과 사진을 선택하면 AI가 멋진 초상화를 만들어 드립니다.</p>
      </header>

      {/* 남은 매수 안내 */}
      {quotaError && (
        <p role="alert" className="pet-portrait-error">{quotaError}</p>
      )}
      {!quotaError && quota != null && (
        <section
          role="status"
          aria-live="polite"
          className={`pet-portrait-notice${quota.remaining === 0 ? ' is-empty' : ''}`}
        >
          <Info size={20} className="pet-portrait-notice-icon" aria-hidden="true" />
          <div className="pet-portrait-notice-body">
            <p>
              {quota.remaining === 0 ? (
                quota.isSubscribed ? (
                  <>이번 달 남은 AI 초상화: <strong className="pet-portrait-notice-count">{quota.remaining}장</strong> (총 {quota.limit}장)</>
                ) : (
                  <>무료 체험 AI 초상화: <strong className="pet-portrait-notice-count">{quota.remaining}장</strong> 남음</>
                )
              ) : (
                <>
                  {selectionHint && <>{selectionHint} · </>}
                  {quota.isSubscribed ? '이번 달 ' : '무료 체험 '}
                  <strong className="pet-portrait-notice-count">{quota.remaining}장</strong>
                  {selectionHint ? ' 남았어요' : ' 더 만들 수 있어요'}
                </>
              )}
            </p>
            {quota.isSubscribed && quota.remaining === 0 && quota.resetsAt && (
              <p>
                {new Date(quota.resetsAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}에 다시 3장이 채워져요.
              </p>
            )}
            {!quota.isSubscribed && quota.remaining === 0 && (
              <p>
                무료 체험을 이미 사용하셨습니다. 구독하시면 매달 3장의 AI 초상화를 만들 수 있어요.{' '}
                <Link to={ROUTES.PET} className="pet-portrait-notice-link">
                  구독 안내 보기
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      {/* 완성 결과 */}
      {result && (
        <section
          style={{
            background: 'var(--color-bg-subtle)',
            border: '2px solid var(--color-photo)',
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
            type="button"
            onClick={() => navigate(`/pet/${petId}`)}
            className="pet-portrait-result-btn"
          >
            반려동물 페이지로
          </button>
        </section>
      )}

      {/* 스타일 선택 + 사진 선택 */}
      {!result && (
        <>
          {/* AI 초상화 스타일 선택: 3열 1:1:1 카드 그리드 */}
          <section>
            <h2 className="pet-portrait-step-title">
              1. 스타일 선택
            </h2>
            <div
              className="pet-portrait-style-grid"
              role="radiogroup"
              aria-label="초상화 스타일"
            >
              {styles.map((style) => {
                const isSelected = selectedStyle === style.key
                const StyleIcon = STYLE_ICONS[style.key] ?? Sparkles
                return (
                  <button
                    key={style.key}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedStyle(style.key)}
                    className={`pet-portrait-style-card${isSelected ? ' is-selected' : ''}`}
                  >
                    <StyleIcon
                      className={`pet-portrait-style-icon pet-portrait-style-icon--${style.key}`}
                      aria-hidden="true"
                    />
                    <span className="pet-portrait-style-label">{style.label}</span>
                    <span className="pet-portrait-style-desc">{style.desc}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* 사진 선택 */}
          <section className="pet-portrait-step-photo">
            <h2 className="pet-portrait-step-title">
              2. 사진 선택
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
                  // FIX: 결함4 - fetchMedia가 signal 파라미터를 받게 되면서 onClick={refetchMedia}
                  // 직결 시 클릭 이벤트 객체가 signal 자리로 전달돼 요청이 깨진다.
                  onClick={() => refetchMedia()}
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

            {!isLoading && !mediaError && photos.length === 0 && (
              <p className="pet-portrait-photo-empty">
                등록된 사진이 없습니다. 아래 &apos;사진 추가&apos;로 사진을 올려 주세요.
              </p>
            )}

            {!isLoading && !mediaError && (
              <div
                className="pet-portrait-photo-grid"
                role="radiogroup"
                aria-label="초상화 기준 사진"
              >
                {photos.map((item) => {
                  const isSelected = selectedMediaId === item.media_id
                  return (
                    <button
                      key={item.media_id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedMediaId(item.media_id)}
                      className={`pet-portrait-photo-item${isSelected ? ' is-selected' : ''}`}
                    >
                      <img
                        src={item.file_url}
                        alt={item.caption || '선택 가능한 사진'}
                        loading="lazy"
                        onError={(e) => { e.target.onerror = null; e.target.style.display = 'none' }}
                      />
                      {isSelected && (
                        <span className="pet-portrait-photo-check" aria-hidden="true">
                          <CheckCircle size={14} color="var(--color-text-on-dark)" />
                        </span>
                      )}
                    </button>
                  )
                })}
                {/* 새 사진 추가 타일 (반려동물 상세의 업로드와 동일 경로 재사용) */}
                <button
                  type="button"
                  className="pet-portrait-photo-add"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  aria-busy={isUploading}
                >
                  {isUploading ? (
                    <Loader2 size={24} className="pet-portrait-spin" aria-hidden="true" />
                  ) : (
                    <ImagePlus size={24} aria-hidden="true" />
                  )}
                  <span>{isUploading ? '업로드 중...' : '사진 추가'}</span>
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="pet-portrait-file-input"
              tabIndex={-1}
              aria-hidden="true"
            />

            {uploadError && (
              <p role="alert" className="pet-portrait-error pet-portrait-upload-error">
                {uploadError}
              </p>
            )}
          </section>

          {/* 에러 */}
          {generateError && (
            <p role="alert" className="pet-portrait-error">
              {generateError}
            </p>
          )}

          {/* 생성 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            aria-busy={isGenerating}
            className="pet-portrait-submit"
          >
            <Sparkles size={20} aria-hidden="true" />
            {isGenerating ? 'AI 초상화 생성 중...' : 'AI 초상화 생성'}
          </button>
        </>
      )}
    </main>
  )
}
