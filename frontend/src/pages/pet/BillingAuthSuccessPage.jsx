import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { petApi } from './petApi.js'

// FIX: HIGH-1 - 백엔드가 결제 불확정 상태를 202로 응답하도록 바뀌었는데 응답 body가
// {success:true, ...}라 axios가 202도 정상 성공 응답으로 처리한다(2xx는 .then으로
// 간다). status===202 또는 data.indeterminate 플래그로 별도 분기하지 않으면 실제
// 구독 행이 없는데도 "구독 시작됨"으로 표시된다(G2 위반). 불확정 상태에서는 성공으로
// 이동하지 않고, 즉시 재시도도 유도하지 않는다(이중청구 방지).
export default function BillingAuthSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  // processing: 등록 확인 중 / indeterminate: 서버가 202(불확정) / error: 명확히 실패
  const [state, setState] = useState('processing')
  const [message, setMessage] = useState(null)
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
      .then((res) => {
        sessionStorage.removeItem('pendingSubscriptionPlan')
        const isIndeterminate = res.status === 202 || res.data?.data?.indeterminate === true
        if (isIndeterminate) {
          setMessage(
            res.data?.data?.message ?? '결제 결과를 확인하고 있어요. 잠시 후 다시 확인해 주세요.',
          )
          setState('indeterminate')
          return
        }
        navigate('/pet/subscription', { replace: true, state: { subscriptionSuccess: true } })
      })
      .catch((err) => {
        // FIX: DEV-24 - 빌링키 등록 실패를 구독 성공으로 위장하지 않는다
        sessionStorage.removeItem('pendingSubscriptionPlan')
        setState('error')
        setMessage(err?.response?.data?.message ?? '구독 등록에 실패했습니다. 다시 시도해 주세요.')
      })
  }, [searchParams, navigate])

  if (state === 'processing') return (
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

  if (state === 'indeterminate') return (
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
      <p role="status" aria-live="polite" style={{ color: 'var(--color-warm-accent)', fontSize: 'var(--fs-h3)', fontWeight: 700 }}>
        결제 결과를 확인하고 있어요
      </p>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
        {message} 카드가 이미 승인되었을 수 있어, 지금 다시 시도하면 이중으로 청구될 수
        있습니다. 잠시 후 구독 상태를 다시 확인해 주세요.
      </p>
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
        구독 상태 확인하러 가기
      </button>
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
