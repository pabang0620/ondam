import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { Button } from '../../components/common/Button.jsx'

// DEV-25: 토스 결제창에서 사용자가 취소했거나 카드사가 거절했을 때 failUrl로 리다이렉트되는
// 콜백 페이지. 토스 에러 코드를 어르신도 이해할 수 있는 쉬운 한국어 문장으로 바꿔 보여준다.
// (pet/BillingAuthFailPage.jsx의 FAIL_MESSAGES 패턴을 결제 전반에 맞게 확장)
const FAIL_MESSAGES = {
  PAY_PROCESS_CANCELED: '결제를 취소하셨습니다.',
  PAY_PROCESS_ABORTED: '결제가 중단되었습니다.',
  REJECT_CARD_COMPANY: '카드사에서 결제를 거절했습니다. 카드사에 문의해 주세요.',
  INVALID_CARD_EXPIRATION: '카드 유효기간을 다시 확인해 주세요.',
  INVALID_STOPPED_CARD: '정지되었거나 사용할 수 없는 카드입니다.',
  EXCEED_MAX_DAILY_PAYMENT_COUNT: '오늘 결제 가능한 횟수를 초과했습니다.',
  EXCEED_MAX_PAYMENT_AMOUNT: '결제 한도를 초과했습니다.',
  NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT: '이 카드는 할부 결제를 지원하지 않습니다.',
  INVALID_CARD_INSTALLMENT_PLAN: '할부 개월 수를 다시 확인해 주세요.',
  NOT_MATCHES_BIRTH: '생년월일(또는 사업자번호) 정보가 카드 정보와 일치하지 않습니다.',
  FDS_ERROR: '이상 거래로 감지되어 결제가 제한되었습니다. 카드사에 문의해 주세요.',
  EXCEED_MAX_ONE_DAY_WITHDRAW_AMOUNT: '카드 한도를 초과했습니다. 잔액이나 한도를 확인해 주세요.',
  REJECT_CARD_PAYMENT: '카드 잔액이 부족하거나 승인 한도를 초과했습니다.',
}

export default function WillPaymentFailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [retryWillId, setRetryWillId] = useState(null)

  const code = searchParams.get('code') || ''
  const message = FAIL_MESSAGES[code] || searchParams.get('message') || '결제에 실패했습니다.'

  useEffect(() => {
    // 결제가 성사되지 않았으므로 이어서 처리할 대상이 없다 - 재시도용 willId만 남기고 정리한다.
    const pendingWillId = sessionStorage.getItem('pendingWillId')
    setRetryWillId(pendingWillId)
    sessionStorage.removeItem('pendingWillId')
  }, [])

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
      <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
        결제를 완료하지 못했어요
      </h1>
      <p
        role="alert"
        style={{
          fontSize: 'var(--fs-body)',
          color: 'var(--color-error)',
          background: 'var(--color-error-light)',
          border: '1px solid var(--color-error)',
          borderRadius: 'var(--radius-sm)',
          padding: 'var(--spacing-md)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {message}
      </p>
      <Button
        onClick={() => navigate(retryWillId ? `/will/payment?willId=${retryWillId}` : '/will')}
        fullWidth
      >
        다시 시도하기
      </Button>
    </main>
  )
}
