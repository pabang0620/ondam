import React from 'react'

const VARIANT_STYLES = {
  primary: {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-text-on-dark)',
    border: 'none',
  },
  secondary: {
    backgroundColor: 'transparent',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-strong)',
  },
  warm: {
    backgroundColor: 'var(--color-warm-accent)',
    color: 'var(--color-primary)',
    border: 'none',
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
  fullWidth = false,
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
    height: 'var(--size-button-h)',
    minHeight: 'var(--min-touch-target)',
    minWidth: '120px',
    width: fullWidth ? '100%' : undefined,
    padding: '0 var(--spacing-lg)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--fs-button)',
    fontWeight: 600,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.55 : 1,
    transition: 'opacity var(--transition-fast), background-color var(--transition-fast)',
    lineHeight: 1,
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
              flexShrink: 0,
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
