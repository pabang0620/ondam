import { useState, useEffect, useCallback } from 'react'
import { adminApi } from './adminApi.js'

export function useAdminRelease() {
  const [releases, setReleases] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [documentLoadingId, setDocumentLoadingId] = useState(null)

  // FIX: 결함4 - signal 미전달로 abort()가 무효했던 문제 수정
  const fetchReleases = useCallback(async (signal) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await adminApi.getReleases(1, 20, signal)
      if (data.success) setReleases(data.data ?? [])
    } catch (err) {
      if (err.name === 'CanceledError') return
      // FIX: DEV-24 - 목록 조회 실패를 가짜 데이터로 위장하지 않는다
      setError(err?.response?.data?.message ?? '사후공개 요청 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchReleases(ac.signal)
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
      // FIX: DEV-24 - 승인 API 실패를 로컬 상태만 바꿔 성공처럼 보이게 하지 않는다
      setActionError(err?.response?.data?.message ?? '승인 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setProcessingId(null)
    }
  }

  // [보안 수정] 목록에는 사망증명서 URL이 없다. 열람을 누르는 시점에 presigned URL을
  // 새로 발급받아 새 탭으로 연다 - 팝업 차단을 피하기 위해 window.open을 클릭 핸들러
  // 안에서 동기적으로 먼저 열고, 응답이 오면 location을 채우는 방식은 axios가 비동기라
  // 팝업 차단기에 걸리기 쉬워 여기서는 발급 후 open하는 단순한 방식을 쓴다(관리자
  // 전용 화면이라 팝업 차단 UX 손실이 크지 않음).
  const handleViewDocument = async (id) => {
    setDocumentLoadingId(id)
    setActionError(null)
    try {
      const { data } = await adminApi.getReleaseDocumentUrl(id)
      const url = data?.data?.url
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        setActionError('사망증명서 URL을 발급받지 못했습니다.')
      }
    } catch (err) {
      setActionError(err?.response?.data?.message ?? '사망증명서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setDocumentLoadingId(null)
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
      // FIX: DEV-24 - 거절 API 실패를 로컬 상태만 바꿔 성공처럼 보이게 하지 않는다
      setActionError(err?.response?.data?.message ?? '거절 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.')
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
    documentLoadingId,
    handleApprove,
    handleReject,
    handleViewDocument,
    refetch: fetchReleases,
  }
}
