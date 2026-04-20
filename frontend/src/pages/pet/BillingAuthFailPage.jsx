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
    <div style={{ textAlign: 'center', padding: '3rem' }}>
      <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>카드 등록 실패</h2>
      <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-base)', marginBottom: '1.5rem' }}>{message}</p>
      <button
        type="button"
        onClick={() => navigate('/pet/subscription')}
        style={{ minHeight: 'var(--min-touch-target)', minWidth: '120px', padding: '0 2rem', fontSize: 'var(--font-size-base)' }}
      >
        플랜 선택으로 돌아가기
      </button>
    </div>
  )
}
