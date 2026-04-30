import { useState, useEffect, useCallback } from 'react'
import { petApi } from './petApi.js'
import { getTossPayments } from '../../lib/tossPayments.js'
import { useAuthStore } from '../../store/authStore.js'

const NEXT_BILLING_DATE = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString()
})()

const MOCK_SUBSCRIPTION = {
  subscriptionId: 'mock-sub-001',
  userId: 'mock-user-001',
  plan: 'pet_archive',
  subStatus: 'active',
  next_billing_at: NEXT_BILLING_DATE,
  fail_count: 0,
  amount: 9900,
}

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
      console.warn('[mock] usePetSubscription.fetchData - 백엔드 응답 없음, mock 구독 데이터로 대체', err)
      setPlans([])
      setCurrentSubscription(MOCK_SUBSCRIPTION)
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
      // 리디렉트 발생 - 이후 코드 실행 안 됨
    } catch (err) {
      console.warn('[mock] usePetSubscription.handleSubscribe - 토스 SDK 실패, mock 구독 성공 처리', err)
      sessionStorage.removeItem('pendingSubscriptionPlan')
      const nextBilling = new Date()
      nextBilling.setDate(nextBilling.getDate() + 30)
      setCurrentSubscription({
        subscriptionId: `mock-sub-${Date.now()}`,
        userId: user?.userId ?? 'mock-user-001',
        plan: planKey,
        subStatus: 'active',
        next_billing_at: nextBilling.toISOString(),
        fail_count: 0,
        amount: planKey === 'pet_archive' ? 9900 : planKey === 'will_premium' ? 29900 : 39900,
      })
      setSuccessMessage('구독이 성공적으로 등록되었습니다. (시뮬레이션)')
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
      console.warn('[mock] usePetSubscription.handleRetryPayment - API 실패, mock 재결제 성공 처리', err)
      setCurrentSubscription((prev) =>
        prev ? { ...prev, subStatus: 'active', fail_count: 0 } : prev,
      )
      setSuccessMessage('재결제가 완료되었습니다. (시뮬레이션)')
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
      console.warn('[mock] usePetSubscription.confirmCancel - API 실패, 로컬 상태만 canceled로 변경', err)
      setCurrentSubscription((prev) =>
        prev ? { ...prev, subStatus: 'canceled' } : null,
      )
      setIsCancelModalOpen(false)
      setSuccessMessage('구독이 해지되었습니다. (시뮬레이션)')
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
