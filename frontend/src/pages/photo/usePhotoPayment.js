import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { preparePayment, confirmPayment } from './photoApi.js'

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
      navigate(`/photo/processing/${orderId}`)
    } catch (err) {
      if (pendingRef.current) {
        setError('결제 처리 중 오류가 발생했습니다. 다시 시도해 주세요.')
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
