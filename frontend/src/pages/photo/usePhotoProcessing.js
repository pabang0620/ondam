import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPhotoOrderStatus } from './photoApi.js'
import { useJobSocket } from '../../hooks/useJobSocket.js'

const POLL_INTERVAL_MS = 3000

function usePhotoProcessing() {
  const navigate = useNavigate()
  const { orderId } = useParams()

  const [status, setStatus] = useState('queued')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  const intervalRef = useRef(null)
  const isMountedRef = useRef(true)
  const bullmqJobIdRef = useRef(null)

  useJobSocket({
    onProgress: (event) => {
      if (bullmqJobIdRef.current && event.jobId !== bullmqJobIdRef.current) return
      if (!isMountedRef.current) return

      setStatus(event.status)
      setProgress(event.progress ?? 0)

      if (event.status === 'completed' || event.status === 'failed') {
        clearInterval(intervalRef.current)
        if (event.status === 'completed') {
          navigate(`/photo/result/${orderId}`)
        } else {
          // FIX: 결정1(2026-08-22) - 세트 일부만 실패해도 성공한 결과물은 결과
          // 페이지에서 보여준다(SPEC-02 2절). 전량 실패면 결과 페이지가 자체적으로
          // "결과를 불러오지 못했습니다" 오류를 보여준다(usePhotoResult.js).
          navigate(`/photo/result/${orderId}`)
        }
      }
    },
  })

  useEffect(() => {
    isMountedRef.current = true

    const poll = async () => {
      if (!isMountedRef.current) return

      try {
        const { data } = await getPhotoOrderStatus(orderId)
        const { status: newStatus, progress: newProgress, jobId } = data.data

        if (!isMountedRef.current) return

        if (jobId) bullmqJobIdRef.current = jobId

        setStatus(newStatus)
        setProgress(newProgress ?? 0)

        if (newStatus === 'completed') {
          clearInterval(intervalRef.current)
          navigate(`/photo/result/${orderId}`)
        } else if (newStatus === 'failed') {
          clearInterval(intervalRef.current)
          // FIX: 결정1(2026-08-22) - 세트 일부만 실패해도 성공한 결과물은 결과
          // 페이지에서 보여준다(SPEC-02 2절). 전량 실패면 결과 페이지가 자체적으로
          // "결과를 불러오지 못했습니다" 오류를 보여준다(usePhotoResult.js).
          navigate(`/photo/result/${orderId}`)
        }
      } catch (err) {
        if (!isMountedRef.current) return
        // FIX: DEV-24 - 상태 조회 실패를 가짜 진행률로 위장해 완료 페이지로 이동시키지 않는다
        clearInterval(intervalRef.current)
        setError(
          err?.response?.data?.message ??
          '처리 상태를 확인하지 못했습니다. 잠시 후 페이지를 새로고침해 다시 시도해 주세요.',
        )
      }
    }

    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      isMountedRef.current = false
      clearInterval(intervalRef.current)
    }
  }, [orderId, navigate])

  return {
    orderId,
    status,
    progress,
    error,
  }
}

export default usePhotoProcessing
