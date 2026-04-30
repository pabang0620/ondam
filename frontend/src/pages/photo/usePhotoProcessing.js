import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPhotoOrderStatus } from './photoApi.js'
import { useJobSocket } from '../../hooks/useJobSocket.js'

const POLL_INTERVAL_MS = 3000

// mock 처리 시뮬레이션: 총 6초에 걸쳐 0 → 100% 진행 후 result 페이지로 이동
const MOCK_STEP_MS = 600
const MOCK_STEPS = 10

function usePhotoProcessing() {
  const navigate = useNavigate()
  const { orderId } = useParams()

  const [status, setStatus] = useState('queued')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  const intervalRef = useRef(null)
  const isMountedRef = useRef(true)
  const bullmqJobIdRef = useRef(null)
  const mockModeRef = useRef(false)

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
          setError('사진 처리에 실패했습니다. 다시 시도해 주세요.')
        }
      }
    },
  })

  useEffect(() => {
    isMountedRef.current = true

    const startMockProgress = () => {
      if (mockModeRef.current) return
      mockModeRef.current = true
      let step = 0
      setStatus('running')

      intervalRef.current = setInterval(() => {
        if (!isMountedRef.current) {
          clearInterval(intervalRef.current)
          return
        }
        step += 1
        const newProgress = Math.min(step * (100 / MOCK_STEPS), 100)
        setProgress(newProgress)

        if (step >= MOCK_STEPS) {
          clearInterval(intervalRef.current)
          setStatus('completed')
          setProgress(100)
          navigate(`/photo/result/${orderId}`)
        }
      }, MOCK_STEP_MS)
    }

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
          setError('사진 처리에 실패했습니다. 다시 시도해 주세요.')
        }
      } catch (err) {
        if (!isMountedRef.current) return
        console.warn('[mock] getPhotoOrderStatus 실패, mock 진행 시뮬레이션 시작:', err)
        clearInterval(intervalRef.current)
        startMockProgress()
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
