import { Navigate, useSearchParams } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import { BILLING_RESULT } from './subscriptionLabels.js'

const FAIL_MESSAGES = {
  PAY_PROCESS_CANCELED: '결제를 취소하셨습니다.',
  PAY_PROCESS_ABORTED: '결제가 중단되었습니다.',
  REJECT_CARD_COMPANY: '카드사에서 결제가 거절되었습니다.',
}

const DEFAULT_FAIL_MESSAGE = '카드 등록에 실패했습니다.'

// 토스 failUrl 복귀 페이지: 화면을 그리지 않고 /pet 으로 보내 실패 알림을 거기서 보여준다.
// 외부 입력(쿼리 message)은 표시하지 않는다: 콘텐츠 스푸핑 방지(보안 리뷰 M-2)
export default function BillingAuthFailPage() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code') || ''
  const message = Object.hasOwn(FAIL_MESSAGES, code) ? FAIL_MESSAGES[code] : DEFAULT_FAIL_MESSAGE

  return (
    <Navigate
      to={ROUTES.PET}
      replace
      state={{ [BILLING_RESULT.KEY]: BILLING_RESULT.FAIL, [BILLING_RESULT.MESSAGE_KEY]: message }}
    />
  )
}
