import { Link } from 'react-router-dom'
import { Loader2, Gift, RefreshCw, XCircle } from 'lucide-react'
import { Button } from '../../components/common/Button.jsx'
import useGiftMine from './useGiftMine.js'

function GiftMinePage() {
  const { gifts, isLoading, error, actionState, statusLabels, handleResend, handleCancel } = useGiftMine()

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '32px var(--spacing-md) 48px', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: 'var(--ls-heading-ko)' }}>
          내가 보낸 선물
        </h1>
        <Link
          to="/gift/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 'var(--min-touch-target)',
            padding: '0 16px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-primary)',
            color: 'var(--color-text-on-dark)',
            fontSize: 'var(--fs-body)',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          <Gift size={18} /> 새 선물
        </Link>
      </header>

      {error && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)', background: 'var(--color-error-light)', border: '1px solid var(--color-error)', borderRadius: 'var(--radius-sm)', padding: 'var(--spacing-md)' }}>
          {error}
        </p>
      )}

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} color="var(--color-primary)" />
        </div>
      ) : gifts.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--fs-body)', padding: '48px 0' }}>
          아직 보낸 선물이 없어요.
        </p>
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', listStyle: 'none', padding: 0 }}>
          {gifts.map((gift) => {
            const status = actionState[gift.gift_id]
            const canResend = gift.payment_id && ['link_sent', 'opened', 'in_progress'].includes(gift.status)
            const canCancel = gift.payment_id && gift.status === 'link_sent'
            return (
              <li
                key={gift.gift_id}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-card)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  background: 'var(--color-surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--fs-body-lg)', color: 'var(--color-text-primary)' }}>
                    {gift.product_type === 'photo' ? 'AI 사진관 세트' : '마지막 영상 편지'}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--fs-caption)',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'var(--color-surface-warm)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    {statusLabels[gift.status] ?? gift.status}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>
                  받는 분: {gift.recipient_name}
                </p>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 6 }}>
                  {canResend && (
                    <Button
                      variant="secondary"
                      isLoading={status === 'resending'}
                      onClick={() => handleResend(gift.gift_id)}
                      style={{ height: 40, minHeight: 40, minWidth: 0, padding: '0 14px' }}
                    >
                      <RefreshCw size={16} /> 다시 보내기
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      variant="danger"
                      isLoading={status === 'canceling'}
                      onClick={() => handleCancel(gift.gift_id)}
                      style={{ height: 40, minHeight: 40, minWidth: 0, padding: '0 14px' }}
                    >
                      <XCircle size={16} /> 취소·환불
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}

export default GiftMinePage
