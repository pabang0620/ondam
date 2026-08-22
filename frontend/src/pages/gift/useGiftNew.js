import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createGiftOrder } from './giftApi.js'

function useGiftNew() {
  const navigate = useNavigate()

  const [productType, setProductType] = useState(null)
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const canSubmit = Boolean(
    productType && recipientName.trim() && /^01[0-9]-?\d{3,4}-?\d{4}$/.test(recipientPhone.trim()) && !isSubmitting,
  )

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    setError(null)
    try {
      const { data } = await createGiftOrder(productType, recipientName.trim(), recipientPhone.trim())
      const { giftId, performToken } = data.data
      // 결제 왕복 동안 보관 - PhotoPaymentPage의 pendingPhotoOrderId와 동일 패턴
      sessionStorage.setItem('pendingGiftId', giftId)
      sessionStorage.setItem('pendingGiftPerformToken', performToken)
      navigate(`/gift/payment?giftId=${giftId}`, { state: { productType } })
    } catch (err) {
      setError(err?.response?.data?.message ?? '선물 주문 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }, [canSubmit, productType, recipientName, recipientPhone, navigate])

  return {
    productType,
    setProductType,
    recipientName,
    setRecipientName,
    recipientPhone,
    setRecipientPhone,
    isSubmitting,
    error,
    canSubmit,
    handleSubmit,
  }
}

export default useGiftNew
