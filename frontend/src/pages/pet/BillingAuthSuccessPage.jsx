import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { petApi } from './petApi.js'

export default function BillingAuthSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(true)
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const authKey = searchParams.get('authKey')
    const customerKey = searchParams.get('customerKey')
    const plan = sessionStorage.getItem('pendingSubscriptionPlan')

    if (!authKey || !customerKey || !plan) {
      navigate('/pet/subscription', { replace: true })
      return
    }

    petApi.registerBillingKey({ authKey, customerKey, plan })
      .then(() => {
        sessionStorage.removeItem('pendingSubscriptionPlan')
        navigate('/pet/subscription', { replace: true, state: { subscriptionSuccess: true } })
      })
      .catch((err) => {
        // FIX: DEV-24 - 빌링키 등록 실패를 구독 성공으로 위장하지 않는다
        sessionStorage.removeItem('pendingSubscriptionPlan')
        setIsProcessing(false)
        setError(err?.response?.data?.message ?? '구독 등록에 실패했습니다. 다시 시도해 주세요.')
      })
  }, [searchParams, navigate])

  if (isProcessing) return (
    <div
      style={{
        textAlign: 'center',
        padding: '48px var(--spacing-md)',
        fontSize: 'var(--fs-body)',
        color: 'var(--color-text-secondary)',
      }}
    >
      <p role="status" aria-live="polite">구독을 등록하는 중입니다...</p>
    </div>
  )

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '48px var(--spacing-md)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
      }}
    >
      <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)' }}>{error}</p>
      <button
        type="button"
        onClick={() => navigate('/pet/subscription')}
        style={{
          background: 'var(--color-primary)',
          color: 'var(--color-surface)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          minHeight: 'var(--size-button-h)',
          padding: '0 var(--spacing-xl)',
          fontSize: 'var(--fs-button)',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        돌아가기
      </button>
    </div>
  )
}
