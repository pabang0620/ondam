import { useEffect, useRef } from 'react'
import { formatKst } from '../../utils/dateKst.js'

export default function CancelSubscriptionModal({ isOpen, onClose, onConfirm, subscription, isProcessing }) {
  const confirmButtonRef = useRef(null)
  const previousFocusRef = useRef(null)

  // 모달 열릴 때 포커스 관리
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement
      confirmButtonRef.current?.focus()
    } else {
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  // ESC 키 닫기
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // 스크롤 락
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

  if (!isOpen) return null

  const nextBillingDate = subscription?.next_billing_at
    ? formatKst(subscription.next_billing_at)
    : null

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(42, 40, 38, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--spacing-md)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          maxWidth: 400,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-lg)',
        }}
      >
        <h2
          id="cancel-modal-title"
          style={{
            fontSize: 'var(--fs-body-lg)',
            fontWeight: 700,
            color: 'var(--color-primary)',
          }}
        >
          구독을 해지하시겠습니까?
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {nextBillingDate && (
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--color-primary)' }}>{nextBillingDate}까지</strong> 계속 이용하실 수 있습니다.
            </p>
          )}
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
            해지 후에는 다음 결제일부터 서비스 이용이 제한됩니다.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            style={{
              flex: 1,
              minHeight: 'var(--size-button-h)',
              fontSize: 'var(--fs-button)',
              fontWeight: 600,
              background: 'none',
              color: 'var(--color-text-secondary)',
              border: '1.5px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-pill)',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.7 : 1,
            }}
          >
            취소
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={() => onConfirm(subscription?.subscriptionId)}
            disabled={isProcessing}
            style={{
              flex: 1,
              minHeight: 'var(--size-button-h)',
              fontSize: 'var(--fs-button)',
              fontWeight: 700,
              background: 'var(--color-error)',
              color: 'var(--color-surface)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.7 : 1,
            }}
          >
            {isProcessing ? '처리 중...' : '해지 확정'}
          </button>
        </div>
      </div>
    </div>
  )
}
