import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle, Clock3 } from 'lucide-react'
import { Button } from '../../components/common/Button.jsx'
import { confirmPayment, startProcessing, getPhotoOrderStatus } from './photoApi.js'
import { getSafeErrorMessage } from '../../lib/safeErrorMessage.js'
import { ROUTES } from '../../constants/routes.js'

// FIX: 멱등 confirm(이미 완료된 결제) 뒤 start를 다시 부르면 400이 난다. 400이면 주문
// 상태를 조회해 이미 처리 중/완료인 경우 해당 화면으로 보낸다. 이동했으면 true.
async function redirectIfAlreadyStarted(orderId, startErr, navigate) {
  if (startErr?.response?.status !== 400) return false
  try {
    const { data } = await getPhotoOrderStatus(orderId)
    const status = data?.data?.status
    if (status === 'processing') {
      navigate(`/photo/processing/${orderId}`, { replace: true })
      return true
    }
    if (status === 'completed') {
      navigate(`/photo/result/${orderId}`, { replace: true })
      return true
    }
  } catch {
    // 상태 조회 실패 - 원래 start 실패 안내를 그대로 보여준다
  }
  return false
}

// 결함4 - startProcessing이 던지는 400 메시지("초상권 처리 동의가 필요합니다" 등)는
// 사용자가 바로 행동할 수 있는 구체적 사유다. 이를 버리고 "문제가 발생했습니다"로만
// 뭉뚱그리면 사용자는 원인을 모른 채 재시도 버튼만 반복 누르게 된다(WillPaymentSuccessPage와
// 동일한 결함 패턴).
const START_FAILED_FALLBACK = 'AI 처리를 시작하는 중 문제가 발생했습니다. 아래 버튼을 눌러 다시 시작해 주세요.'

// DEV-25: 토스 결제창이 successUrl로 리다이렉트하며 붙여주는 쿼리(paymentKey, orderId,
// amount)를 받아 confirm을 호출하는 콜백 페이지. usePhotoPayment.js가 리다이렉트 직전
// sessionStorage에 남겨둔 photo_orders.order_id(pendingPhotoOrderId)와 함께 처리한다.
//
// G3: 결제 성공 여부는 오직 서버 confirm 응답으로만 판정한다. 이 페이지는 URL 쿼리를
// 받았다는 사실 자체를 성공으로 취급하지 않는다.
function CenterMessage({ children }) {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '64px var(--spacing-md) 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--spacing-lg)',
        textAlign: 'center',
      }}
    >
      {children}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}

export default function PhotoPaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  // processing: confirm 진행 중 / uncertain: 서버가 502/409(불확정) / start-failed: 결제는
  // 완료됐으나 처리 시작 요청만 실패 / no-target: 결제는 완료됐으나 대상 주문을 특정
  // 못함 / error: confirm 자체가 명확히 실패
  const [state, setState] = useState('processing')
  const [message, setMessage] = useState(null)
  const [startFailedMessage, setStartFailedMessage] = useState(START_FAILED_FALLBACK)
  const [photoOrderId, setPhotoOrderId] = useState(null)
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const paymentKey = searchParams.get('paymentKey')
    const tossOrderId = searchParams.get('orderId')
    const amount = searchParams.get('amount')
    // FIX: HIGH-3/5 - confirm에 필요한 값(paymentKey/orderId/amount)은 전부 URL에 있다.
    // sessionStorage는 후속 startProcessing에만 필요한 값이므로 confirm의 전제조건으로
    // 묶지 않는다. sessionStorage가 없어도(새 탭 복귀·인앱 브라우저·시크릿 창) confirm은
    // 반드시 수행하고, 리소스 id는 confirm 응답의 target_id를 1순위로 쓴다.
    const pendingOrderIdFromStorage = sessionStorage.getItem('pendingPhotoOrderId')

    if (!paymentKey || !tossOrderId || !amount) {
      setState('error')
      setMessage('결제 정보를 확인할 수 없습니다. 주문 내역에서 결제 상태를 확인해 주세요.')
      return
    }

    if (pendingOrderIdFromStorage) setPhotoOrderId(pendingOrderIdFromStorage)

    confirmPayment({ paymentKey, orderId: tossOrderId, amount: Number(amount) })
      .then(async (res) => {
        sessionStorage.removeItem('pendingPhotoOrderId')
        // FIX: HIGH-5 - target_id(서버 확정값)를 1순위, sessionStorage를 폴백으로 쓴다.
        const resolvedOrderId = res.data?.data?.payment?.target_id ?? pendingOrderIdFromStorage
        if (!resolvedOrderId) {
          // 결제는 성공했으나 대상 주문을 특정할 수 없다 - 조용히 이탈하지 않는다.
          setState('no-target')
          return
        }
        setPhotoOrderId(resolvedOrderId)
        // FIX: 이미 완료된 결제(멱등 응답)면 처리도 이미 시작됐다 - start를 다시 부르지 않는다
        if (res.data?.data?.idempotent === true) {
          navigate(`/photo/processing/${resolvedOrderId}`, { replace: true })
          return
        }
        try {
          await startProcessing(resolvedOrderId)
          navigate(`/photo/processing/${resolvedOrderId}`, { replace: true })
        } catch (startErr) {
          if (await redirectIfAlreadyStarted(resolvedOrderId, startErr, navigate)) return
          // 결제는 이미 완료됐다 - 처리 시작 요청만 실패한 것이므로 결제 실패로
          // 보여주면 안 된다(이미 청구된 금액을 취소된 것처럼 오해하게 만든다).
          // FIX: 결함4 - 서버가 준 구체적 사유를 버리지 않는다(안전 필터 통과분만).
          setStartFailedMessage(getSafeErrorMessage(startErr, START_FAILED_FALLBACK, 'photo-start-processing'))
          setState('start-failed')
        }
      })
      .catch((err) => {
        sessionStorage.removeItem('pendingPhotoOrderId')
        const httpStatus = err?.response?.status
        // DEV-25 + FIX: HIGH-4 - 502(서버가 토스 응답을 불확정으로 판단), 409(confirm
        // 재선점 충돌 - 스피너 도중 새로고침 등으로 발생), 또는 클라이언트 쪽 타임아웃/
        // 네트워크 오류는 "실패"가 아니다. 카드가 실제로는 승인됐을 수 있어, 여기서
        // 재시도 버튼을 크게 노출하면 이중결제로 이어질 수 있다
        // (backend paymentService.js의 CLAIM_STALE_MS 자가치유 경로가 진짜 상태를
        // 뒤늦게 정리하므로, 사용자는 잠시 후 주문 내역에서 확인하면 된다).
        const isUncertain =
          httpStatus === 502 || httpStatus === 409 || err?.code === 'ECONNABORTED' || !err?.response
        if (isUncertain) {
          setState('uncertain')
        } else {
          setState('error')
          setMessage(err?.response?.data?.message ?? '결제 승인에 실패했습니다.')
        }
      })
  }, [searchParams, navigate])

  const retryStart = async () => {
    if (!photoOrderId) return
    setState('processing')
    try {
      await startProcessing(photoOrderId)
      navigate(`/photo/processing/${photoOrderId}`, { replace: true })
    } catch (startErr) {
      if (await redirectIfAlreadyStarted(photoOrderId, startErr, navigate)) return
      setStartFailedMessage(getSafeErrorMessage(startErr, START_FAILED_FALLBACK, 'photo-start-processing-retry'))
      setState('start-failed')
    }
  }

  if (state === 'processing') {
    return (
      <CenterMessage>
        <Loader2 size={40} color="var(--color-photo)" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" />
        <p role="status" aria-live="polite" style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>
          결제를 확인하고 있어요. 잠시만 기다려 주세요...
        </p>
      </CenterMessage>
    )
  }

  if (state === 'uncertain') {
    return (
      <CenterMessage>
        <Clock3 size={40} color="#8A6A1F" aria-hidden="true" />
        <p role="status" aria-live="polite" style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          결제 결과를 확인하고 있어요
        </p>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          네트워크가 불안정해 결제 확인이 지연되고 있습니다. 카드가 이미 승인되었을 수
          있으니, 잠시 후 주문 내역에서 결제 상태를 다시 확인해 주세요.
          지금 다시 결제를 시도하면 이중으로 청구될 수 있으니 주의해 주세요.
        </p>
        <Button onClick={() => navigate(ROUTES.MY)} fullWidth>주문 내역으로 이동</Button>
      </CenterMessage>
    )
  }

  if (state === 'no-target') {
    return (
      <CenterMessage>
        <AlertCircle size={40} color="#8A6A1F" aria-hidden="true" />
        <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          결제는 완료됐어요
        </p>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          다만 처리할 주문을 자동으로 찾지 못했습니다. 주문 내역에서 결제 상태를
          확인해 주세요.
        </p>
        <Button onClick={() => navigate(ROUTES.MY)} fullWidth>주문 내역으로 이동</Button>
      </CenterMessage>
    )
  }

  if (state === 'start-failed') {
    return (
      <CenterMessage>
        <AlertCircle size={40} color="#8A6A1F" aria-hidden="true" />
        <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          결제는 완료됐어요
        </p>
        {/* FIX: 결함4 - 서버가 준 구체적 사유를 그대로 보여준다(안전 필터 통과분만) */}
        <p role="alert" style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          {startFailedMessage}
        </p>
        <Button onClick={retryStart} fullWidth>처리 다시 시작하기</Button>
      </CenterMessage>
    )
  }

  return (
    <CenterMessage>
      <AlertCircle size={40} color="var(--color-error)" aria-hidden="true" />
      <p role="alert" style={{ fontSize: 'var(--fs-body)', color: 'var(--color-error)', fontWeight: 700 }}>
        {message}
      </p>
      <Button onClick={() => navigate(photoOrderId ? `/photo/payment?orderId=${photoOrderId}` : '/photo')} fullWidth>
        다시 결제하기
      </Button>
    </CenterMessage>
  )
}
