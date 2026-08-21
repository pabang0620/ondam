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
        const { data } = await getPhotoOrderResult(orderId)
        if (!isMountedRef.current) return
        setOrder(data.data.order)
        setFiles(data.data.files ?? [])
      } catch (err) {
        if (!isMountedRef.current || ac.signal.aborted) return
        // FIX: DEV-24 - 결과 조회 실패를 가짜 사진으로 위장하지 않는다
        setError(err?.response?.data?.message ?? '결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      } finally {
        if (isMountedRef.current) setIsLoading(false)
      }
    }

    load()

    return () => {
      isMountedRef.current = false
      ac.abort()
    }
  }, [orderId])

  const rawFile = files.find((f) => f.kind === 'raw')
  const enhancedFile = files.find((f) => f.kind === 'enhanced')

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

  const handleRetry = useCallback(async () => {
    if (isRetrying) return

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
  }, [orderId, isRetrying, navigate])

  const handleShare = useCallback(async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: '온담 AI 사진관',
          text: '소중한 사진을 AI로 복원했습니다.',
          url,
        })
      } catch {
        // 사용자가 공유 취소 - 무시
      }
    } else {
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        // 클립보드 접근 실패 시 조용히 무시
      }
    }
  }, [])

  return {
    orderId,
    order,
    rawFile,
    enhancedFile,
    isLoading,
    isRetrying,
    error,
    retryError,
    handleDownload,
    handleRetry,
    handleShare,
  }
}

export default usePhotoResult
