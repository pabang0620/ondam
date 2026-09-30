import { useRef, useCallback } from 'react'
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, ShieldCheck, RotateCcw } from 'lucide-react'
import { Button } from '../../components/common/Button.jsx'
import ConsentChecklist from '../../components/consent/ConsentChecklist.jsx'
import useGiftPerformPhoto from './useGiftPerformPhoto.js'

function GiftPerformPhotoPage() {
  const {
    STEP, step, photoType, previewUrl, isUploading, isSubmitting, completeWarning, error, isRefunded, photoTypes, canSubmit,
    consentItems, consents, allChecked, isSavingConsent,
    toggleConsentItem, toggleAllConsents, submitConsent,
    handleTypeSelect, handleFileUpload, handleSubmit,
  } = useGiftPerformPhoto()

  const fileInputRef = useRef(null)
  const onFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
  }, [handleFileUpload])

  // 결함C: 사진관 선물 수행 경로에 유일한 동의 접점 - 초상권·AI 생성물 동의
  if (step === STEP.CONSENT) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '32px var(--spacing-md) 48px', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
          <ShieldCheck size={40} color="var(--color-photo)" />
          <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700 }}>동의 확인</p>
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
            AI 사진 제작을 위해 아래 항목에 모두 동의해 주세요. 이 동의는 반드시
            본인이 직접 눌러주셔야 해요.
          </p>
          <div style={{ width: '100%', textAlign: 'left' }}>
            <ConsentChecklist
              items={consentItems}
              consents={consents}
              onToggleItem={toggleConsentItem}
              onToggleAll={toggleAllConsents}
              allChecked={allChecked}
              accentColor="--color-photo"
            />
          </div>
          {error && (
            <p role="alert" style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={16} /> {error}
            </p>
          )}
          <Button onClick={submitConsent} isLoading={isSavingConsent} disabled={!allChecked} fullWidth>
            동의하고 시작하기
          </Button>
        </div>
      </main>
    )
  }

  // FIX: 무한 폴링 결함 - 환불은 "오류"가 아니라 "처리하지 못해 결제를 취소했다"는
  // 정보다. 선물 경로는 결제자(자녀)와 이 화면을 보는 수행자(부모)가 다르므로,
  // 환불이 보내주신 분(결제자)께 처리됐고 수행자는 따로 할 일이 없다는 점을
  // 명확히 안내한다.
  if (isRefunded) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px var(--spacing-md)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
        <RotateCcw size={44} color="var(--color-warm-accent)" aria-hidden="true" />
        <p role="alert" style={{ fontSize: 'var(--fs-h3)', fontWeight: 700 }}>결제가 취소됐어요</p>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          죄송합니다. 사진을 만드는 데 문제가 있어 결제하신 금액을 선물을 보내주신
          분께 전액 환불해 드렸어요. 따로 하실 일은 없으니 걱정하지 않으셔도 괜찮아요.
        </p>
        <Button onClick={() => { window.location.href = '/my' }} fullWidth>마이페이지로 이동</Button>
      </main>
    )
  }

  if (step === STEP.PROCESSING) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px var(--spacing-md)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
        <Loader2 size={40} color="var(--color-photo)" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700 }}>사진을 만들고 있어요</p>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          잠시만 기다려 주세요. 완성될 때까지 이 화면을 열어 두세요.
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    )
  }

  if (step === STEP.POLL_FAILED) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px var(--spacing-md)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
        <AlertCircle size={44} color="var(--color-warm-accent)" aria-hidden="true" />
        <p role="alert" style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-primary)', lineHeight: 'var(--lh-relaxed)' }}>{error}</p>
        <Button onClick={() => window.location.reload()} fullWidth>새로고침</Button>
      </main>
    )
  }

  if (step === STEP.DONE) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px var(--spacing-md)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
        <CheckCircle2 size={44} color="var(--color-photo)" />
        <p style={{ fontSize: 'var(--fs-h2)', fontWeight: 800 }}>사진이 완성됐어요!</p>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          수고하셨어요. 마이페이지에서 언제든 다시 보실 수 있어요.
        </p>
        {completeWarning && (
          <p role="alert" style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-primary)', background: 'var(--color-surface-warm)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 'var(--spacing-md)', lineHeight: 'var(--lh-relaxed)' }}>
            {completeWarning}
          </p>
        )}
        <Button onClick={() => { window.location.href = '/my' }} fullWidth>결과물 보러가기</Button>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '32px var(--spacing-md) 48px', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      <header>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 800, color: 'var(--color-photo)', marginBottom: 'var(--spacing-sm)' }}>사진 올리기</h1>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          종류를 고르고 사진 한 장을 올려주세요. 결과물 4종을 만들어 드려요.
        </p>
      </header>

      <section>
        <p style={{ fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>1. 사진 종류 선택</p>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          {photoTypes.map(({ type, label }) => {
            const isSelected = photoType === type
            return (
              <button
                key={type}
                type="button"
                aria-pressed={isSelected}
                disabled={isSubmitting}
                onClick={() => handleTypeSelect(type)}
                style={{
                  height: 'var(--size-button-h)', minHeight: 'var(--min-touch-target)', padding: '0 var(--spacing-lg)',
                  borderRadius: 'var(--radius-pill)',
                  border: `2px solid ${isSelected ? 'var(--color-photo)' : 'var(--color-border)'}`,
                  background: isSelected ? 'var(--color-photo)' : 'var(--color-surface)',
                  color: isSelected ? 'var(--color-text-on-dark)' : 'var(--color-text-primary)',
                  fontWeight: isSelected ? 700 : 400, cursor: 'pointer',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <p style={{ fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>2. 사진 업로드</p>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" style={{ display: 'none' }} onChange={onFileChange} />
        {previewUrl ? (
          <div style={{ position: 'relative' }}>
            <img src={previewUrl} alt="업로드된 사진 미리보기" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }} />
            {!isUploading && (
              <button onClick={() => fileInputRef.current?.click()} style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0 14px', minHeight: 'var(--min-touch-target)' }}>
                사진 교체
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ width: '100%', minHeight: 200, border: '2px dashed var(--color-border-strong)', borderRadius: 'var(--radius-card)', background: 'var(--color-bg)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)', color: 'var(--color-text-muted)' }}
          >
            <UploadCloud size={40} color="var(--color-photo)" />
            <span style={{ fontWeight: 600 }}>{isUploading ? '업로드 중...' : '눌러서 사진 선택'}</span>
          </button>
        )}
      </section>

      {error && (
        <p role="alert" style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={16} /> {error}
        </p>
      )}

      <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={!canSubmit} fullWidth>완료</Button>
    </main>
  )
}

export default GiftPerformPhotoPage
