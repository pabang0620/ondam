import { useState, useEffect, useCallback } from 'react'
import { petApi } from './petApi.js'

export function usePetSubscription() {
  const [plans, setPlans] = useState([])
  const [currentSubscription, setCurrentSubscription] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionError, setActionError] = useState(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [plansRes, subRes] = await Promise.all([
        petApi.getSubscriptionPlans(),
        petApi.getMySubscription(),
      ])
      if (plansRes.data.success) setPlans(plansRes.data.data ?? [])
      if (subRes.data.success) setCurrentSubscription(subRes.data.data ?? null)
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

  const handleSubscribe = async (plan) => {
    if (isProcessing) return
    setIsProcessing(true)
    setActionError(null)
    try {
      const res = await petApi.subscribe(plan)
      if (res.data.success) {
        setCurrentSubscription(res.data.data)
      }
    } catch (err) {
      setActionError(err.response?.data?.message || '구독 신청에 실패했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = async (subscriptionId) => {
    if (isProcessing) return
    setIsProcessing(true)
    setActionError(null)
    try {
      await petApi.cancelSubscription(subscriptionId)
      setCurrentSubscription(null)
    } catch (err) {
      setActionError(err.response?.data?.message || '구독 해지에 실패했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    plans,
    currentSubscription,
    isLoading,
    error,
    isProcessing,
    actionError,
    handleSubscribe,
    handleCancel,
  }
}
