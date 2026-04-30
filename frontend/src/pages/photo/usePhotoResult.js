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
        console.warn('[mock] getPhotoOrderResult 실패, mock 결과 데이터 적용:', err)
        setOrder({
          order_id: orderId ?? 'mock-photo-001',
          photo_type: 'funeral',
          status: 'completed',
          price_krw: 9900,
        })
        setFiles([
          {
            file_id: 'mock-file-raw-001',
            kind: 'raw',
            s3_key: 'photos/mock-user/mock-job/raw.jpg',
            fileUrl: 'https://picsum.photos/seed/old-photo/600/800?grayscale',
          },
          {
            file_id: 'mock-file-enhanced-001',
            kind: 'enhanced',
            s3_key: 'photos/mock-user/mock-job/enhanced.jpg',
            fileUrl: 'https://picsum.photos/seed/restored-photo/600/800',
          },
        ])
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
    setError(null)

    try {
      await retryPhotoOrder(orderId)
      navigate(`/photo/processing/${orderId}`)
    } catch (err) {
      console.warn('[mock] retryPhotoOrder 실패, mock 재처리 흐름으로 진행:', err)
      navigate(`/photo/processing/${orderId}`)
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
    handleDownload,
    handleRetry,
    handleShare,
  }
}

export default usePhotoResult
