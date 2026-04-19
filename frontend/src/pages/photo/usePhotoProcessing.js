import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPhotoOrderStatus } from './photoApi.js'

const POLL_INTERVAL_MS = 3000

function usePhotoProcessing() {
  const navigate = useNavigate()
  const { orderId } = useParams()

  const [status, setStatus] = useState('queued')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  const intervalRef = useRef(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    const poll = async () => {
      if (!isMountedRef.current) return

      try {
        const { data } = await getPhotoOrderStatus(orderId)
        const { status: newStatus, progress: newProgress } = data.data

        if (!isMountedRef.current) return

        setStatus(newStatus)
        setProgress(newProgress ?? 0)

        if (newStatus === 'completed') {
          clearInterval(intervalRef.current)
          navigate(`/photo/result/${orderId}`)
        } else if (newStatus === 'failed') {
          clearInterval(intervalRef.current)
          setError('사진 처리에 실패했습니다. 다시 시도해 주세요.')
        }
      } catch (err) {
        if (!isMountedRef.current) return
        setError('처리 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.')
        clearInterval(intervalRef.current)
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
