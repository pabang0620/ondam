import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { preparePayment, confirmPayment, startProcessing, getPhotoOrder } from './photoApi.js'

// FIX: DEV-29 - 가격은 서버 정본(photo_orders.price_krw)이 유일한 출처다. 이전에는
// AMOUNT=9900이 하드코딩돼 있어 서버 가격이 바뀌면 결제가 전건 실패하는 구조였다.
// 지금은 우연히 서버도 9,900원이라 안 깨졌을 뿐이다. WillPaymentPage와 동일한 원칙으로
// 통일한다: 화면 표시는 페이지 진입 시 GET /photo/orders/:orderId(부작용 없음)로 조회,
// 실제 결제 금액은 handlePay 내부에서 preparePayment 응답의 amountKrw를 그대로 쓴다.
function usePhotoPayment() {
  const navigate = useNavigate()
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
      // 이전 코드는 이 응답을 아예 읽지 않고 photo_orders.order_id를 그대로
      // confirmPayment의 orderId로 보냈는데, 백엔드는 toss_order_id로 결제 레코드를
      // 찾기 때문에 항상 404로 실패했다(가격 불일치와 별개의 결제 실패 원인이었다).
      const { tossOrderId, amountKrw } = prepareRes.data?.data ?? {}
      setAmount(Number(amountKrw))
      await confirmPayment({ orderId: tossOrderId, amount: amountKrw })
      await startProcessing(orderId)
      navigate(`/photo/processing/${orderId}`)
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || '결제 처리 중 오류가 발생했습니다.')
    } finally {
      setIsPaying(false)
    }
  }, [orderId, isPaying, navigate])

  return {
    orderId,
    amount,
    isPaying,
    error,
    handlePay,
  }
}

export default usePhotoPayment
