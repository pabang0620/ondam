import { useRef, useCallback } from 'react'
import { UploadCloud, ImageIcon, Loader2 } from 'lucide-react'
import usePhotoOrder from './usePhotoOrder.js'

const PHOTO_TYPES = [
  { type: 'funeral', label: '장례 사진' },
  { type: 'id', label: '증명 사진' },
  { type: 'job', label: '취업 사진' },
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
      <header>
        <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: 'var(--spacing-sm)' }}>
          AI 사진관 주문
        </p>
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
          사진 종류를 선택하고 원본 사진을 업로드해 주세요.
        </p>
      </header>

      {/* 사진 타입 탭 */}
      <section>
        <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>
          1. 사진 종류 선택
        </p>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          {PHOTO_TYPES.map(({ type, label }) => {
            const isSelected = selectedType === type
            return (
              <button
                key={type}
                onClick={() => handleTypeSelect(type)}
                style={{
                  minHeight: 'var(--min-touch-target)',
                  padding: '0 var(--spacing-lg)',
                  borderRadius: 'var(--radius-full)',
                  border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: isSelected ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: isSelected ? '#fff' : 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: isSelected ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
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
        <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>
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
                borderRadius: 'var(--radius-lg)',
                border: '2px solid var(--color-border)',
                background: '#f5f5f5',
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
              border: '2px dashed var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-background)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-sm)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-base)',
              transition: 'border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)'
              e.currentTarget.style.background = 'var(--color-accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
              e.currentTarget.style.background = 'var(--color-background)'
            }}
            aria-label="사진 업로드 영역, 클릭 또는 드래그"
          >
            <UploadCloud size={40} color="var(--color-primary-light)" />
            <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              클릭하거나 사진을 끌어다 놓으세요
            </span>
            <span style={{ fontSize: 'var(--font-size-sm)' }}>JPG, PNG, WEBP, HEIC · 최대 20MB</span>
          </button>
        )}
      </section>

      {/* 선택 요약 */}
      {selectedType && (
        <section
          style={{
            background: 'var(--color-accent)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
          }}
        >
          <ImageIcon size={18} color="var(--color-primary)" />
          <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary-dark)', fontWeight: 600 }}>
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
            fontSize: 'var(--font-size-base)',
            background: '#fff5f5',
            border: '1px solid #fed7d7',
            borderRadius: 'var(--radius-md)',
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
          minHeight: 'var(--min-touch-target)',
          background: canSubmit ? 'var(--color-primary)' : 'var(--color-border)',
          color: canSubmit ? '#fff' : 'var(--color-text-muted)',
          border: 'none',
          borderRadius: 'var(--radius-full)',
          fontSize: 'var(--font-size-lg)',
          fontWeight: 700,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-sm)',
          transition: 'background 0.2s',
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
