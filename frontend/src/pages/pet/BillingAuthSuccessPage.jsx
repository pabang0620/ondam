import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { petApi } from './petApi.js'

export default function BillingAuthSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
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
        setError(err.response?.data?.message || '구독 등록에 실패했습니다.')
        setIsProcessing(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (isProcessing) return (
    <div style={{ textAlign: 'center', padding: '3rem', fontSize: 'var(--font-size-base)' }}>
      <p>구독을 등록하는 중입니다...</p>
    </div>
  )

  return (
    <div style={{ textAlign: 'center', padding: '3rem' }}>
      <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-base)', marginBottom: '1.5rem' }}>{error}</p>
      <button
        type="button"
        onClick={() => navigate('/pet/subscription')}
        style={{ minHeight: 'var(--min-touch-target)', padding: '0 2rem', fontSize: 'var(--font-size-base)' }}
      >
        돌아가기
      </button>
    </div>
  )
}
