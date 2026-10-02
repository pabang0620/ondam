import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BILLING_RESULT } from './subscriptionLabels.js'

const SUCCESS_MESSAGE_MS = 4000
const MAX_MESSAGE_LENGTH = 200
const SUCCESS_DEFAULT_MESSAGE = '구독이 등록되었어요.'
const FAIL_DEFAULT_MESSAGE = '카드 등록에 실패했어요.'

// location.state 에서 알림을 읽는다. 알 수 없는 값이면 null.
function readNotice(state) {
  const result = state?.[BILLING_RESULT.KEY]
  if (result === BILLING_RESULT.SUCCESS) {
    return { type: 'success', message: SUCCESS_DEFAULT_MESSAGE }
  }
  if (result === BILLING_RESULT.FAIL) {
    const raw = state?.[BILLING_RESULT.MESSAGE_KEY]
    const text = typeof raw === 'string' ? raw.trim().slice(0, MAX_MESSAGE_LENGTH) : ''
    return { type: 'fail', message: text || FAIL_DEFAULT_MESSAGE }
  }
  return null
}

// 결제 복귀 결과를 /pet 에서 한 번 보여준다.
// 먼저 state 를 지역 state 로 복사한 뒤 history state 를 지운다(지워도 알림 유지, StrictMode 안전).
export function useBillingReturnNotice() {
  const location = useLocation()
  const navigate = useNavigate()
  const [notice, setNotice] = useState(() => readNotice(location.state))

  const hasResultInState = Boolean(location.state?.[BILLING_RESULT.KEY])
  useEffect(() => {
    if (hasResultInState) navigate(location.pathname, { replace: true, state: null })
  }, [hasResultInState, navigate, location.pathname])

  // 이미 마운트된 상태에서 새 결과가 state 로 들어오는 경우도 반영한다.
  useEffect(() => {
    if (!hasResultInState) return
    const next = readNotice(location.state)
    if (next) setNotice(next)
  }, [hasResultInState, location.state])

  const isSuccess = notice?.type === 'success'
  useEffect(() => {
    if (!isSuccess) return undefined
    const timer = setTimeout(() => setNotice(null), SUCCESS_MESSAGE_MS)
    return () => clearTimeout(timer)
  }, [isSuccess])

  const dismiss = useCallback(() => setNotice(null), [])

  return { notice, dismiss }
}
