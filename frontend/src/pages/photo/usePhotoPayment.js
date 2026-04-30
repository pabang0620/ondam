import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { preparePayment, confirmPayment, startProcessing } from './photoApi.js'

const AMOUNT = 9900

function usePhotoPayment() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')

  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState(null)

  const handlePay = useCallback(async () => {
    if (!orderId || isPaying) return

    const pendingRef = { current: true }
    setIsPaying(true)
    setError(null)

    try {
      await preparePayment(orderId)
      await confirmPayment(orderId)
      await startProcessing(orderId)
      navigate(`/photo/processing/${orderId}`)
    } catch (err) {
      console.warn('[mock] 결제 API 실패, mock 결제 시뮬레이션으로 진행:', err)
      // 백엔드 없이도 결제 완료 흐름을 체험할 수 있도록 2초 대기 후 처리 페이지 이동
      await new Promise((resolve) => setTimeout(resolve, 2000))
      if (pendingRef.current) {
        navigate(`/photo/processing/${orderId}`)
      }
    } finally {
      pendingRef.current = false
      setIsPaying(false)
    }
  }, [orderId, isPaying, navigate])

  return {
    orderId,
    amount: AMOUNT,
    isPaying,
    error,
    handlePay,
  }
}

export default usePhotoPayment
