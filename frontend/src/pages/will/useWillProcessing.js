import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { willApi } from './willApi.js'
import { useJobSocket } from '../../hooks/useJobSocket.js'

const POLL_INTERVAL = 5000

// 죽음/실패를 알리는 안내는 감정적으로 취약한 사용자가 보는 화면이므로, "실패했다"로만
// 끝내지 않고 다음에 뭘 해야 하는지(환불됨/재시도 가능)까지 함께 안내한다.
const DEFAULT_FAILURE_MESSAGE =
  '죄송합니다. 영상 편지 생성에 실패했습니다. 결제하신 금액은 자동으로 환불 처리되며, 자세한 안내는 알림함에서 확인하실 수 있어요.'

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
        // 소켓 이벤트에는 errorMessage가 실려오지 않는다(job:progress emit payload는
        // jobId/jobType/status/progress/resultUrl뿐) - 폴링(poll())이 뒤이어
        // GET .../status로 안전한 사유(job.errorMessage)까지 채워 넣는다.
        clearTimeout(timerRef.current)
        setPollError((prev) => prev ?? DEFAULT_FAILURE_MESSAGE)
      }
    },
  })

  const poll = useCallback(async () => {
    if (!willId) return null
    try {
      const { data } = await willApi.getWillStatus(willId)
      const job = data.data?.job
      const status = job?.jobStatus
      const prog = job?.progress ?? 0
      const jobId = job?.jobId

      if (jobId) bullmqJobIdRef.current = jobId

      setJobStatus(status)
      setProgress(prog)

      // FIX: 결함3(영상편지 폴링 버전) - 기존에는 'failed'가 poll()의 반환값으로
      // 나가긴 했지만 tick()의 분기(completed/poll_failed)에 걸리지 않아 setTimeout이
      // 계속 예약됐다. 실패해도 폴링이 절대 멈추지 않아 "영상을 생성하고 있습니다"
      // 화면이 무한히 유지되는, 사진관과 동일한 결함이 영상편지 쪽에도 있었다.
      // job.errorMessage는 willService.getVideoStatus가 toSafeFailureMessage로
      // 이미 안전하게 치환한 문구다(벤더 원문·환경변수명이 새지 않음).
      if (status === 'failed') {
        setPollError(job?.errorMessage ?? DEFAULT_FAILURE_MESSAGE)
      }

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
      if (status === 'failed') {
        // pollError는 poll() 내부에서 이미 설정됐다 - 더 이상 폴링하지 않는다.
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
