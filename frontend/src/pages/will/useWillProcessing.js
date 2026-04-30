import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { willApi } from './willApi.js'
import { useJobSocket } from '../../hooks/useJobSocket.js'

const POLL_INTERVAL = 5000

export function useWillProcessing() {
  const navigate = useNavigate()
  const { willId } = useParams()
  const [jobStatus, setJobStatus] = useState('pending')
  const [progress, setProgress] = useState(0)
  const [pollError, setPollError] = useState(null)

  const timerRef = useRef(null)
  const bullmqJobIdRef = useRef(null)
  const isMountedRef = useRef(true)

  useJobSocket({
    onProgress: (event) => {
      if (bullmqJobIdRef.current && event.jobId !== bullmqJobIdRef.current) return
      if (!isMountedRef.current) return

      setJobStatus(event.status)
      setProgress(event.progress ?? 0)

      if (event.status === 'completed') {
        clearTimeout(timerRef.current)
        navigate('/will/vault')
      } else if (event.status === 'failed') {
        clearTimeout(timerRef.current)
        setPollError('영상 생성에 실패했습니다.')
      }
    },
  })

  const poll = useCallback(async () => {
    if (!willId) return null
    try {
      const { data } = await willApi.getWillStatus(willId)
      const status = data.data?.job?.jobStatus
      const prog = data.data?.job?.progress ?? 0
      const jobId = data.data?.job?.jobId

      if (jobId) bullmqJobIdRef.current = jobId

      setJobStatus(status)
      setProgress(prog)
      return status
    } catch (err) {
      console.warn('[mock] 상태 폴링 API 실패 — mock 처리 중 상태 유지', err)
      return 'mock_pending'
    }
  }, [willId])

  useEffect(() => {
    isMountedRef.current = true

    const tick = async () => {
      if (!isMountedRef.current) return
      const status = await poll()
      if (status === 'completed') {
        navigate('/will/vault')
        return
      }
      // mock 환경: 첫 폴링이 mock_pending이면 3초 후 완료로 간주
      if (status === 'mock_pending') {
        setJobStatus('processing')
        setProgress(60)
        timerRef.current = setTimeout(() => {
          if (!isMountedRef.current) return
          setJobStatus('completed')
          setProgress(100)
          navigate('/will/vault')
        }, 3000)
        return
      }
      if (isMountedRef.current) {
        timerRef.current = setTimeout(tick, POLL_INTERVAL)
      }
    }

    tick()

    return () => {
      isMountedRef.current = false
      clearTimeout(timerRef.current)
    }
  }, [poll, navigate])

  return { jobStatus, progress, pollError }
}
