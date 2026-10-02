import { useState, useEffect, useCallback, useRef } from 'react'
import { petApi } from './petApi.js'
import { isSubscriptionLive } from './subscriptionLabels.js'
import { getTossPayments } from '../../lib/tossPayments.js'
import { useAuthStore } from '../../store/authStore.js'

// 해지되지 않은 첫 항목(isSubscriptionLive 재사용), 없으면 첫 항목.
function pickSubscription(list) {
  if (!Array.isArray(list)) return null
  return list.find(isSubscriptionLive) ?? list[0] ?? null
}

// 옵션(모두 선택, 기본값은 기존 동작)
// - refreshAfterAction (true): 해지/재결제 성공 후 훅이 직접 목록을 재조회한다.
//   부모가 따로 재조회하는 대시보드는 false 로 두어 GET /subscriptions 중복을 막는다.
// - skipInitialFetch (false): 마운트 시 플랜/구독 조회를 생략한다(대시보드 인라인 카드용).
// - initialSubscription (null): 조회를 생략할 때 해지 직후 로컬 표시에 쓰는 초기 구독.
export function usePetSubscription({
  refreshAfterAction = true,
  skipInitialFetch = false,
  initialSubscription = null,
} = {}) {
  const user = useAuthStore((s) => s.user)

  // FIX: ep-006 - 렌더마다 새로 만들어지는 `{ current: false }` 리터럴은 ref가
  // 아니라 죽은 가드였다. 재결제/해지는 서로 다른 버튼이라 별도 ref로 분리한다.
  const retryPendingRef = useRef(false)
  const cancelPendingRef = useRef(false)

  const [plans, setPlans] = useState([])
  const [currentSubscription, setCurrentSubscription] = useState(initialSubscription)
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

  // FIX: 결함4 - signal 미전달로 abort()가 무효했던 문제 수정
  const fetchData = useCallback(async (signal) => {
    setIsLoading(true)
    setError(null)
    try {
      const [plansRes, subRes] = await Promise.all([
        petApi.getSubscriptionPlans(signal),
        petApi.getMySubscription(signal),
      ])
      if (plansRes.data.success) setPlans(plansRes.data.data ?? [])
      if (subRes.data.success) setCurrentSubscription(pickSubscription(subRes.data.data))
    } catch (err) {
      if (err.name === 'CanceledError') return
      // FIX: DEV-24 - 구독 조회 실패를 가짜 구독으로 위장하지 않는다
      setError(err?.response?.data?.message ?? '구독 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [])

  // 성공 후 재조회용 컨트롤러. 언마운트 시 함께 abort 한다.
  const refreshAcRef = useRef(null)

  useEffect(() => {
    const ac = new AbortController()
    if (!skipInitialFetch) fetchData(ac.signal)
    return () => {
      ac.abort()
      refreshAcRef.current?.abort()
    }
  }, [fetchData, skipInitialFetch])

  // 서버 목록을 정본으로 다시 조회한다 (스텁 응답으로 상태를 덮어쓰지 않기 위함).
  const refreshFromServer = useCallback(() => {
    refreshAcRef.current?.abort()
    const ac = new AbortController()
    refreshAcRef.current = ac
    return fetchData(ac.signal)
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
    // FIX: ep-006 - isProcessing state 체크만으로는 연타 시 두 클릭이 같은
    // 렌더의 stale 클로저를 참조해 둘 다 통과할 수 있다. useRef 동기 락으로 보강.
    if (isProcessing || retryPendingRef.current) return
    retryPendingRef.current = true
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
        setSuccessMessage('재결제가 완료되었습니다.')
        if (refreshAfterAction) await refreshFromServer()
      }
    } catch (err) {
      // FIX: DEV-24 - 재결제 실패를 성공으로 위장하지 않는다
      setActionError(err?.response?.data?.message ?? '재결제에 실패했습니다. 카드 정보를 확인한 후 다시 시도해 주세요.')
    } finally {
      setIsProcessing(false)
      retryPendingRef.current = false
    }
  }

  const openCancelModal = () => setIsCancelModalOpen(true)
  const closeCancelModal = () => setIsCancelModalOpen(false)

  const confirmCancel = async (subscriptionId) => {
    if (isProcessing || cancelPendingRef.current) return
    cancelPendingRef.current = true
    setIsProcessing(true)
    setActionError(null)
    try {
      await petApi.cancelSubscription(subscriptionId)
      setCurrentSubscription((prev) =>
        prev ? { ...prev, subStatus: 'canceled' } : null,
      )
      setIsCancelModalOpen(false)
      setSuccessMessage('구독이 해지되었습니다.')
      if (refreshAfterAction) await refreshFromServer()
    } catch (err) {
      // FIX: DEV-24 - 해지 API 실패를 로컬에서만 성공 처리하지 않는다 (정기결제가 실제로는 계속돼 환불 분쟁으로 이어짐)
      setActionError(err?.response?.data?.message ?? '구독 해지에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsProcessing(false)
      cancelPendingRef.current = false
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
