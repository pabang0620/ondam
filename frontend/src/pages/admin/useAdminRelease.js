import { useState, useEffect, useCallback, useRef } from 'react'
import { adminApi } from './adminApi.js'

export const RELEASE_PAGE_LIMIT = 20

export function useAdminRelease() {
  const [releases, setReleases] = useState([])
  // FE-GMA-13: 1페이지 20건 고정이라 21번째 요청부터는 화면에서 보이지 않았다.
  // useAdminOrders.js와 같은 page/total 패턴으로 페이지를 넘길 수 있게 한다.
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [documentLoadingId, setDocumentLoadingId] = useState(null)
  // FE-GMA-6: processingId(state)는 다음 렌더 전까지 반영되지 않아 연타를 못 막는다 - ref로 즉시 잠근다.
  const processingRef = useRef(false)

  // FIX: 결함4 - signal 미전달로 abort()가 무효했던 문제 수정
  const fetchReleases = useCallback(async (p, signal) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await adminApi.getReleases(p, RELEASE_PAGE_LIMIT, signal)
      if (data.success) {
        setReleases(data.data ?? [])
        setTotal(data.meta?.total ?? 0)
      }
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
    fetchReleases(page, ac.signal)
    return () => ac.abort()
  }, [fetchReleases, page])

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
  }

  // FE-GMA-13: 처리 후에는 로컬 상태만 고치지 않고 서버 목록을 다시 받아 실제 상태를 보여준다.
  const runAction = async (id, action, fallbackMessage) => {
    if (processingRef.current) return
    processingRef.current = true
    setProcessingId(id)
    setActionError(null)
    try {
      await action()
      await fetchReleases(page)
    } catch (err) {
      // FIX: DEV-24 - API 실패를 로컬 상태만 바꿔 성공처럼 보이게 하지 않는다
      setActionError(err?.response?.data?.message ?? fallbackMessage)
    } finally {
      setProcessingId(null)
      processingRef.current = false
    }
  }

  const handleApprove = (id) => runAction(
    id,
    () => adminApi.approveRelease(id),
    '승인 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  )

  const handleReject = (id, reason) => runAction(
    id,
    () => adminApi.rejectRelease(id, reason),
    '거절 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  )

  // [보안 수정] 목록에는 사망증명서 URL이 없다. 열람을 누르는 시점에 presigned URL을
  // 새로 발급받아 새 탭으로 연다.
  // FIX(팝업 차단): 발급(await) 뒤에 window.open을 부르면 사용자 클릭과 분리돼 팝업
  // 차단기에 막힌다. 클릭 핸들러 안에서 동기적으로 빈 창을 먼저 연 뒤 URL을 채운다.
  // 'noopener'를 주면 window.open이 null을 돌려줘 URL을 채울 수 없으므로, 대신 새 창의
  // opener를 직접 끊는다.
  const handleViewDocument = async (id) => {
    if (documentLoadingId) return
    const popup = window.open('about:blank', '_blank')
    if (!popup) {
      setActionError('팝업이 차단되어 사망증명서를 열 수 없습니다. 브라우저에서 이 사이트의 팝업을 허용해 주세요.')
      return
    }
    try {
      popup.opener = null
    } catch {
      // 일부 브라우저는 opener 재지정을 막는다 - 무시해도 URL 할당에는 영향 없음
    }
    setDocumentLoadingId(id)
    setActionError(null)
    try {
      const { data } = await adminApi.getReleaseDocumentUrl(id)
      const url = data?.data?.url
      if (url) {
        popup.location.href = url
      } else {
        popup.close()
        setActionError('사망증명서 URL을 발급받지 못했습니다.')
      }
    } catch (err) {
      popup.close()
      setActionError(err?.response?.data?.message ?? '사망증명서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setDocumentLoadingId(null)
    }
  }

  return {
    releases,
    page,
    total,
    isLoading,
    error,
    processingId,
    actionError,
    documentLoadingId,
    handlePageChange,
    handleApprove,
    handleReject,
    handleViewDocument,
    refetch: () => fetchReleases(page),
  }
}
