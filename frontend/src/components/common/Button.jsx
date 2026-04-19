import React from 'react'

const VARIANT_STYLES = {
  primary: {
    backgroundColor: 'var(--color-primary)',
    color: '#FFFFFF',
    border: 'none',
  },
  secondary: {
    backgroundColor: 'transparent',
    color: 'var(--color-primary)',
    border: '2px solid var(--color-primary)',
  },
  danger: {
    backgroundColor: 'var(--color-error)',
    color: '#FFFFFF',
    border: 'none',
  },
}

export function Button({
  children,
  variant = 'primary',
  isLoading = false,
  disabled = false,
  type = 'button',
  onClick,
  style,
  className,
  ...rest
}) {
  const isDisabled = disabled || isLoading

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-sm)',
    minHeight: 'var(--min-touch-target)',
    minWidth: '120px',
    padding: '0 var(--spacing-lg)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1,
    transition: 'opacity 0.15s ease, background-color 0.15s ease',
    ...VARIANT_STYLES[variant],
    ...style,
  }

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      style={baseStyle}
      aria-busy={isLoading}
      aria-disabled={isDisabled}
      className={className}
      {...rest}
    >
      {isLoading ? (
        <>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 16,
              height: 16,
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'btn-spin 0.6s linear infinite',
            }}
          />
          <span>처리 중...</span>
        </>
      ) : (
        children
      )}
      <style>{`
        @keyframes btn-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  )
}

export default Button
