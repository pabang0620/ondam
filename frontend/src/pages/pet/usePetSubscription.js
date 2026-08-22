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
  // FIX: HIGH-1 - 202(불확정) 응답 전용 알림. actionError(빨간 실패 표시)와 구분해
  // "확인 중" 상태를 실패처럼 보여주지 않는다.
  const [actionNotice, setActionNotice] = useState(null)

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
      // FIX: DEV-24 - 구독 조회 실패를 가짜 구독으로 위장하지 않는다
      setError(err?.response?.data?.message ?? '구독 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
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
      // FIX: DEV-24 - 토스 SDK 실패를 구독 성공으로 위장하지 않는다
      sessionStorage.removeItem('pendingSubscriptionPlan')
      setActionError(err?.response?.data?.message ?? err?.message ?? '결제 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      setIsRedirecting(false)
    }
  }

  const handleRetryPayment = async (subscriptionId) => {
    if (isProcessing) return
    const pendingRef = { current: true }
    setIsProcessing(true)
    setActionError(null)
    setActionNotice(null)
    try {
      const res = await petApi.retryPayment(subscriptionId)
      // FIX: HIGH-1 - 백엔드가 결제 불확정 상태를 202로 응답하도록 바뀌었는데
      // res.data.success는 202에서도 true다. status(202) 또는 data.indeterminate로
      // 별도 분기하지 않으면 불확정을 "재결제 완료"로 표시하고, 실제 구독 행이 없는
      // 스텁 객체로 currentSubscription을 덮어써 상태 카드가 깨진다.
      const isIndeterminate = res.status === 202 || res.data?.data?.indeterminate === true
      if (isIndeterminate) {
        setActionNotice(
          res.data?.data?.message ?? '결제 결과를 확인하고 있어요. 잠시 후 다시 확인해 주세요.',
        )
        return
      }
      if (res.data.success) {
        setCurrentSubscription(res.data.data)
        setSuccessMessage('재결제가 완료되었습니다.')
      }
    } catch (err) {
      // FIX: DEV-24 - 재결제 실패를 성공으로 위장하지 않는다
      setActionError(err?.response?.data?.message ?? '재결제에 실패했습니다. 카드 정보를 확인한 후 다시 시도해 주세요.')
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
      // FIX: DEV-24 - 해지 API 실패를 로컬에서만 성공 처리하지 않는다 (정기결제가 실제로는 계속돼 환불 분쟁으로 이어짐)
      setActionError(err?.response?.data?.message ?? '구독 해지에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      if (pendingRef.current) {
        setIsProcessing(false)
        pendingRef.current = false
      }
    }
  }

  const clearSuccessMessage = () => setSuccessMessage(null)
  const clearActionNotice = () => setActionNotice(null)

  return {
    plans,
    currentSubscription,
    isLoading,
    error,
    isProcessing,
    isRedirecting,
    actionError,
    actionNotice,
    isCancelModalOpen,
    successMessage,
    handleSubscribe,
    handleRetryPayment,
    openCancelModal,
    closeCancelModal,
    confirmCancel,
    clearSuccessMessage,
    clearActionNotice,
    refetch: fetchData,
  }
}
