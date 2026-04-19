import { Download, RefreshCw, Share2, Loader2, AlertCircle } from 'lucide-react'
import usePhotoResult from './usePhotoResult.js'

function PhotoImage({ src, alt, label }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      <p
        style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 700,
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
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
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          background: '#f5f5f5',
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
      }}
    >
      <header>
        <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: 'var(--spacing-sm)' }}>
          처리 완료
        </p>
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
          AI가 사진을 성공적으로 복원했습니다. 결과물을 확인해 보세요.
        </p>
      </header>

      {/* Before / After */}
      <section aria-label="원본과 보정본 비교">
        <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>
          Before / After
        </p>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          {rawFile ? (
            <PhotoImage src={rawFile.fileUrl} alt="원본 사진" label="원본" />
          ) : (
            <div
              style={{
                flex: 1,
                aspectRatio: '3 / 4',
                background: 'var(--color-background)',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              원본 없음
            </div>
          )}

          {enhancedFile ? (
            <PhotoImage src={enhancedFile.fileUrl} alt="AI 보정된 사진" label="보정본" />
          ) : (
            <div
              style={{
                flex: 1,
                aspectRatio: '3 / 4',
                background: 'var(--color-background)',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--font-size-sm)',
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
              minHeight: 'var(--min-touch-target)',
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-sm)',
            }}
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
              minHeight: 'var(--min-touch-target)',
              background: 'var(--color-surface)',
              color: 'var(--color-primary)',
              border: '2px solid var(--color-primary)',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-size-base)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-sm)',
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
            minHeight: 'var(--min-touch-target)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--font-size-base)',
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
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--font-size-base)',
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
