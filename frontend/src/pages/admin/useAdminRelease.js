import { useState, useEffect, useCallback } from 'react'
import { adminApi } from './adminApi.js'

export function useAdminRelease() {
  const [releases, setReleases] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const fetchReleases = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await adminApi.getReleases()
      if (data.success) setReleases(data.data ?? [])
    } catch (err) {
      setError(err.response?.data?.message || '목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchReleases()
    return () => ac.abort()
  }, [fetchReleases])

  const handleApprove = async (id) => {
    if (processingId) return
    setProcessingId(id)
    setActionError(null)
    try {
      await adminApi.approveRelease(id)
      setReleases((prev) =>
        prev.map((r) => r.releaseId === id ? { ...r, status: 'approved' } : r),
      )
    } catch (err) {
      setActionError(err.response?.data?.message || '승인 처리에 실패했습니다.')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (id, reason) => {
    if (processingId) return
    setProcessingId(id)
    setActionError(null)
    try {
      await adminApi.rejectRelease(id, reason)
      setReleases((prev) =>
        prev.map((r) => r.releaseId === id ? { ...r, status: 'rejected' } : r),
      )
    } catch (err) {
      setActionError(err.response?.data?.message || '거절 처리에 실패했습니다.')
    } finally {
      setProcessingId(null)
    }
  }

  return {
    releases,
    isLoading,
    error,
    processingId,
    actionError,
    handleApprove,
    handleReject,
    refetch: fetchReleases,
  }
}
