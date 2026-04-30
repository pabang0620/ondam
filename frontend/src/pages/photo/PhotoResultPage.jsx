import { Download, RefreshCw, Share2, Loader2, AlertCircle } from 'lucide-react'
import usePhotoResult from './usePhotoResult.js'

function PhotoImage({ src, alt, label }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      <p
        style={{
          fontSize: 'var(--fs-caption)',
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </p>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={(e) => {
          e.target.onerror = null
          e.target.style.display = 'none'
        }}
        style={{
          width: '100%',
          aspectRatio: '3 / 4',
          objectFit: 'cover',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-alt)',
        }}
      />
    </div>
  )
}

function PhotoResultPage() {
  const {
    rawFile,
    enhancedFile,
    isLoading,
    isRetrying,
    error,
    handleDownload,
    handleRetry,
    handleShare,
  } = usePhotoResult()

  if (isLoading) {
    return (
      <main
        style={{
          maxWidth: 600,
          margin: '0 auto',
          padding: 'var(--spacing-xl) var(--spacing-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-lg)',
        }}
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label="결과 불러오는 중"
      >
        <Loader2 size={48} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" />
        <p style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-secondary)' }}>결과를 불러오는 중...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    )
  }

  if (error) {
    return (
      <main
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: 'var(--spacing-xl) var(--spacing-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-lg)',
          textAlign: 'center',
        }}
      >
        <AlertCircle size={56} color="var(--color-error)" aria-hidden="true" />
        <p role="alert" style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-error)', fontWeight: 700 }}>
          {error}
        </p>
      </main>
    )
  }

  return (
    <main
      style={{
        maxWidth: 700,
        margin: '0 auto',
        padding: 'var(--spacing-xl) var(--spacing-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xl)',
        background: 'var(--color-bg)',
      }}
    >
      <header>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 800, color: 'var(--color-photo)', marginBottom: 'var(--spacing-sm)', letterSpacing: 'var(--ls-heading-ko)' }}>
          처리 완료
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          AI가 사진을 성공적으로 복원했습니다. 결과물을 확인해 보세요.
        </p>
      </header>

      {/* Before / After */}
      <section aria-label="원본과 보정본 비교">
        <h2 style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
          Before / After
        </h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          {rawFile ? (
            <PhotoImage src={rawFile.fileUrl} alt="원본 사진" label="Before" />
          ) : (
            <div
              style={{
                flex: 1,
                aspectRatio: '3 / 4',
                background: 'var(--color-bg-alt)',
                border: '1px dashed var(--color-border-strong)',
                borderRadius: 'var(--radius-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--fs-caption)',
              }}
            >
              원본 없음
            </div>
          )}

          {enhancedFile ? (
            <PhotoImage src={enhancedFile.fileUrl} alt="AI 보정된 사진" label="After" />
          ) : (
            <div
              style={{
                flex: 1,
                aspectRatio: '3 / 4',
                background: 'var(--color-bg-alt)',
                border: '1px dashed var(--color-border-strong)',
                borderRadius: 'var(--radius-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--fs-caption)',
              }}
            >
              보정본 없음
            </div>
          )}
        </div>
      </section>

      {/* 액션 버튼 영역 */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-sm)',
        }}
      >
        {/* 다운로드 */}
        {enhancedFile && (
          <button
            onClick={() => handleDownload(enhancedFile.fileUrl, 'ondam_enhanced.jpg')}
            style={{
              width: '100%',
              height: 'var(--size-button-h)',
              minHeight: 'var(--size-button-h)',
              background: 'var(--color-photo)',
              color: 'var(--color-text-on-dark)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              fontSize: 'var(--fs-button)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-sm)',
              transition: 'opacity var(--transition-base)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <Download size={22} />
            보정본 다운로드
          </button>
        )}

        {rawFile && (
          <button
            onClick={() => handleDownload(rawFile.fileUrl, 'ondam_original.jpg')}
            style={{
              width: '100%',
              height: 'var(--size-button-h)',
              minHeight: 'var(--size-button-h)',
              background: 'var(--color-surface)',
              color: 'var(--color-photo)',
              border: '2px solid var(--color-photo)',
              borderRadius: 'var(--radius-pill)',
              fontSize: 'var(--fs-body)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-sm)',
              transition: 'background-color var(--transition-base)',
            }}
          >
            <Download size={18} />
            원본 다운로드
          </button>
        )}

        {/* 공유 */}
        <button
          onClick={handleShare}
          style={{
            width: '100%',
            height: 'var(--size-button-h)',
            minHeight: 'var(--size-button-h)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-pill)',
            fontSize: 'var(--fs-body)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--spacing-sm)',
          }}
        >
          <Share2 size={18} />
          공유하기
        </button>

        {/* 재처리 */}
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          aria-disabled={isRetrying}
          aria-busy={isRetrying}
          style={{
            width: '100%',
            minHeight: 'var(--min-touch-target)',
            background: 'transparent',
            color: isRetrying ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            fontSize: 'var(--fs-body)',
            cursor: isRetrying ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--spacing-sm)',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          {isRetrying ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              재처리 중...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              다시 처리 요청 (1회 무료)
            </>
          )}
        </button>
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}

export default PhotoResultPage
