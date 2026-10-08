import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createGiftOrder } from './giftApi.js'
import { useAuthStore } from '../../store/authStore.js'
import { ROUTES } from '../../constants/routes.js'

function useGiftNew() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isAuthInitialized = useAuthStore((s) => s.isAuthInitialized)

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
    // 비로그인도 이 페이지를 열람할 수 있으므로 주문 생성 API 호출 전에 로그인으로 보낸다.
    // 세션 복원(initAuth) 중이면 판정을 보류한다.
    if (!isAuthInitialized) return
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN)
      return
    }
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
  }, [canSubmit, isAuthenticated, isAuthInitialized, productType, recipientName, recipientPhone, navigate])

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
