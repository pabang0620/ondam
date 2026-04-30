import React from 'react'

export function LoadingSpinner({ size = 40, label = '로딩 중...' }) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-xl)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          border: `3px solid var(--color-border)`,
          borderTopColor: 'var(--color-warm-accent)',
          borderRadius: '50%',
          animation: 'spinner-spin 0.7s linear infinite',
        }}
      />
      <span
        style={{
          fontSize: 'var(--fs-caption)',
          color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </span>
      <style>{`
        @keyframes spinner-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default LoadingSpinner
