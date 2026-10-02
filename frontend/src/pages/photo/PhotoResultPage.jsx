import { Download, RefreshCw, Share2, Loader2, AlertCircle, DownloadCloud } from 'lucide-react'
import usePhotoResult from './usePhotoResult.js'
import './PhotoResultPage.css'

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

// 결과물 세트 카드 - 각 항목 개별 다운로드 (SPEC-08 3절: "세트 4종 개별 다운로드")
function ResultSetCard({ file, index, onDownload }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-sm)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--spacing-md)',
      }}
    >
      <p
        style={{
          fontSize: 'var(--fs-body)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          textAlign: 'center',
        }}
      >
        {file.variantLabel ?? `결과물 ${index + 1}`}
      </p>
      <img
        src={file.file_url}
        alt={file.variantLabel ?? `AI 보정 결과물 ${index + 1}`}
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
      <button
        onClick={() => onDownload(file.file_url, `ondam_${file.variantKey ?? index + 1}.jpg`)}
        style={{
          width: '100%',
          minHeight: 'var(--min-touch-target)',
          background: 'var(--color-photo)',
          color: 'var(--color-text-on-dark)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          fontSize: 'var(--fs-body)',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-sm)',
        }}
      >
        <Download size={18} />
        다운로드
      </button>
    </div>
  )
}

function PhotoResultPage() {
  const {
    rawFile,
    enhancedFiles,
    isPartialFailure,
    isLoading,
    isRetrying,
    error,
    retryError,
    handleDownload,
    handleDownloadAll,
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
        padding: '32px var(--spacing-md) 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xl)',
        background: 'var(--color-bg)',
      }}
    >
      <header>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, color: 'var(--color-photo)', marginBottom: 'var(--spacing-sm)', letterSpacing: 'var(--ls-heading-ko)' }}>
          처리 완료
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          {enhancedFiles.length > 0
            ? `AI가 사진을 성공적으로 복원했습니다. 결과물 ${enhancedFiles.length}장을 확인해 보세요.`
            : 'AI가 사진을 성공적으로 복원했습니다. 결과물을 확인해 보세요.'}
        </p>
      </header>

      {/* 부분 실패 안내 - SPEC-02 2절: 성공분은 제공, 전체는 전액 환불 대상 */}
      {isPartialFailure && (
        <section
          role="alert"
          style={{
            background: 'var(--color-error-light)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--spacing-md)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--spacing-sm)',
          }}
        >
          <AlertCircle size={22} color="var(--color-error)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-error)', lineHeight: 'var(--lh-relaxed)' }}>
            일부 결과물 생성에 실패했어요. 성공한 결과물은 아래에서 그대로 받으실 수 있고,
            결제하신 금액은 전액 환불해 드립니다. 문의사항은 전화로 연락해 주세요.
          </p>
        </section>
      )}

      {/* Before / After */}
      <section aria-label="원본과 보정본 비교">
        <h2 style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600, marginBottom: 20, color: 'var(--color-text-primary)' }}>
          Before / After
        </h2>
        <div className="photo-result__before-after">
          {rawFile ? (
            <PhotoImage src={rawFile.file_url} alt="원본 사진" label="Before" />
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

          {enhancedFiles[0] ? (
            <PhotoImage src={enhancedFiles[0].file_url} alt="AI 보정된 사진" label="After" />
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

      {/* 결과물 세트 - SPEC-08 3절: 세트 4종 개별 다운로드 + 전체 저장 */}
      {enhancedFiles.length > 0 && (
        <section aria-label="결과물 세트">
          <h2 style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600, marginBottom: 20, color: 'var(--color-text-primary)' }}>
            결과물 세트 ({enhancedFiles.length}장)
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 'var(--spacing-md)',
            }}
          >
            {enhancedFiles.map((file, idx) => (
              <ResultSetCard key={file.file_id ?? idx} file={file} index={idx} onDownload={handleDownload} />
            ))}
          </div>
        </section>
      )}

      {/* 재처리 에러 */}
      {retryError && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)' }}>
          {retryError}
        </p>
      )}

      {/* 액션 버튼 영역 */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* 전체 저장 - 항목이 2장 이상일 때만 노출 */}
        {enhancedFiles.length > 1 && (
          <button
            onClick={handleDownloadAll}
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
            <DownloadCloud size={22} />
            전체 저장 ({enhancedFiles.length}장)
          </button>
        )}

        {rawFile && (
          <button
            onClick={() => handleDownload(rawFile.file_url, 'ondam_original.jpg')}
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

