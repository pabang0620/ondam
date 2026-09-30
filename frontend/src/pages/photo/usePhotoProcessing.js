import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPhotoOrderStatus } from './photoApi.js'
import { useJobSocket } from '../../hooks/useJobSocket.js'

const POLL_INTERVAL_MS = 3000
// FE-PP-6: 일시적인 네트워크 끊김 한 번으로 화면을 오류로 멈추지 않는다
const MAX_CONSECUTIVE_POLL_ERRORS = 3
// FE-PP-6: 결제가 확정되지 않은 채(pending_payment) 이 횟수만큼 폴링되면
// 결제가 끝나지 않은 것으로 보고 멈춘 뒤 안내한다
const MAX_PENDING_PAYMENT_POLLS = 20

// FIX: 결함3 - GET /orders/:id/status가 돌려주는 status는 photo_orders.status
// (PHOTO_ORDER_STATUS, shared/constants/enums.js: pending_payment/paid/processing/
// completed/failed/refunded)다. 'refunded'는 AI 처리가 최종 실패해 자동 환불까지
// 끝난 종료 상태인데도 여기서 분기 대상이 아니어서 3초 폴링이 끝없이 반복됐다 -
// 사용자는 환불된 사실을 전혀 모른 채 "AI가 처리하고 있습니다... 0%"만 계속 보게 된다.
// pending_payment/paid/processing은 정상적으로 계속 폴링해야 하는 대기·진행 상태다.
// completed/failed/refunded 3종은 아래에서 개별 분기로 처리하는 종료 상태다.
const KNOWN_NON_TERMINAL_STATUSES = new Set(['pending_payment', 'paid', 'processing'])

// 응답이 없거나(네트워크 오류) 5xx면 잠시 뒤 다시 시도해 볼 만한 일시 오류로 본다
function isTransientError(err) {
  const httpStatus = err?.response?.status
  return !httpStatus || httpStatus >= 500
}

function usePhotoProcessing() {
  const navigate = useNavigate()
  const { orderId } = useParams()

  const [status, setStatus] = useState('queued')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  // "다시 확인" 버튼을 보여줄지 - 상태 조회 자체가 실패해 멈췄을 때만 true
  const [canRetry, setCanRetry] = useState(false)
  // 결제가 확정되지 않아 폴링을 멈춘 경우(오류가 아니라 안내)
  const [isPaymentIncomplete, setIsPaymentIncomplete] = useState(false)
  // 환불 안내는 "오류"가 아니라 "결제가 정상적으로 취소됐다"는 정보이므로 error와
  // 분리한다 - 화면에서 문구·아이콘·톤을 다르게 보여줘야 한다.
  const [isRefunded, setIsRefunded] = useState(false)
  // "다시 확인"을 누르면 값을 올려 폴링 effect를 새로 시작한다
  const [pollSession, setPollSession] = useState(0)

  const intervalRef = useRef(null)
  const isMountedRef = useRef(true)
  const bullmqJobIdRef = useRef(null)
  const pollRef = useRef(null)

  useJobSocket({
    onProgress: (event) => {
      if (!isMountedRef.current) return
      // FE-PP-2: 아직 이 주문의 잡 ID를 모르면 다른 잡의 이벤트일 수 있으므로 무시한다
      if (!bullmqJobIdRef.current || event.jobId !== bullmqJobIdRef.current) return

      // 소켓 이벤트의 status는 ai_jobs.job_status(AI_JOB_STATUS: queued/running/
      // completed/failed)다 - photo_orders.status(refunded 포함)와는 다른 값이다.
      if (event.status === 'completed' || event.status === 'failed') {
        // FE-PP-2: 소켓 이벤트만 보고 이동하면 환불(refunded) 여부를 알 수 없다.
        // 주문 상태를 한 번 조회해 폴링 분기가 최종 판정하게 한다.
        pollRef.current?.()
        return
      }

      setStatus(event.status)
      setProgress(event.progress ?? 0)
    },
  })

  useEffect(() => {
    isMountedRef.current = true
    let consecutiveErrors = 0
    let pendingPaymentCount = 0
    let isStopped = false

    const stop = () => {
      isStopped = true
      clearInterval(intervalRef.current)
    }

    const poll = async () => {
      if (!isMountedRef.current || isStopped) return

      try {
        const { data } = await getPhotoOrderStatus(orderId)
        const { status: newStatus, progress: newProgress, jobId } = data.data

        if (!isMountedRef.current || isStopped) return
        consecutiveErrors = 0

        if (jobId) bullmqJobIdRef.current = jobId

        setStatus(newStatus)
        setProgress(newProgress ?? 0)

        if (newStatus === 'refunded') {
          // 결함3: "실패했다"가 아니라 "처리하지 못해 결제를 취소했다"가 정확한
          // 정보다 - 결과 페이지로 보내지 않는다(파일이 없어 getResult가 400을
          // 던지고 "결과를 불러오지 못했습니다"라는 혼란스러운 오류로 이어진다).
          stop()
          setIsRefunded(true)
        } else if (newStatus === 'completed' || newStatus === 'failed') {
          stop()
          // FIX: 결정1(2026-08-22) - 세트 일부만 실패해도 성공한 결과물은 결과
          // 페이지에서 보여준다(SPEC-02 2절). 전량 실패면 결과 페이지가 자체적으로
          // 오류와 이동 버튼을 보여준다(usePhotoResult.js).
          navigate(`/photo/result/${orderId}`)
        } else if (!KNOWN_NON_TERMINAL_STATUSES.has(newStatus)) {
          // 방어적 폴백: PHOTO_ORDER_STATUS에 없는 값이 오면(스키마 변경/오탈자
          // 등) 무한 폴링에 빠지지 않도록 멈추고 새로고침을 안내한다.
          stop()
          setError('처리 상태를 확인할 수 없습니다. 잠시 후 페이지를 새로고침해 다시 시도해 주세요.')
        } else if (newStatus === 'pending_payment') {
          pendingPaymentCount += 1
          if (pendingPaymentCount >= MAX_PENDING_PAYMENT_POLLS) {
            stop()
            setIsPaymentIncomplete(true)
          }
        } else {
          pendingPaymentCount = 0
        }
        // pending_payment/paid/processing이면 다음 interval에서 계속 폴링한다.
      } catch (err) {
        if (!isMountedRef.current || isStopped) return
        // FIX: DEV-24 - 상태 조회 실패를 가짜 진행률로 위장해 완료 페이지로 이동시키지 않는다
        if (isTransientError(err)) {
          consecutiveErrors += 1
          // FE-PP-6: 일시 오류는 연속 3회일 때만 멈춘다
          if (consecutiveErrors < MAX_CONSECUTIVE_POLL_ERRORS) return
          stop()
          setCanRetry(true)
          setError('처리 상태를 확인하지 못했습니다. 인터넷 연결을 확인하신 뒤 "다시 확인" 버튼을 눌러 주세요.')
          return
        }
        stop()
        setCanRetry(true)
        setError('처리 상태를 확인하지 못했습니다. 잠시 후 "다시 확인" 버튼을 눌러 주세요.')
      }
    }

    pollRef.current = poll
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      isMountedRef.current = false
      stop()
      pollRef.current = null
    }
  }, [orderId, navigate, pollSession])

  const retry = useCallback(() => {
    setError(null)
    setCanRetry(false)
    setIsPaymentIncomplete(false)
    setPollSession((n) => n + 1)
  }, [])

  return {
    orderId,
    status,
    progress,
    error,
    canRetry,
    retry,
    isPaymentIncomplete,
    isRefunded,
  }
}

export default usePhotoProcessing
