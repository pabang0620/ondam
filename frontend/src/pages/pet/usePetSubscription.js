import { useState, useEffect, useCallback } from 'react'
import { petApi } from './petApi.js'
import { getTossPayments } from '../../lib/tossPayments.js'
import { useAuthStore } from '../../store/authStore.js'

export function usePetSubscription() {
  const user = useAuthStore((s) => s.user)

  const [plans, setPlans] = useState([])
  const [currentSubscription, setCurrentSubscription] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [plansRes, subRes] = await Promise.all([
        petApi.getSubscriptionPlans(),
        petApi.getMySubscription(),
      ])
      if (plansRes.data.success) setPlans(plansRes.data.data ?? [])
      if (subRes.data.success) setCurrentSubscription(subRes.data.data?.[0] ?? null)
    } catch (err) {
      setError(err.response?.data?.message || '정보를 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchData()
    return () => ac.abort()
  }, [fetchData])

  const handleSubscribe = async (planKey) => {
    if (isProcessing || isRedirecting) return
    setIsRedirecting(true)
    setActionError(null)
    try {
      const toss = await getTossPayments()
      sessionStorage.setItem('pendingSubscriptionPlan', planKey)
      await toss.requestBillingAuth('카드', {
        customerKey: user?.userId,
        successUrl: window.location.origin + '/pet/billing/success',
        failUrl: window.location.origin + '/pet/billing/fail',
      })
      // 리디렉트 발생 — 이후 코드 실행 안 됨
    } catch (err) {
      sessionStorage.removeItem('pendingSubscriptionPlan')
      setActionError('결제 모듈 로드에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      setIsRedirecting(false)
    }
  }

  const handleRetryPayment = async (subscriptionId) => {
    if (isProcessing) return
    const pendingRef = { current: true }
    setIsProcessing(true)
    setActionError(null)
    try {
      const res = await petApi.retryPayment(subscriptionId)
      if (res.data.success) {
        setCurrentSubscription(res.data.data)
        setSuccessMessage('재결제가 완료되었습니다.')
      }
    } catch (err) {
      setActionError(err.response?.data?.message || '재결제에 실패했습니다.')
    } finally {
      if (pendingRef.current) {
        setIsProcessing(false)
        pendingRef.current = false
      }
    }
  }

  const openCancelModal = () => setIsCancelModalOpen(true)
  const closeCancelModal = () => setIsCancelModalOpen(false)

  const confirmCancel = async (subscriptionId) => {
    if (isProcessing) return
    const pendingRef = { current: true }
    setIsProcessing(true)
    setActionError(null)
    try {
      await petApi.cancelSubscription(subscriptionId)
      setCurrentSubscription((prev) =>
        prev ? { ...prev, subStatus: 'canceled' } : null,
      )
      setIsCancelModalOpen(false)
      setSuccessMessage('구독이 해지되었습니다.')
    } catch (err) {
      setActionError(err.response?.data?.message || '구독 해지에 실패했습니다.')
    } finally {
      if (pendingRef.current) {
        setIsProcessing(false)
        pendingRef.current = false
      }
    }
  }

  const clearSuccessMessage = () => setSuccessMessage(null)

  return {
    plans,
    currentSubscription,
    isLoading,
    error,
    isProcessing,
    isRedirecting,
    actionError,
    isCancelModalOpen,
    successMessage,
    handleSubscribe,
    handleRetryPayment,
    openCancelModal,
    closeCancelModal,
    confirmCancel,
    clearSuccessMessage,
    refetch: fetchData,
  }
}
