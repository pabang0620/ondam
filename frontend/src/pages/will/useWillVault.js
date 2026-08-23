import { useState, useEffect, useCallback } from 'react'
import { willApi } from './willApi.js'

export function useWillVault() {
  const [wills, setWills] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  // FIX: 결함4 - signal 미전달로 abort()가 무효했던 문제 수정
  const fetchWills = useCallback(async (signal) => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const { data } = await willApi.getWills(signal)
      setWills(data.data || [])
    } catch (err) {
      if (err.name === 'CanceledError') return
      // FIX: DEV-24 - 목록 조회 실패를 가짜 유언장으로 위장하지 않는다
      setFetchError(err?.response?.data?.message ?? '영상 편지 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchWills(ac.signal)
    return () => ac.abort()
  }, [fetchWills])

  return { wills, isLoading, fetchError, refetch: fetchWills }
}
