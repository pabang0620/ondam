import { Loader2, AlertCircle } from 'lucide-react'
import usePhotoProcessing from './usePhotoProcessing.js'

const STATUS_LABELS = {
  queued: '처리 대기 중...',
  running: 'AI가 사진을 처리하고 있습니다...',
  completed: '처리 완료!',
  failed: '처리 실패',
}

function PhotoProcessingPage() {
  const { status, progress, error } = usePhotoProcessing()

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
        <p
          role="alert"
          style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-error)' }}
        >
          오류 발생
        </p>
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
          {error}
        </p>
      </main>
    )
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: 'var(--spacing-xl) var(--spacing-md)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--spacing-xl)',
        textAlign: 'center',
      }}
    >
      {/* 스피너 */}
      <div
        aria-live="polite"
        aria-busy={status !== 'completed' && status !== 'failed'}
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          background: 'var(--color-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader2
          size={48}
          color="var(--color-primary)"
          style={{ animation: 'spin 1.2s linear infinite' }}
          aria-hidden="true"
        />
      </div>

      {/* 상태 텍스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
          {STATUS_LABELS[status] ?? 'AI가 사진을 처리하고 있습니다...'}
        </p>
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
          잠시 기다려 주세요. 완료되면 자동으로 결과 화면으로 이동합니다.
        </p>
      </div>

      {/* 진행 바 */}
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div
          style={{
            height: 12,
            background: 'var(--color-border)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="처리 진행률"
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--color-primary)',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.5s ease',
            }}
          />
        </div>
        <p
          style={{
            marginTop: 'var(--spacing-sm)',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 700,
            color: 'var(--color-primary)',
          }}
        >
          {progress}%
        </p>
      </div>

      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
        평균 처리 시간은 1~3분입니다.
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}

export default PhotoProcessingPage
