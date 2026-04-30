import { useState, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { willApi } from './willApi.js'

const WILL_AMOUNT = 29900

export function useWillPayment() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const willId = searchParams.get('willId') || localStorage.getItem('will_current_id') || ''

  const [isPaying, setIsPaying] = useState(false)
  const [payError, setPayError] = useState(null)
  const pendingRef = useRef(false)

  const handlePay = useCallback(async () => {
    if (!willId) {
      setPayError('유언장 정보를 찾을 수 없습니다.')
      return
    }

    if (pendingRef.current) return
    pendingRef.current = true

    setIsPaying(true)
    setPayError(null)

    try {
      // 1단계: 결제 준비
      const prepareRes = await willApi.preparePayment(willId, WILL_AMOUNT)
      if (!prepareRes.data?.success) {
        throw new Error(prepareRes.data?.message || '결제 준비에 실패했습니다')
      }
      const orderId = prepareRes.data.data?.orderId

      // 2단계: 결제 확인 (개발 환경 mock)
      const paymentKey = `mock_${Date.now()}`
      await willApi.confirmPayment({
        paymentKey,
        orderId,
        amount: WILL_AMOUNT,
      })

      // 3단계: 영상 생성 큐 등록
      await willApi.activateWill(willId)

      // 4단계: 처리 페이지 이동
      navigate(`/will/processing/${willId}`)
    } catch (err) {
      console.warn('[mock] 결제 API 실패 - 1.5초 후 처리 페이지로 이동 (시뮬레이션)', err)
      await new Promise((resolve) => setTimeout(resolve, 1500))
      navigate(`/will/processing/${willId}`)
    } finally {
      setIsPaying(false)
      pendingRef.current = false
    }
  }, [willId, navigate])

  return {
    willId,
    amount: WILL_AMOUNT,
    isPaying,
    payError,
    handlePay,
  }
}
