import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { preparePayment } from './giftApi.js'
import { getTossPayments } from '../../lib/tossPayments.js'

// usePhotoPayment.js와 동일한 왕복 패턴 - prepare → 토스 SDK requestPayment → 콜백
// 페이지(GiftPaymentSuccessPage)에서 confirm. confirm은 리다이렉트 이후에 실행되므로
// 여기서는 SDK 호출 자체의 실패(catch)만 다룬다.
function useGiftPayment() {
  const [searchParams] = useSearchParams()
  const giftId = searchParams.get('giftId')

  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState(null)

  const handlePay = useCallback(async () => {
    if (!giftId || isPaying) return
    setIsPaying(true)
    setError(null)

    try {
      const prepareRes = await preparePayment(giftId)
      const { tossOrderId, amountKrw } = prepareRes.data?.data ?? {}

      const toss = await getTossPayments()
      sessionStorage.setItem('pendingGiftId', giftId)
      await toss.requestPayment('카드', {
        amount: amountKrw,
        orderId: tossOrderId,
        orderName: '리멤버미 선물하기',
        successUrl: window.location.origin + '/gift/payment/success',
        failUrl: window.location.origin + '/gift/payment/fail',
      })
      // 정상 흐름이면 여기서 리다이렉트되어 이후 코드는 실행되지 않는다.
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? '결제 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      setIsPaying(false)
    }
  }, [giftId, isPaying])

  return { giftId, isPaying, error, handlePay }
}

export default useGiftPayment
