import { useSearchParams, useNavigate } from 'react-router-dom'

const FAIL_MESSAGES = {
  PAY_PROCESS_CANCELED: '결제를 취소하셨습니다.',
  PAY_PROCESS_ABORTED: '결제가 중단되었습니다.',
  REJECT_CARD_COMPANY: '카드사에서 결제가 거절되었습니다.',
}

export default function BillingAuthFailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const code = searchParams.get('code') || ''
  const message = FAIL_MESSAGES[code] || searchParams.get('message') || '카드 등록에 실패했습니다.'

  return (
    <div
      style={{
        textAlign: 'center',
        padding: 'var(--spacing-2xl) var(--spacing-md)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--spacing-lg)',
      }}
    >
      <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, color: 'var(--color-primary)' }}>
        카드 등록 실패
      </h2>
      <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)' }}>{message}</p>
      <button
        type="button"
        onClick={() => navigate('/pet/subscription')}
        style={{
          background: 'var(--color-primary)',
          color: 'var(--color-surface)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          minHeight: 'var(--size-button-h)',
          minWidth: '120px',
          padding: '0 var(--spacing-xl)',
          fontSize: 'var(--fs-button)',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        플랜 선택으로 돌아가기
      </button>
    </div>
  )
}
