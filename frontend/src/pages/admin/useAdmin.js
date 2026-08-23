import { useState, useEffect, useCallback } from 'react'
import { adminApi } from './adminApi.js'

export function useAdmin() {
  const [stats, setStats] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // FIX: 결함4 - AbortController를 만들고 cleanup에서 abort()까지 했지만 signal을
  // axios 호출에 전달하지 않아 아무 효과가 없었다. signal을 실제로 전달하고,
  // 취소된 요청(CanceledError)은 사용자에게 에러로 보이지 않도록 무시한다.
  const fetchDashboard = useCallback(async (signal) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await adminApi.getDashboard(signal)
      if (data.success) setStats(data.data)
    } catch (err) {
      if (err.name === 'CanceledError') return
      // FIX: DEV-24 - 대시보드 조회 실패를 가짜 통계로 위장하지 않는다
      setError(err?.response?.data?.message ?? '대시보드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      // FIX: 결함4 - 취소된 요청의 finally가 새 요청의 로딩 상태를 덮어쓰지 않게 한다
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchDashboard(ac.signal)
    return () => ac.abort()
  }, [fetchDashboard])

  return { stats, isLoading, error, refetch: fetchDashboard }
}
