import { useState, useEffect, useCallback } from 'react'
import { adminApi } from './adminApi.js'

const MOCK_STATS = {
  totalUsers: 1247,
  processingPhotos: 312,
  pendingReleases: 3,
  failedJobs: 8,
}

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
      console.warn('[mock] 관리자 대시보드 API 실패 - mock 데이터로 대체합니다', err)
      setStats(MOCK_STATS)
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
