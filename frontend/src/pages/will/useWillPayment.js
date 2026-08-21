import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { willApi } from './willApi.js'

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
  const navigate = useNavigate()
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
      // FIX: DEV-29 - 이전에는 존재하지 않는 필드인 `orderId`를 읽어 항상 undefined가
      // confirmPayment로 넘어갔다(백엔드가 실제로 반환하는 필드는 tossOrderId).
      // undefined orderId로는 결제 레코드를 못 찾아 confirm이 404로 항상 실패했다 -
      // 가격 불일치와 별개로 이 자체가 "결제 100% 실패"의 또 다른 직접 원인이었다.
      const { tossOrderId, amountKrw } = prepareRes.data.data ?? {}
      setAmount(Number(amountKrw))

      // 2단계: 결제 확인 (개발 환경 mock) - amount는 반드시 prepare가 돌려준
      // amountKrw를 그대로 사용한다. 서버가 이 값과 저장된 amount_krw를 대조하므로,
      // 여기서 다른 값을 보내면(하드코딩 등) 항상 400(금액 불일치)으로 거부된다.
      const paymentKey = `mock_${Date.now()}`
      await willApi.confirmPayment({
        paymentKey,
        orderId: tossOrderId,
        amount: amountKrw,
      })

      // 3단계: 영상 생성 큐 등록
      await willApi.activateWill(willId)

      // 4단계: 처리 페이지 이동
      navigate(`/will/processing/${willId}`)
    } catch (err) {
      setPayError(err?.response?.data?.message || err?.message || '결제 처리 중 오류가 발생했습니다.')
    } finally {
      setIsPaying(false)
    }
  }, [willId, isPaying, navigate])

  return {
    willId,
    amount,
    isPaying,
    payError,
    handlePay,
  }
}
