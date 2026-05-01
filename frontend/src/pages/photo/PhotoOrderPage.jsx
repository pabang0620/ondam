import { useRef, useCallback } from 'react'
import { UploadCloud, ImageIcon, Loader2 } from 'lucide-react'
import usePhotoOrder from './usePhotoOrder.js'
import './PhotoOrderPage.css'

const PHOTO_TYPES = [
  { type: 'funeral', label: '장례 사진', desc: '고인의 영정 사진을 단정하게 보정합니다' },
  { type: 'id', label: '증명 사진', desc: '증명사진 규격에 맞게 배경·복장을 정리합니다' },
  { type: 'job', label: '취업 사진', desc: '취업용 사진을 깔끔하고 전문적으로 만듭니다' },
  { type: 'enhance', label: '화질 복원', desc: '흐릿하고 손상된 사진을 선명하게 복원합니다' },
  { type: 'colorize', label: '흑백 컬러', desc: '흑백 사진에 자연스러운 색채를 입혀 드립니다' },
  { type: 'restore', label: '사진 복원', desc: '긁히거나 낡은 사진을 원본에 가깝게 복원합니다' },
  { type: 'removebg', label: '배경 제거', desc: '배경을 깔끔하게 제거하고 투명 배경으로 저장합니다' },
  { type: 'portrait', label: 'AI 초상화', desc: 'AI로 예술적인 인물 초상화를 생성합니다' },
  { type: 'casual', label: '캐주얼 보정', desc: '자연스럽고 생기있는 일상 사진으로 보정합니다' },
]

function PhotoOrderPage() {
  const {
    selectedType,
    previewUrl,
    isUploading,
    isSubmitting,
    error,
    canSubmit,
    photoTypeLabels,
    handleTypeSelect,
    handleFileUpload,
    handleSubmit,
  } = usePhotoOrder()

  const fileInputRef = useRef(null)

  const onFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0]
      if (file) handleFileUpload(file)
    },
    [handleFileUpload],
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      const file = e.dataTransfer.files?.[0]
      if (file) handleFileUpload(file)
    },
    [handleFileUpload],
  )

  const onDragOver = useCallback((e) => {
    e.preventDefault()
  }, [])

  const openFilePicker = () => fileInputRef.current?.click()

  return (
    <main className="photo-order-page">
      <header>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 800, color: 'var(--color-photo)', marginBottom: 'var(--spacing-sm)', letterSpacing: 'var(--ls-heading-ko)' }}>
          AI 사진관 주문
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          사진 종류를 선택하고 원본 사진을 업로드해 주세요.
        </p>
      </header>

      {/* 사진 타입 탭 */}
      <section>
        <p style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
          1. 사진 종류 선택
        </p>
        <div className="photo-type-tabs" style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          {PHOTO_TYPES.map(({ type, label }) => {
            const isSelected = selectedType === type
            return (
              <button
                key={type}
                onClick={() => handleTypeSelect(type)}
                style={{
                  height: 'var(--size-button-h)',
                  minHeight: 'var(--size-button-h)',
                  padding: '0 var(--spacing-lg)',
                  borderRadius: 'var(--radius-pill)',
                  border: `2px solid ${isSelected ? 'var(--color-photo)' : 'var(--color-border)'}`,
                  background: isSelected ? 'var(--color-photo)' : 'var(--color-surface)',
                  color: isSelected ? 'var(--color-text-on-dark)' : 'var(--color-text-primary)',
                  fontSize: 'var(--fs-button)',
                  fontWeight: isSelected ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'border-color var(--transition-base), background-color var(--transition-base), color var(--transition-base)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      {/* 파일 업로드 */}
      <section>
        <p style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
          2. 사진 업로드
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />

        {previewUrl ? (
          <div style={{ position: 'relative' }}>
            <img
              src={previewUrl}
              alt="업로드된 사진 미리보기"
              onError={(e) => {
                e.target.onerror = null
                e.target.src = ''
              }}
              style={{
                width: '100%',
                maxHeight: 360,
                objectFit: 'contain',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-alt)',
              }}
            />
            {isUploading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.45)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--spacing-sm)',
                  color: '#fff',
                }}
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2 size={32} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 'var(--font-size-base)' }}>업로드 중...</span>
              </div>
            )}
            {!isUploading && (
              <button
                onClick={openFilePicker}
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 12,
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '0 14px',
                  fontSize: 'var(--font-size-base)',
                  cursor: 'pointer',
                  minHeight: 'var(--min-touch-target)',
                }}
              >
                사진 교체
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={openFilePicker}
            onDrop={onDrop}
            onDragOver={onDragOver}
            style={{
              width: '100%',
              minHeight: 200,
              border: '2px dashed var(--color-border-strong)',
              borderRadius: 'var(--radius-card)',
              background: 'var(--color-bg)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-sm)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--fs-body)',
              transition: 'border-color var(--transition-base), background-color var(--transition-base)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-photo)'
              e.currentTarget.style.backgroundColor = 'var(--color-bg-alt)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-strong)'
              e.currentTarget.style.backgroundColor = 'var(--color-bg)'
            }}
            aria-label="사진 업로드 영역, 클릭 또는 드래그"
          >
            <UploadCloud size={40} color="var(--color-photo)" />
            <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 'var(--fs-body-lg)' }}>
              클릭하거나 사진을 끌어다 놓으세요
            </span>
            <span style={{ fontSize: 'var(--fs-caption)' }}>JPG, PNG, WEBP, HEIC · 최대 20MB</span>
          </button>
        )}
      </section>

      {/* 선택 요약 */}
      {selectedType && (
        <section
          style={{
            background: 'var(--color-surface-warm)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--spacing-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
          }}
        >
          <ImageIcon size={18} color="var(--color-photo)" />
          <span style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-primary)', fontWeight: 600 }}>
            선택된 종류: {photoTypeLabels[selectedType]}
          </span>
        </section>
      )}

      {/* 에러 */}
      {error && (
        <p
          role="alert"
          style={{
            color: 'var(--color-error)',
            fontSize: 'var(--fs-body)',
            background: 'var(--color-error-light)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--spacing-md)',
          }}
        >
          {error}
        </p>
      )}

      {/* 다음 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        aria-disabled={!canSubmit}
        aria-busy={isSubmitting}
        style={{
          width: '100%',
          height: 'var(--size-button-h)',
          minHeight: 'var(--size-button-h)',
          background: canSubmit ? 'var(--color-photo)' : 'var(--color-border)',
          color: canSubmit ? 'var(--color-text-on-dark)' : 'var(--color-text-muted)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          fontSize: 'var(--fs-button)',
          fontWeight: 700,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-sm)',
          transition: 'background-color var(--transition-base)',
        }}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            처리 중...
          </>
        ) : (
          '다음: 결제'
        )}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}

export default PhotoOrderPage
