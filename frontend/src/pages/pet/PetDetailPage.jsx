import { useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ChevronLeft,
  Camera,
  Sparkles,
  Heart,
  AlertTriangle,
} from 'lucide-react'
import { usePetDetail } from './usePetDetail.js'
import { PetProfileCard } from './PetCard.jsx'
import './PetDashboard.css'
import MemorialSettingsSection from './MemorialSettingsSection.jsx'
import './PetDetailPage.css'

export default function PetDetailPage() {
  const { petId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const {
    pet,
    media,
    isLoading,
    error,
    isUploading,
    uploadError,
    isStatusChanging,
    statusChangeError,
    isSavingMemorial,
    memorialSaveError,
    memorialAccessCode,
    handleMediaUpload,
    handleStatusChange,
    handleUpdateMemorialSettings,
  } = usePetDetail(petId)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleMediaUpload(file)
    e.target.value = ''
  }

  const confirmStatusChange = () => {
    const ok = window.confirm(`${pet.name}를 무지개다리로 등록하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)
    if (ok) handleStatusChange()
  }

  if (isLoading) {
    return (
      <main style={{ padding: 'var(--spacing-2xl)', textAlign: 'center' }}>
        <p role="status" aria-live="polite" style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-body)' }}>불러오는 중...</p>
      </main>
    )
  }

  if (error || !pet) {
    return (
      <main style={{ padding: 'var(--spacing-2xl)', textAlign: 'center' }}>
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)' }}>
          {error || '반려동물 정보를 찾을 수 없습니다.'}
        </p>
        <button
          onClick={() => navigate('/pet')}
          style={{
            marginTop: 'var(--spacing-lg)',
            background: 'var(--color-primary)',
            color: 'var(--color-surface)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            padding: '0 var(--spacing-xl)',
            minHeight: 'var(--size-button-h)',
            fontSize: 'var(--fs-button)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          목록으로
        </button>
      </main>
    )
  }

  return (
    <main className="pet-detail-page">
      {/* 뒤로가기 */}
      <button
        type="button"
        onClick={() => navigate('/pet')}
        aria-label="반려동물 목록으로"
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
        목록으로
      </button>

      {/* 프로필: 대시보드 '함께하는 아이들' 카드와 같은 모양(링크 없는 표시용) */}
      <PetProfileCard
        pet={pet}
        isMemorial={pet.pet_status === 'deceased'}
        aria-label={`${pet.name} 프로필`}
      />

      {/* 추모 페이지 링크 (deceased) - memorial 네이비 톤 */}
      {/* FIX: DEV-31 - 접근 코드 없이 /memorial/:slug 로만 이동하면 소유자 본인도 항상
          403이었다. 쿼리로 코드를 붙여 바로 열리게 한다. 코드 미설정 상태면 기존처럼
          코드 없이 이동한다(아래 설정 섹션에서 코드를 만들도록 유도).
          [FIX D17] pet.memorial_access_code가 더 이상 응답에 없으므로, usePetDetail이
          전용 엔드포인트로 따로 조회해 온 memorialAccessCode를 대신 쓴다. */}
      {pet.pet_status === 'deceased' && pet.memorial_slug && (
        <Link
          to={
            memorialAccessCode
              ? `/memorial/${pet.memorial_slug}?accessCode=${encodeURIComponent(memorialAccessCode)}`
              : `/memorial/${pet.memorial_slug}`
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--spacing-sm)',
            background: 'rgba(42, 58, 82, 0.08)',
            color: 'var(--color-memorial)',
            border: '1px solid rgba(42, 58, 82, 0.20)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--spacing-md)',
            minHeight: 'var(--size-button-h)',
            fontWeight: 700,
            fontSize: 'var(--fs-body)',
          }}
        >
          <Heart size={18} aria-hidden="true" />
          추모 페이지 보기
        </Link>
      )}

      {/* 추모 페이지 접근 코드 설정 (deceased) - DEV-30 */}
      {pet.pet_status === 'deceased' && (
        <MemorialSettingsSection
          pet={pet}
          currentAccessCode={memorialAccessCode}
          isSaving={isSavingMemorial}
          saveError={memorialSaveError}
          onSave={handleUpdateMemorialSettings}
        />
      )}

      {/* 미디어 그리드 */}
      <section aria-label="사진 목록">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          <h2 style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600, color: 'var(--color-primary)' }}>
            사진 ({media.length})
          </h2>

          <div className="pet-detail-media-actions">
            {/* AI 초상화 버튼 */}
            <button
              onClick={() => navigate(`/pet/${petId}/portrait`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                background: 'var(--color-pet-soft)',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-pet)',
                borderRadius: 'var(--radius-pill)',
                padding: '0 var(--spacing-md)',
                minHeight: 'var(--min-touch-target)',
                fontSize: 'var(--fs-caption)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background var(--transition-base)',
              }}
              aria-label="AI 초상화 만들기"
            >
              <Sparkles size={16} aria-hidden="true" />
              AI 초상화
            </button>

            {/* 사진 추가 버튼 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              aria-busy={isUploading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                background: 'var(--color-pet)',
                color: 'var(--color-surface)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                padding: '0 var(--spacing-md)',
                minHeight: 'var(--min-touch-target)',
                fontSize: 'var(--fs-caption)',
                fontWeight: 600,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                opacity: isUploading ? 0.7 : 1,
                transition: 'background var(--transition-base)',
              }}
            >
              <Camera size={16} aria-hidden="true" />
              {isUploading ? '업로드 중...' : '사진 추가'}
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-hidden="true"
        />

        {uploadError && (
          <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)', marginBottom: 'var(--spacing-md)' }}>
            {uploadError}
          </p>
        )}

        {media.length === 0 && !isUploading && (
          <div
            style={{
              border: '2px dashed var(--color-border-strong)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--spacing-2xl)',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--fs-body)',
              background: 'var(--color-surface-warm)',
            }}
          >
            <Camera size={32} style={{ margin: '0 auto var(--spacing-md)' }} aria-hidden="true" />
            <p>아직 등록된 사진이 없습니다.</p>
            <p>사진 추가 버튼으로 첫 사진을 올려 보세요.</p>
          </div>
        )}

        {/* 미디어 갤러리 — 모바일 2열, 태블릿 3열, 데스크톱 4열 */}
        {media.length > 0 && (
          <div className="pet-detail-media-grid">
            {media.map((item) => (
              <div
                key={item.media_id}
                style={{
                  aspectRatio: '1',
                  borderRadius: 'var(--radius-card)',
                  overflow: 'hidden',
                  background: 'var(--color-pet-soft)',
                  border: '1px solid var(--color-pet-soft)',
                  transition: 'transform var(--transition-base), border-color var(--transition-base)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)'
                  e.currentTarget.style.borderColor = 'var(--color-pet)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.borderColor = 'var(--color-pet-soft)'
                }}
              >
                <img
                  src={item.file_url}
                  alt={item.caption || `${pet.name} 사진`}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.onerror = null; e.target.style.display = 'none' }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 사망 등록 섹션 (alive 상태만) */}
      {pet.pet_status === 'alive' && (
        <section
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--spacing-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
            background: 'var(--color-surface)',
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-start' }}>
            <AlertTriangle size={18} color="var(--color-text-muted)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <div>
              <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, marginBottom: 4, color: 'var(--color-primary)' }}>무지개다리 등록</p>
              <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                {pet.name}가 무지개다리를 건넜다면 등록해 주세요.
                추모 페이지가 생성됩니다.
              </p>
            </div>
          </div>
          {statusChangeError && (
            <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)' }}>
              {statusChangeError}
            </p>
          )}
          <button
            onClick={confirmStatusChange}
            disabled={isStatusChanging}
            aria-busy={isStatusChanging}
            style={{
              background: 'none',
              color: 'var(--color-text-secondary)',
              border: '1.5px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-pill)',
              minHeight: 'var(--size-button-h)',
              fontSize: 'var(--fs-button)',
              fontWeight: 600,
              cursor: isStatusChanging ? 'not-allowed' : 'pointer',
              opacity: isStatusChanging ? 0.7 : 1,
            }}
          >
            {isStatusChanging ? '처리 중...' : '무지개다리 등록'}
          </button>
        </section>
      )}
    </main>
  )
}
