import { useState, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { willApi } from './willApi.js'

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
      // mock 결제 처리 후 activate
      await willApi.activateWill(willId)
      navigate(`/will/processing/${willId}`)
    } catch {
      setPayError('결제에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setIsPaying(false)
      pendingRef.current = false
    }
  }, [willId, navigate])

  return {
    willId,
    isPaying,
    payError,
    handlePay,
  }
}
