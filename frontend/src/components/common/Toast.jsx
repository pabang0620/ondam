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
    color: 'var(--color-text-on-dark)',
    icon: 'ℹ',
  },
}

export function Toast({ message, type = 'info', onDismiss }) {
  const [visible, setVisible] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const typeStyle = TYPE_STYLES[type] ?? TYPE_STYLES.info

  // 모바일 감지 (< 640px)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = (e) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

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

  // 모바일: 상단 풀너비 / 데스크톱: 우측 하단 fixed
  const positionStyle = isMobile
    ? {
        position: 'fixed',
        top: 'max(var(--spacing-md), env(safe-area-inset-top, 0px))',
        left: 'var(--spacing-md)',
        right: 'var(--spacing-md)',
        bottom: 'auto',
        maxWidth: '100%',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
      }
    : {
        position: 'fixed',
        bottom: 'var(--spacing-xl)',
        right: 'var(--spacing-xl)',
        top: 'auto',
        left: 'auto',
        maxWidth: 360,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
      }

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      style={{
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid rgba(255,255,255,0.15)',
        fontSize: 'var(--fs-body)',
        fontWeight: 500,
        lineHeight: 'var(--lh-relaxed)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        ...typeStyle,
        ...positionStyle,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
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
          minWidth: 'var(--min-touch-target)',
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          fontSize: 20,
          cursor: 'pointer',
          opacity: 0.8,
          padding: 0,
          flexShrink: 0,
          marginLeft: '4px',
        }}
      >
        ×
      </button>
    </div>
  )
}

export default Toast
