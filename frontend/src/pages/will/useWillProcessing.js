import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { willApi } from './willApi.js'

const POLL_INTERVAL = 5000

export function useWillProcessing() {
  const navigate = useNavigate()
  const { willId } = useParams()
  const [jobStatus, setJobStatus] = useState('pending')
  const [progress, setProgress] = useState(0)
  const [pollError, setPollError] = useState(null)

  const poll = useCallback(async () => {
    if (!willId) return null
    try {
      const { data } = await willApi.getWillStatus(willId)
      const status = data.data?.jobStatus
      const prog = data.data?.progress ?? 0
      setJobStatus(status)
      setProgress(prog)
      return status
    } catch {
      setPollError('상태 확인 중 오류가 발생했습니다.')
      return null
    }
  }, [willId])

  useEffect(() => {
    let timerId

    const tick = async () => {
      const status = await poll()
      if (status === 'completed') {
        navigate('/will/vault')
        return
      }
      timerId = setTimeout(tick, POLL_INTERVAL)
    }

    tick()

    return () => {
      if (timerId) clearTimeout(timerId)
    }
  }, [poll, navigate])

  return { jobStatus, progress, pollError }
}
