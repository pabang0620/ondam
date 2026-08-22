import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { willApi } from './willApi.js'
import { getTossPayments } from '../../lib/tossPayments.js'

// FIX: DEV-29 - 가격은 서버 정본(wills.price_krw)이 유일한 출처다. 이전에는 이 값이
// 29900으로 하드코딩돼 있었는데, 백엔드가 결제 대상의 실제 가격(현재 49,000원 - 마지막
// 영상 편지 베이직)을 직접 조회해 confirm 시점에 금액을 대조하는 구조로 바뀌면서
// 클라이언트가 보낸/기대한 금액과 서버 금액이 어긋나 결제가 전건 실패했다.
// 화면 표시용 금액은 아래처럼 결제 페이지 진입 시 GET /will/wills/:willId로 서버의
// price_krw를 읽어와 채운다(부작용 없는 조회라 결제 시도 전에 안전하게 호출 가능).
// 실제 결제에 쓰이는 금액은 이것과 별개로 preparePayment 응답의 amountKrw를 그대로
// 쓴다(아래 handlePay) - 화면 표시가 어떤 이유로든 실패/지연되어도 결제 자체는 항상
// 서버가 그 순간 조회한 정본 금액으로 진행되므로 금액 불일치로 깨지지 않는다.
export function useWillPayment() {
  const [searchParams] = useSearchParams()
  const willId = searchParams.get('willId') || localStorage.getItem('will_current_id') || ''

  const [isPaying, setIsPaying] = useState(false)
  const [payError, setPayError] = useState(null)
  const [amount, setAmount] = useState(null)

  useEffect(() => {
    if (!willId) return
    let cancelled = false
    willApi.getWill(willId)
      .then((res) => {
        if (cancelled) return
        const priceKrw = res.data?.data?.price_krw
        if (priceKrw != null) setAmount(Number(priceKrw))
      })
      .catch(() => {
        // 표시용 조회 실패는 결제 자체를 막지 않는다 - 결제 버튼을 누르면 handlePay가
        // preparePayment로 다시 서버 정본 금액을 확인한다. 아래 amount는 null로 남고
        // WillPaymentPage가 로딩 상태를 표시한다.
      })
    return () => {
      cancelled = true
    }
  }, [willId])

  const handlePay = useCallback(async () => {
    if (!willId) {
      setPayError('유언장 정보를 찾을 수 없습니다.')
      return
    }

    if (isPaying) return

    setIsPaying(true)
    setPayError(null)

    try {
      // 1단계: 결제 준비 - 서버가 wills.price_krw를 직접 조회해 금액을 확정한다.
      // 클라이언트는 금액을 보내지 않는다(백엔드가 애초에 읽지도 않는다).
      const prepareRes = await willApi.preparePayment(willId)
      if (!prepareRes.data?.success) {
        throw new Error(prepareRes.data?.message || '결제 준비에 실패했습니다')
      }
      // FIX: DEV-29 - preparePayment 응답의 필드는 tossOrderId/amountKrw다(orderId 아님).
      const { tossOrderId, amountKrw } = prepareRes.data.data ?? {}
      setAmount(Number(amountKrw))

      // FIX: DEV-25 - 이전에는 여기서 confirmPayment(paymentKey: mock_...)를 직접
      // 호출해 토스 결제창을 아예 띄우지 않는 모의 결제였다. 이제 실제 왕복으로 바꾼다:
      // 토스 SDK requestPayment(서버가 준 금액) → 토스 결제창 → successUrl 콜백
      // (WillPaymentSuccessPage)에서 confirm + activateWill을 마저 처리한다.
      const toss = await getTossPayments()
      // 결제창은 successUrl로 전체 페이지 리다이렉트한다 - 콜백 페이지에서 어떤
      // 유언장을 이어서 activate할지 알아야 하므로 sessionStorage에 남겨둔다
      // (pet/usePetSubscription.js의 pendingSubscriptionPlan과 동일 패턴).
      sessionStorage.setItem('pendingWillId', willId)
      await toss.requestPayment('카드', {
        amount: amountKrw,
        orderId: tossOrderId,
        orderName: 'AI 유언장 제작',
        successUrl: window.location.origin + '/will/payment/success',
        failUrl: window.location.origin + '/will/payment/fail',
      })
      // 정상 흐름이면 여기서 브라우저가 리다이렉트되어 이후 코드는 실행되지 않는다.
    } catch (err) {
      // 토스 SDK 호출 자체가 실패한 경우만 여기로 온다. 결제 성공은 여기서 만들지
      // 않는다 - 성공 판정은 반드시 서버 confirm 응답이다 (G2/G3).
      sessionStorage.removeItem('pendingWillId')
      setPayError(err?.response?.data?.message || err?.message || '결제 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      setIsPaying(false)
    }
  }, [willId, isPaying])

  return {
    willId,
    amount,
    isPaying,
    payError,
    handlePay,
  }
}
