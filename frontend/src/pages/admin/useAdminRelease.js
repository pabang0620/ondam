import { useState, useEffect, useCallback } from 'react'
import { adminApi } from './adminApi.js'

const PLACEHOLDER = 'https://picsum.photos/seed/document-sample/600/800'

const MOCK_RELEASES = [
  {
    releaseId: 'mock-rel-001',
    willId: 'will-uuid-001',
    requesterName: '김민수',
    requesterEmail: 'minsu@example.com',
    deathCertificateUrl: PLACEHOLDER,
    status: 'pending',
    createdAt: '2026-04-20T10:00:00.000Z',
  },
  {
    releaseId: 'mock-rel-002',
    willId: 'will-uuid-002',
    requesterName: '이지혜',
    requesterEmail: 'jihye@example.com',
    deathCertificateUrl: PLACEHOLDER,
    status: 'pending',
    createdAt: '2026-04-25T13:30:00.000Z',
  },
  {
    releaseId: 'mock-rel-003',
    willId: 'will-uuid-003',
    requesterName: '박동현',
    requesterEmail: 'donghyun@example.com',
    deathCertificateUrl: PLACEHOLDER,
    status: 'pending',
    createdAt: '2026-04-28T09:15:00.000Z',
  },
]

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
      const { data } = await adminApi.getReleases(1, 20)
      if (data.success) setReleases(data.data ?? [])
    } catch (err) {
      console.warn('[mock] 공개 요청 목록 API 실패 - mock 데이터로 대체합니다', err)
      setReleases(MOCK_RELEASES)
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
      console.warn('[mock] 승인 API 실패 - 로컬 상태에서 처리합니다', err)
      setReleases((prev) =>
        prev.map((r) => r.releaseId === id ? { ...r, status: 'approved' } : r),
      )
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
      console.warn('[mock] 거절 API 실패 - 로컬 상태에서 처리합니다', err)
      setReleases((prev) =>
        prev.map((r) => r.releaseId === id ? { ...r, status: 'rejected' } : r),
      )
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
