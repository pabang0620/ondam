import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { willApi } from './willApi.js'
import { useJobSocket } from '../../hooks/useJobSocket.js'

const POLL_INTERVAL = 5000
// 일시적인 네트워크 끊김으로 바로 멈추지 않도록, 연속 이 횟수만큼 실패해야 중단
const MAX_CONSECUTIVE_FAILURES = 3
// 이 상태일 때만 폴링을 계속한다
const IN_PROGRESS_STATUSES = ['queued', 'running']

// 죽음/실패를 알리는 안내는 감정적으로 취약한 사용자가 보는 화면이므로, "실패했다"로만
// 끝내지 않고 다음에 뭘 해야 하는지(환불됨/재시도 가능)까지 함께 안내한다.
const DEFAULT_FAILURE_MESSAGE =
  '죄송합니다. 영상 편지 생성에 실패했습니다. 결제하신 금액은 자동으로 환불 처리되며, 자세한 안내는 알림함에서 확인하실 수 있어요.'

const CHECK_UNAVAILABLE_MESSAGE =
  '상태 확인이 잠시 안 됩니다. 영상 제작은 계속 진행되고 있을 수 있으니, 아래 "다시 확인" 버튼을 누르거나 보관함에서 확인해 주세요.'

export function useWillProcessing() {
  const navigate = useNavigate()
  const { willId } = useParams()
  const [jobStatus, setJobStatus] = useState('queued')
  const [progress, setProgress] = useState(0)
  // pollError: 영상 생성 자체가 실패(failed) - 생성 실패 화면
  const [pollError, setPollError] = useState(null)
  // checkError: 상태 조회가 연속 실패했거나 알 수 없는 상태 - "다시 확인" 화면
  const [checkError, setCheckError] = useState(null)
  // 값이 바뀌면 폴링 effect를 다시 시작한다("다시 확인" 버튼)
  const [pollKey, setPollKey] = useState(0)

  const timerRef = useRef(null)
  const bullmqJobIdRef = useRef(null)
  // 소켓으로 종료(completed/failed)를 먼저 받은 경우 폴링 재예약을 막는다
  const settledRef = useRef(false)

  useJobSocket({
    onProgress: (event) => {
      if (bullmqJobIdRef.current && event.jobId !== bullmqJobIdRef.current) return

      setJobStatus(event.status)
      setProgress(event.progress ?? 0)

      if (event.status === 'completed') {
        settledRef.current = true
        clearTimeout(timerRef.current)
        navigate('/will/vault')
      } else if (event.status === 'failed') {
        // 소켓 이벤트에는 errorMessage가 실려오지 않는다(job:progress emit payload는
        // jobId/jobType/status/progress/resultUrl뿐) - 기본 안내 문구를 쓴다.
        settledRef.current = true
        clearTimeout(timerRef.current)
        setPollError((prev) => prev ?? DEFAULT_FAILURE_MESSAGE)
      }
    },
  })

  // 한 번 조회 - 성공 시 { ok: true, job }, 실패 시 { ok: false }
  const fetchStatus = useCallback(async () => {
    if (!willId) return { ok: false }
    try {
      const { data } = await willApi.getWillStatus(willId)
      return { ok: true, job: data?.data?.job ?? null }
    } catch {
      // FIX: DEV-24 - 폴링 실패를 가짜 처리 완료로 위장하지 않는다
      return { ok: false }
    }
  }, [willId])

  useEffect(() => {
    // StrictMode 이중 실행·언마운트 후 setState를 막는 effect 지역 플래그
    let cancelled = false
    let failures = 0
    settledRef.current = false

    const tick = async () => {
      if (cancelled || settledRef.current) return
      const result = await fetchStatus()
      if (cancelled || settledRef.current) return

      if (!result.ok) {
        failures += 1
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          setCheckError(CHECK_UNAVAILABLE_MESSAGE)
          return
        }
        timerRef.current = setTimeout(tick, POLL_INTERVAL)
        return
      }

      failures = 0
      const job = result.job
      const status = job?.jobStatus
      if (job?.jobId) bullmqJobIdRef.current = job.jobId
      setJobStatus(status)
      setProgress(job?.progress ?? 0)

      if (status === 'completed') {
        navigate('/will/vault')
        return
      }
      // job.errorMessage는 willService.getVideoStatus가 toSafeFailureMessage로
      // 이미 안전하게 치환한 문구다(벤더 원문·환경변수명이 새지 않음).
      if (status === 'failed') {
        setPollError(job?.errorMessage ?? DEFAULT_FAILURE_MESSAGE)
        return
      }
      if (!IN_PROGRESS_STATUSES.includes(status)) {
        // undefined 등 알 수 없는 상태 - 무한 폴링하지 않고 멈춘 뒤 안내
        setCheckError(CHECK_UNAVAILABLE_MESSAGE)
        return
      }
      timerRef.current = setTimeout(tick, POLL_INTERVAL)
    }

    tick()

    return () => {
      cancelled = true
      clearTimeout(timerRef.current)
    }
  }, [fetchStatus, navigate, pollKey])

  const retryCheck = useCallback(() => {
    setCheckError(null)
    setPollKey((k) => k + 1)
  }, [])

  return { jobStatus, progress, pollError, checkError, retryCheck }
}
