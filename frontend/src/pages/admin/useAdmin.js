import { useState, useEffect, useCallback } from 'react'
import { adminApi } from './adminApi.js'

export function useAdmin() {
  const [stats, setStats] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await adminApi.getDashboard()
      if (data.success) setStats(data.data)
    } catch (err) {
      setError(err.response?.data?.message || '대시보드 정보를 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchDashboard()
    return () => ac.abort()
  }, [fetchDashboard])

  return { stats, isLoading, error, refetch: fetchDashboard }
}
