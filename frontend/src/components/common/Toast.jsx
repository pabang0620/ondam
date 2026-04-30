import React, { useEffect, useState } from 'react'

const TYPE_STYLES = {
  success: {
    backgroundColor: 'var(--color-success)',
    color: '#FFFFFF',
    icon: '✓',
  },
  error: {
    backgroundColor: 'var(--color-error)',
    color: '#FFFFFF',
    icon: '✕',
  },
  info: {
    backgroundColor: 'var(--color-primary)',
    color: '#FFFFFF',
    icon: 'ℹ',
  },
}

export function Toast({ message, type = 'info', onDismiss }) {
  const [visible, setVisible] = useState(true)
  const typeStyle = TYPE_STYLES[type] ?? TYPE_STYLES.info

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  // 페이드 아웃 후 언마운트 알림
  useEffect(() => {
    if (!visible && onDismiss) {
      const timer = setTimeout(onDismiss, 300)
      return () => clearTimeout(timer)
    }
  }, [visible, onDismiss])

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      style={{
        position: 'fixed',
        bottom: 'var(--spacing-xl)',
        right: 'var(--spacing-xl)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--font-size-base)',
        fontWeight: 500,
        maxWidth: 360,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        ...typeStyle,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
        {typeStyle.icon}
      </span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="알림 닫기"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'var(--min-touch-target)',
          width: 32,
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          fontSize: 18,
          cursor: 'pointer',
          opacity: 0.8,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}

export default Toast
