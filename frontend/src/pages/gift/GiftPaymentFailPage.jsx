import { useSearchParams, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { Button } from '../../components/common/Button.jsx'

export default function GiftPaymentFailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const message = searchParams.get('message') || '결제가 취소되었거나 실패했습니다.'

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '64px var(--spacing-md) 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--spacing-lg)',
        textAlign: 'center',
      }}
    >
      <AlertCircle size={40} color="var(--color-error)" aria-hidden="true" />
      <p role="alert" style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
        결제를 완료하지 못했어요
      </p>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
        {message}
      </p>
      <Button onClick={() => navigate('/gift/new')} fullWidth>다시 시도하기</Button>
    </main>
  )
}
