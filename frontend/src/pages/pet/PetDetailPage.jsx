import { useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ChevronLeft,
  PawPrint,
  Camera,
  Sparkles,
  Heart,
  AlertTriangle,
} from 'lucide-react'
import { usePetDetail } from './usePetDetail.js'

const SPECIES_LABEL = {
  dog: '강아지', cat: '고양이', rabbit: '토끼',
  bird: '새', hamster: '햄스터', fish: '물고기',
  reptile: '파충류', other: '기타',
}

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

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
    handleMediaUpload,
    handleStatusChange,
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
        <p role="status" aria-live="polite" style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-base)' }}>불러오는 중...</p>
      </main>
    )
  }

  if (error || !pet) {
    return (
      <main style={{ padding: 'var(--spacing-2xl)', textAlign: 'center' }}>
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-base)' }}>
          {error || '반려동물 정보를 찾을 수 없습니다.'}
        </p>
        <button
          onClick={() => navigate('/pet')}
          style={{
            marginTop: 'var(--spacing-lg)',
            background: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            padding: '0 var(--spacing-xl)',
            minHeight: 'var(--min-touch-target)',
            fontSize: 'var(--font-size-base)',
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
    <main
      style={{
        maxWidth: 600,
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
        onClick={() => navigate('/pet')}
        aria-label="반려동물 목록으로"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          background: 'none',
          border: 'none',
          color: 'var(--color-primary)',
          fontSize: 'var(--font-size-base)',
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

      {/* 프로필 카드 */}
      <section
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-xl)',
          display: 'flex',
          gap: 'var(--spacing-lg)',
          alignItems: 'center',
        }}
        aria-label={`${pet.name} 프로필`}
      >
        {/* 아바타 */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {pet.profile_image_url
            ? (
              <img
                src={pet.profile_image_url}
                alt={pet.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.onerror = null; e.target.src = '' }}
              />
            )
            : <PawPrint size={36} color="var(--color-primary)" aria-hidden="true" />}
        </div>

        {/* 정보 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800 }}>{pet.name}</h1>
            {pet.pet_status === 'deceased' && (
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  background: 'var(--color-accent)',
                  color: 'var(--color-primary-dark)',
                  padding: '2px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 600,
                }}
              >
                무지개다리
              </span>
            )}
          </div>
          <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
            {SPECIES_LABEL[pet.species] || pet.species}
            {pet.breed ? ` · ${pet.breed}` : ''}
          </p>
          {pet.birth_date && (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              {formatDate(pet.birth_date)}
              {pet.death_date ? ` ~ ${formatDate(pet.death_date)}` : ''}
            </p>
          )}
        </div>
      </section>

      {/* 추모 페이지 링크 (deceased) */}
      {pet.pet_status === 'deceased' && pet.memorial_slug && (
        <Link
          to={`/memorial/${pet.memorial_slug}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--spacing-sm)',
            background: 'var(--color-accent)',
            color: 'var(--color-primary-dark)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-md)',
            minHeight: 'var(--min-touch-target)',
            fontWeight: 700,
            fontSize: 'var(--font-size-base)',
          }}
        >
          <Heart size={18} aria-hidden="true" />
          추모 페이지 보기
        </Link>
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
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
            사진 ({media.length})
          </h2>

          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            {/* AI 초상화 */}
            <button
              onClick={() => navigate(`/pet/${petId}/portrait`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                background: 'var(--color-accent)',
                color: 'var(--color-primary-dark)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                padding: '0 var(--spacing-md)',
                minHeight: 'var(--min-touch-target)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              aria-label="AI 초상화 만들기"
            >
              <Sparkles size={16} aria-hidden="true" />
              AI 초상화
            </button>

            {/* 사진 추가 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              aria-busy={isUploading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                padding: '0 var(--spacing-md)',
                minHeight: 'var(--min-touch-target)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                opacity: isUploading ? 0.7 : 1,
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
          <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-md)' }}>
            {uploadError}
          </p>
        )}

        {media.length === 0 && !isUploading && (
          <div
            style={{
              border: '2px dashed var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-2xl)',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-base)',
            }}
          >
            <Camera size={32} style={{ margin: '0 auto var(--spacing-md)' }} aria-hidden="true" />
            <p>아직 등록된 사진이 없습니다.</p>
            <p>사진 추가 버튼으로 첫 사진을 올려 보세요.</p>
          </div>
        )}

        {media.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 'var(--spacing-sm)',
            }}
          >
            {media.map((item) => (
              <div
                key={item.media_id}
                style={{
                  aspectRatio: '1',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  background: 'var(--color-accent)',
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

      {/* 사망 등록 버튼 (alive 상태만) */}
      {pet.pet_status === 'alive' && (
        <section
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-start' }}>
            <AlertTriangle size={18} color="var(--color-text-muted)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <div>
              <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 4 }}>무지개다리 등록</p>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                {pet.name}가 무지개다리를 건넜다면 등록해 주세요.
                추모 페이지가 생성됩니다.
              </p>
            </div>
          </div>
          <button
            onClick={confirmStatusChange}
            disabled={isStatusChanging}
            aria-busy={isStatusChanging}
            style={{
              background: 'none',
              color: 'var(--color-text-secondary)',
              border: '1.5px solid var(--color-border)',
              borderRadius: 'var(--radius-full)',
              minHeight: 'var(--min-touch-target)',
              fontSize: 'var(--font-size-base)',
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
