import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPhotoOrderStatus } from './photoApi.js'
import { useJobSocket } from '../../hooks/useJobSocket.js'

const POLL_INTERVAL_MS = 3000

// FIX: 결함3 - GET /orders/:id/status가 돌려주는 status는 photo_orders.status
// (PHOTO_ORDER_STATUS, shared/constants/enums.js: pending_payment/paid/processing/
// completed/failed/refunded)다. 'refunded'는 AI 처리가 최종 실패해 자동 환불까지
// 끝난 종료 상태인데도 여기서 분기 대상이 아니어서 3초 폴링이 끝없이 반복됐다 -
// 사용자는 환불된 사실을 전혀 모른 채 "AI가 처리하고 있습니다... 0%"만 계속 보게 된다.
// pending_payment/paid/processing은 정상적으로 계속 폴링해야 하는 대기·진행 상태다.
// completed/failed/refunded 3종은 아래에서 개별 분기로 처리하는 종료 상태다.
const KNOWN_NON_TERMINAL_STATUSES = new Set(['pending_payment', 'paid', 'processing'])

function usePhotoProcessing() {
  const navigate = useNavigate()
  const { orderId } = useParams()

  const [status, setStatus] = useState('queued')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  // 환불 안내는 "오류"가 아니라 "결제가 정상적으로 취소됐다"는 정보이므로 error와
  // 분리한다 - 화면에서 문구·아이콘·톤을 다르게 보여줘야 한다.
  const [isRefunded, setIsRefunded] = useState(false)

  const intervalRef = useRef(null)
  const isMountedRef = useRef(true)
  const bullmqJobIdRef = useRef(null)

  useJobSocket({
    onProgress: (event) => {
      if (bullmqJobIdRef.current && event.jobId !== bullmqJobIdRef.current) return
      if (!isMountedRef.current) return

      // 소켓 이벤트의 status는 ai_jobs.job_status(AI_JOB_STATUS: queued/running/
      // completed/failed)다 - photo_orders.status(refunded 포함)와는 다른 값이라
      // 여기서 'refunded'는 오지 않는다. 소켓의 'failed'는 폴링이 뒤이어 확정 상태
      // (failed 또는 refunded)를 가져와 아래 폴링 분기가 최종 판정한다.
      setStatus(event.status)
      setProgress(event.progress ?? 0)

      if (event.status === 'completed' || event.status === 'failed') {
        clearInterval(intervalRef.current)
        // FIX: 결정1(2026-08-22) - 세트 일부만 실패해도 성공한 결과물은 결과
        // 페이지에서 보여준다(SPEC-02 2절). 전량 실패면 결과 페이지가 자체적으로
        // "결과를 불러오지 못했습니다" 오류를 보여준다(usePhotoResult.js).
        navigate(`/photo/result/${orderId}`)
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

        if (newStatus === 'refunded') {
          // 결함3: "실패했다"가 아니라 "처리하지 못해 결제를 취소했다"가 정확한
          // 정보다 - 결과 페이지로 보내지 않는다(파일이 없어 getResult가 400을
          // 던지고 "결과를 불러오지 못했습니다"라는 혼란스러운 오류로 이어진다).
          clearInterval(intervalRef.current)
          setIsRefunded(true)
        } else if (newStatus === 'completed' || newStatus === 'failed') {
          clearInterval(intervalRef.current)
          // FIX: 결정1(2026-08-22) - 세트 일부만 실패해도 성공한 결과물은 결과
          // 페이지에서 보여준다(SPEC-02 2절). 전량 실패면 결과 페이지가 자체적으로
          // "결과를 불러오지 못했습니다" 오류를 보여준다(usePhotoResult.js).
          navigate(`/photo/result/${orderId}`)
        } else if (!KNOWN_NON_TERMINAL_STATUSES.has(newStatus)) {
          // 방어적 폴백: PHOTO_ORDER_STATUS에 없는 값이 오면(스키마 변경/오탈자
          // 등) 무한 폴링에 빠지지 않도록 멈추고 새로고침을 안내한다.
          clearInterval(intervalRef.current)
          setError('처리 상태를 확인할 수 없습니다. 잠시 후 페이지를 새로고침해 다시 시도해 주세요.')
        }
        // pending_payment/paid/processing이면 다음 interval에서 계속 폴링한다.
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
    isRefunded,
  }
}

export default usePhotoProcessing
