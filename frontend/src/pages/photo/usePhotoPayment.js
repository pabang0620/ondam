import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { preparePayment, getPhotoOrder } from './photoApi.js'
import { getTossPayments } from '../../lib/tossPayments.js'

// FIX: DEV-29 - 가격은 서버 정본(photo_orders.price_krw)이 유일한 출처다. 이전에는
// AMOUNT=9900이 하드코딩돼 있어 서버 가격이 바뀌면 결제가 전건 실패하는 구조였다.
// 지금은 우연히 서버도 9,900원이라 안 깨졌을 뿐이다. WillPaymentPage와 동일한 원칙으로
// 통일한다: 화면 표시는 페이지 진입 시 GET /photo/orders/:orderId(부작용 없음)로 조회,
// 실제 결제 금액은 handlePay 내부에서 preparePayment 응답의 amountKrw를 그대로 쓴다.
//
// FIX: DEV-25 - 이전에는 여기서 confirmPayment(paymentKey: mock_...)를 직접 호출해
// 토스 결제창을 아예 띄우지 않는 모의 결제였다. 이제 실제 왕복으로 바꾼다:
// prepare → 토스 SDK requestPayment(서버가 준 금액) → 토스 결제창 → successUrl 콜백
// (PhotoPaymentSuccessPage)에서 confirm. confirm/startProcessing은 콜백 페이지로 옮겼다
// (pet/usePetSubscription.js의 requestBillingAuth 패턴과 동일하게, 리다이렉트 이후
// 코드는 실행되지 않으므로 여기서는 실패(catch)만 다룬다).
function usePhotoPayment() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')

  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState(null)
  const [amount, setAmount] = useState(null)

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    getPhotoOrder(orderId)
      .then((res) => {
        if (cancelled) return
        const priceKrw = res.data?.data?.price_krw
        if (priceKrw != null) setAmount(Number(priceKrw))
      })
      .catch(() => {
        // 표시용 조회 실패는 결제 자체를 막지 않는다 - handlePay가 preparePayment로
        // 다시 서버 정본 금액을 확인한다.
      })
    return () => {
      cancelled = true
    }
  }, [orderId])

  const handlePay = useCallback(async () => {
    if (!orderId || isPaying) return

    setIsPaying(true)
    setError(null)

    try {
      const prepareRes = await preparePayment(orderId)
      // FIX: DEV-29 - preparePayment 응답의 필드는 tossOrderId/amountKrw다(orderId 아님).
      const { tossOrderId, amountKrw } = prepareRes.data?.data ?? {}
      setAmount(Number(amountKrw))

      const toss = await getTossPayments()
      // 토스 결제창은 successUrl로 전체 페이지 리다이렉트한다 - 그 콜백 페이지에서
      // startProcessing을 마저 호출해야 하므로, 어떤 photo_orders를 이어서 처리할지
      // sessionStorage에 남겨둔다 (pet/usePetSubscription.js의 pendingSubscriptionPlan과 동일 패턴).
      sessionStorage.setItem('pendingPhotoOrderId', orderId)
      await toss.requestPayment('카드', {
        amount: amountKrw,
        orderId: tossOrderId,
        orderName: 'AI 사진관 1세트',
        successUrl: window.location.origin + '/photo/payment/success',
        failUrl: window.location.origin + '/photo/payment/fail',
      })
      // 정상 흐름이면 여기서 브라우저가 리다이렉트되어 이후 코드는 실행되지 않는다.
    } catch (err) {
      // 토스 SDK 호출 자체가 실패(사용자가 결제창을 열기 전에 취소 등)한 경우만 여기로 온다.
      // 결제 성공을 여기서 만들지 않는다 - 성공 판정은 반드시 서버 confirm 응답이다 (G2/G3).
      sessionStorage.removeItem('pendingPhotoOrderId')
      setError(err?.response?.data?.message || err?.message || '결제 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      setIsPaying(false)
    }
  }, [orderId, isPaying])

  return {
    orderId,
    amount,
    isPaying,
    error,
    handlePay,
  }
}

export default usePhotoPayment
