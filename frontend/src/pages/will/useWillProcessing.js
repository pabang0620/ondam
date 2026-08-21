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
      // FIX: DEV-24 - 폴링 실패를 가짜 처리 완료로 위장하지 않는다
      return 'poll_failed'
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
      if (status === 'poll_failed') {
        setPollError('처리 상태를 확인하지 못했습니다. 잠시 후 페이지를 새로고침해 다시 시도해 주세요.')
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
