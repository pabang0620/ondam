import { useState, useEffect, useCallback, useRef } from 'react'
import { petApi } from './petApi.js'
import { getSubscriptionSummary } from './subscriptionLabels.js'

const FETCH_ERROR_MESSAGE = '구독 정보를 불러오지 못했습니다.'

// 내 구독 목록을 받아 반려동물 화면용 요약으로 돌려준다.
// summary: { kind, subscription, planKey, planName, isArchive, hasArchiveBenefits }
//  - kind: 청구 상태(plan 무관) 'free'|'active'|'past_due'|'suspended'|'unknown'
//  - planKey/planName: 구독의 plan 키 / 표시명(모르는 plan 은 '이전 요금제', free 는 null/'무료')
//  - isArchive: pet_archive 여부, hasArchiveBenefits: 서버 혜택 판정과 같은 규칙(pet_archive + active/past_due)
// enabled=false 면 호출하지 않고 isLoading=false. enabled 가 true 로 바뀌는 순간에도
// isLoading 이 true 로 계산되도록 settled 플래그로 파생해 깜빡임을 막는다.
export function useMySubscription({ enabled = true } = {}) {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [settled, setSettled] = useState(false)
  // 재조회 실패로 summary 가 최신이 아닐 수 있음(직전 summary 는 유지한다).
  const [isStale, setIsStale] = useState(false)

  const silentAcRef = useRef(null)
  const summaryRef = useRef(null)
  // 요청 순번 가드: 가장 마지막에 시작한 요청의 결과만 상태에 반영한다.
  const requestSeqRef = useRef(0)

  const applySummary = useCallback((next) => {
    summaryRef.current = next
    setSummary(next)
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    const ac = new AbortController()
    const seq = ++requestSeqRef.current
    const load = async () => {
      setSettled(false)
      setError(null)
      try {
        const { data } = await petApi.getMySubscription(ac.signal)
        if (!data?.success) throw new Error(FETCH_ERROR_MESSAGE)
        if (ac.signal.aborted || seq !== requestSeqRef.current) return
        applySummary(getSubscriptionSummary(data.data))
        setIsStale(false)
        setSettled(true)
      } catch (err) {
        if (err.name === 'CanceledError' || ac.signal.aborted || seq !== requestSeqRef.current) return
        applySummary(null)
        setError(err?.response?.data?.message ?? FETCH_ERROR_MESSAGE)
        setSettled(true)
      }
    }
    load()
    return () => {
      ac.abort()
      silentAcRef.current?.abort()
    }
  }, [enabled, applySummary])

  // 해지/재결제 성공 후 호출. isLoading 을 켜지 않아(스켈레톤 교체 없이) 화면이 깜빡이지 않는다.
  // 실패(429 포함)해도 직전 summary 를 지우지 않고 isStale 만 켠다.
  // summary 가 한 번도 없었다면(초기 조회 미완료/실패) 기존대로 error 로 전환한다.
  const refetch = useCallback(async () => {
    if (!enabled) return
    silentAcRef.current?.abort()
    const ac = new AbortController()
    silentAcRef.current = ac
    const seq = ++requestSeqRef.current
    try {
      const { data } = await petApi.getMySubscription(ac.signal)
      if (!data?.success) throw new Error(FETCH_ERROR_MESSAGE)
      if (ac.signal.aborted || seq !== requestSeqRef.current) return
      applySummary(getSubscriptionSummary(data.data))
      setError(null)
      setIsStale(false)
      setSettled(true)
    } catch (err) {
      if (err.name === 'CanceledError' || ac.signal.aborted || seq !== requestSeqRef.current) return
      if (summaryRef.current) {
        setIsStale(true)
      } else {
        setError(err?.response?.data?.message ?? FETCH_ERROR_MESSAGE)
      }
      setSettled(true)
    } finally {
      if (silentAcRef.current === ac) silentAcRef.current = null
    }
  }, [enabled, applySummary])

  return { summary, isLoading: enabled && !settled, error, isStale, refetch }
}
