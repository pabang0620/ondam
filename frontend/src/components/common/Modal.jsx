import React, { useEffect, useRef, useState } from 'react'

export function Modal({ isOpen, onClose, title, children }) {
  const dialogRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)

  // 모바일 감지 (< 640px)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = (e) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // 열릴 때 스크롤 잠금
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // FE-GMA-14: 열 때 포커스가 있던 요소를 기억했다가 닫힐 때(언마운트 포함) 되돌린다.
  // 되돌리지 않으면 스크린리더·키보드 사용자는 문서 맨 앞으로 튕겨 나간다.
  useEffect(() => {
    if (!isOpen) return undefined
    const previouslyFocused = document.activeElement
    return () => {
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [isOpen])

  // 포커스 트랩 - 모달 열릴 때 첫 번째 포커스 가능 요소에 포커스
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return

    const focusable = dialogRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length > 0) focusable[0].focus()

    const handleTab = (e) => {
      if (e.key !== 'Tab' || !dialogRef.current) return
      const all = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (all.length === 0) return
      const first = all[0]
      const last = all[all.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [isOpen])

  if (!isOpen) return null

  // 모바일: 하단 sheet 스타일 / 데스크톱: 중앙 모달
  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center',
    padding: isMobile ? 0 : 'var(--spacing-md)',
  }

  const dialogStyle = isMobile
    ? {
        position: 'relative',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        padding: 'var(--spacing-xl) var(--spacing-lg)',
        width: '100%',
        maxWidth: '100vw',
        maxHeight: '90vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingBottom: 'max(var(--spacing-2xl), env(safe-area-inset-bottom, 0px))',
      }
    : {
        position: 'relative',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--spacing-xl)',
        width: '100%',
        maxWidth: 520,
        maxHeight: '90vh',
        overflowY: 'auto',
        overflowX: 'hidden',
      }

  // FE-GMA-14: 예전에는 aria-hidden="true"가 dialog까지 감싼 최상위 div에 있어 모달
  // 내용 전체가 보조기기에서 숨겨졌다. aria-hidden은 장식용 배경 div에만 둔다.
  return (
    <div style={overlayStyle}>
      {/* Overlay - 클릭 시 닫기 (키보드 사용자는 ESC/닫기 버튼 사용) */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(42, 40, 38, 0.45)',
        }}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        style={dialogStyle}
      >
        {/* 모바일 handle bar */}
        {isMobile && (
          <div
            aria-hidden="true"
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: 'var(--color-border-strong)',
              margin: '-8px auto var(--spacing-md)',
            }}
          />
        )}

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: title ? 'var(--spacing-xl)' : 0,
          }}
        >
          {title && (
            <h2
              id="modal-title"
              style={{
                fontSize: 'var(--fs-h3)',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: 'var(--ls-heading-ko)',
              }}
            >
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="모달 닫기"
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'var(--min-touch-target)',
              height: 'var(--min-touch-target)',
              minHeight: 'var(--min-touch-target)',
              border: 'none',
              background: 'transparent',
              fontSize: 24,
              color: 'var(--color-text-secondary)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-alt)'
              e.currentTarget.style.color = 'var(--color-text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--color-text-secondary)'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div>{children}</div>
      </div>
    </div>
  )
}

export default Modal
