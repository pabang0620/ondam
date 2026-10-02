import { useState, useEffect } from 'react'
import { petApi } from './petApi.js'
import { ARCHIVE_PLAN } from './subscriptionLabels.js'

const FETCH_ERROR_MESSAGE = '요금 정보를 불러오지 못했습니다.'

// 플랜 목록(GET /subscriptions/plans)에서 아카이브 요금(원)을 읽는다.
// 가격 정본은 서버다(하드코딩 금지). enabled=false 면 조회하지 않고 isLoading=false.
// enabled 가 true 로 바뀌는 순간에도 isLoading 이 true 로 계산되도록 settled 로 파생한다.
export function useArchivePlanPrice({ enabled = true } = {}) {
  const [priceKrw, setPriceKrw] = useState(null)
  const [error, setError] = useState(null)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (!enabled) return undefined
    const ac = new AbortController()
    const load = async () => {
      setSettled(false)
      setError(null)
      try {
        const { data } = await petApi.getSubscriptionPlans(ac.signal)
        if (ac.signal.aborted) return
        const list = Array.isArray(data?.data) ? data.data : []
        const item = list.find((p) => p?.plan === ARCHIVE_PLAN || p?.key === ARCHIVE_PLAN)
        const price = Number(item?.priceKrw ?? item?.price_krw)
        if (!data?.success || !Number.isFinite(price) || price <= 0) {
          throw new Error(FETCH_ERROR_MESSAGE)
        }
        setPriceKrw(price)
        setSettled(true)
      } catch (err) {
        if (err?.name === 'CanceledError' || ac.signal.aborted) return
        setPriceKrw(null)
        setError(err?.response?.data?.message ?? FETCH_ERROR_MESSAGE)
        setSettled(true)
      }
    }
    load()
    return () => ac.abort()
  }, [enabled])

  return { priceKrw, isLoading: enabled && !settled, error }
}
