import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPhotoOrderResult, retryPhotoOrder } from './photoApi.js'

function usePhotoResult() {
  const navigate = useNavigate()
  const { orderId } = useParams()

  const [order, setOrder] = useState(null)
  const [files, setFiles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)
  const [error, setError] = useState(null)
  const [retryError, setRetryError] = useState(null)

  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    const ac = new AbortController()

    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const { data } = await getPhotoOrderResult(orderId, ac.signal)
        if (!isMountedRef.current || ac.signal.aborted) return
        setOrder(data.data.order)
        setFiles(data.data.files ?? [])
      } catch (err) {
        if (!isMountedRef.current || ac.signal.aborted) return
        // FIX: DEV-24 - 결과 조회 실패를 가짜 사진으로 위장하지 않는다
        // FE-PP-7: 서버 메시지(영문·내부 문구일 수 있음)를 그대로 보이지 않고 고정 한국어로 안내한다.
        // 400은 결과물이 한 장도 만들어지지 않은(전량 실패) 경우다.
        setError(
          err?.response?.status === 400
            ? '만들어진 결과물이 없어 보여드릴 수 없습니다. 마이페이지에서 주문 상태를 확인해 주세요.'
            : '결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        )
      } finally {
        if (isMountedRef.current && !ac.signal.aborted) setIsLoading(false)
      }
    }

    load()

    return () => {
      isMountedRef.current = false
      ac.abort()
    }
  }, [orderId])

  const rawFile = files.find((f) => f.kind === 'raw')
  // FIX: 결정1(2026-08-22) - 9,900원 주문 1건은 세트 4종(용도별로 다를 수 있음)을
  // 반환한다. 기존에는 .find()로 1장만 골라 나머지가 화면에서 사라졌다.
  const enhancedFiles = files.filter((f) => f.kind === 'enhanced')
  // SPEC-02 2절: 세트 일부만 실패해도 성공분은 제공한다. 이 경우 order.status는
  // 'failed'(전액 환불 대상)이지만 enhancedFiles는 1장 이상 존재할 수 있다.
  const isPartialFailure = order?.status === 'failed' && enhancedFiles.length > 0

  // FE-PP-7: 재처리는 주문이 실패 상태일 때만 요청할 수 있다
  const canRetry = order?.status === 'failed'

  const handleDownload = useCallback((fileUrl, fileName) => {
    const a = document.createElement('a')
    a.href = fileUrl
    a.download = fileName ?? 'ondam_photo.jpg'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  // 전체 저장 - 별도 zip 생성 백엔드 없이, 개별 다운로드를 순차 트리거한다.
  // FE-PP-3: 두 번째 이후 다운로드는 사용자 클릭 밖(setTimeout)에서 일어나 브라우저가
  // 막을 수 있다. 막혔을 때 할 일을 화면에 안내하고, 연타로 중복 저장되지 않게 막는다.
  const [isDownloadingAll, setIsDownloadingAll] = useState(false)
  const [downloadNotice, setDownloadNotice] = useState(null)
  const downloadAllTimersRef = useRef([])

  useEffect(() => () => {
    downloadAllTimersRef.current.forEach(clearTimeout)
  }, [])

  const handleDownloadAll = useCallback(() => {
    if (isDownloadingAll) return
    setIsDownloadingAll(true)
    setDownloadNotice(null)
    downloadAllTimersRef.current.forEach(clearTimeout)

    const timers = enhancedFiles.map((file, idx) =>
      setTimeout(() => {
        handleDownload(file.file_url, `ondam_${file.variantKey ?? idx + 1}.jpg`)
      }, idx * 400),
    )
    timers.push(
      setTimeout(() => {
        if (!isMountedRef.current) return
        setIsDownloadingAll(false)
        setDownloadNotice(
          '저장이 막히면 사진별 저장 버튼을 눌러 주세요. iPhone은 사진을 길게 눌러 저장할 수 있어요.',
        )
      }, enhancedFiles.length * 400),
    )
    downloadAllTimersRef.current = timers
  }, [enhancedFiles, handleDownload, isDownloadingAll])

  const handleRetry = useCallback(async () => {
    if (isRetrying || !canRetry) return

    setIsRetrying(true)
    setRetryError(null)

    try {
      await retryPhotoOrder(orderId)
      navigate(`/photo/processing/${orderId}`)
    } catch (err) {
      // FIX: DEV-24 - 재처리 요청 실패를 성공한 것처럼 처리 페이지로 이동시키지 않는다
      setRetryError(err?.response?.data?.message ?? '재처리 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsRetrying(false)
    }
  }, [orderId, isRetrying, canRetry, navigate])

  // FE-PP-10(D7): 결과 페이지는 로그인한 주문자만 열 수 있어 링크를 받은 사람은
  // 사진을 볼 수 없다 - "공유" 기능을 제거했다.

  return {
    orderId,
    order,
    rawFile,
    enhancedFiles,
    isPartialFailure,
    canRetry,
    isLoading,
    isRetrying,
    isDownloadingAll,
    downloadNotice,
    error,
    retryError,
    handleDownload,
    handleDownloadAll,
    handleRetry,
  }
}

export default usePhotoResult
