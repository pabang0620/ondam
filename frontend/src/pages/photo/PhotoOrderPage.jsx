import { useRef, useCallback } from 'react'
import { UploadCloud, ImageIcon, Loader2 } from 'lucide-react'
import usePhotoOrder from './usePhotoOrder.js'
import ConsentChecklist from '../../components/consent/ConsentChecklist.jsx'
import './PhotoOrderPage.css'

// FIX: 결정1(2026-08-22) - 사용자는 "용도" 1개만 고른다(SPEC-08 1절 "선택지를
// 늘리지 않는다"). 용도를 고르면 시스템이 그에 맞는 결과물 세트(4종)를 전부
// 자동 생성하므로, 화질복원/컬러화/배경제거 등을 개별 처리 옵션처럼 보여주는
// 탭은 제거했다(이 옵션들은 photo_orders.photo_type ENUM에는 남아있지만
// usePhotoOrder.js의 PHOTO_TYPE_LABELS도 이미 이 3종만 정의하고 있었다).
const PHOTO_TYPES = [
  { type: 'funeral', label: '장례 사진', desc: '고인의 영정 사진을 단정하게 보정하고, 정장 합성·증명 규격본 등 결과물 4종을 드립니다' },
  { type: 'id', label: '증명 사진', desc: '증명사진 규격에 맞게 배경·복장을 정리하고, 결과물 4종을 드립니다' },
  { type: 'job', label: '취업 사진', desc: '취업용 사진을 깔끔하고 전문적으로 만들고, 결과물 4종을 드립니다' },
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
    consentItems,
    consents,
    allChecked,
    toggleConsentItem,
    toggleAllConsents,
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
      <header className="photo-order-header">
        <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, color: 'var(--color-photo)', marginBottom: 'var(--spacing-sm)', letterSpacing: 'var(--ls-heading-ko)' }}>
          AI 사진관 주문
        </h1>
        <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          용도를 선택하고 원본 사진을 업로드해 주세요. 사진 1장으로 결과물 4종을 만들어 드려요.
        </p>
      </header>

      {/* 사진 타입 탭 */}
      <section>
        <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
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
                  fontSize: 'var(--fs-body)',
                  fontWeight: isSelected ? 600 : 400,
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
        <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
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
                <span style={{ fontSize: 'var(--fs-caption)' }}>업로드 중...</span>
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
                  fontSize: 'var(--fs-caption)',
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
              background: 'var(--color-bg-subtle)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-sm)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--fs-caption)',
              transition: 'border-color var(--transition-base), background-color var(--transition-base)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-photo)'
              e.currentTarget.style.backgroundColor = 'var(--color-bg-alt)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-strong)'
              e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'
            }}
            aria-label="사진 업로드 영역, 클릭 또는 드래그"
          >
            <UploadCloud size={40} color="var(--color-photo)" />
            <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 'var(--fs-body)' }}>
              클릭하거나 사진을 끌어다 놓으세요
            </span>
            {/* FIX: 결함5 - 20MB 용량 제한은 파일 선택창(accept)이 걸러주지 못해
                (브라우저가 파일 크기로 필터링할 수 없음) 이 문구를 못 읽으면 업로드가
                실패로 끝난 뒤에야 알게 된다. 행동(파일 선택) 전에 읽어야 하는
                정보지만, 2026-10 글자 크기 축소 피드백으로 --fs-caption(14px, 하한)으로 낮춘다. */}
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
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-primary)', fontWeight: 600 }}>
            선택된 종류: {photoTypeLabels[selectedType]}
          </span>
        </section>
      )}

      {/* 동의 확인 - 결함C: 영정/증명/취업 사진 모두 업로드된 얼굴을 AI로 합성·보정하므로
          초상권·AI 생성물 동의 없이 처리하지 않는다 */}
      <section>
        <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
          3. 동의 확인
        </p>
        <ConsentChecklist
          items={consentItems}
          consents={consents}
          onToggleItem={toggleConsentItem}
          onToggleAll={toggleAllConsents}
          allChecked={allChecked}
          accentColor="--color-photo"
        />
      </section>

      {/* 에러 */}
      {error && (
        <p
          role="alert"
          style={{
            color: 'var(--color-error)',
            fontSize: 'var(--fs-caption)',
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
          fontSize: 'var(--fs-body)',
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
