import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import { getPerformInfo, verifyPerform, linkAccount, declinePerform } from './giftApi.js'

export const PHASE = {
  LOADING: 'loading',
  ERROR: 'error',
  LOCKED: 'locked',
  VERIFY: 'verify',
  INTRO: 'intro',
  ACCOUNT: 'account',
  DECLINED: 'declined',
}

// SPEC-01 3-2: 링크 클릭 → 본인확인 → 안내 → 계정연결 → (사진/유언장 도메인 기존
// 플로우로 이동). "한 화면 한 행동"을 phase 상태머신으로 표현한다.
function useGiftPerform() {
  const { token } = useParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [phase, setPhase] = useState(PHASE.LOADING)
  const [info, setInfo] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [verifyError, setVerifyError] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [accountError, setAccountError] = useState(null)
  const [isLinking, setIsLinking] = useState(false)
  const [declineResult, setDeclineResult] = useState(null)

  const load = useCallback(async () => {
    setPhase(PHASE.LOADING)
    try {
      const { data } = await getPerformInfo(token)
      const payload = data.data
      setInfo(payload)
      if (payload.giftId) sessionStorage.setItem('giftContentGiftId', payload.giftId)
      if (payload.locked) {
        setPhase(PHASE.LOCKED)
      } else if (payload.alreadyVerified) {
        setPhase(PHASE.INTRO)
      } else {
        setPhase(PHASE.VERIFY)
      }
    } catch (err) {
      setFetchError(err?.response?.data?.message ?? '링크를 확인할 수 없습니다.')
      setPhase(PHASE.ERROR)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const submitVerification = useCallback(async (phoneLast4) => {
    setIsVerifying(true)
    setVerifyError(null)
    try {
      const { data } = await verifyPerform(token, phoneLast4)
      setInfo((prev) => ({ ...prev, ...data.data }))
      setPhase(PHASE.INTRO)
    } catch (err) {
      const status = err?.response?.status
      if (status === 423) {
        setPhase(PHASE.LOCKED)
        setVerifyError(err?.response?.data?.message)
      } else {
        setVerifyError(err?.response?.data?.message ?? '본인 확인에 실패했습니다.')
      }
    } finally {
      setIsVerifying(false)
    }
  }, [token])

  // 이미 로그인된 상태로 재진입한 경우(같은 기기·같은 세션에서 이어하기) 계정
  // 연결 단계를 다시 거치지 않고 바로 콘텐츠 화면으로 보낸다.
  const goToAccount = useCallback(() => {
    if (isAuthenticated) {
      const productType = info?.productType
      navigate(`/gift/perform/${token}/${productType === 'will' ? 'will' : 'photo'}`, { replace: true })
      return
    }
    setPhase(PHASE.ACCOUNT)
  }, [isAuthenticated, info, navigate, token])

  const submitAccount = useCallback(async (payload) => {
    setIsLinking(true)
    setAccountError(null)
    try {
      const { data } = await linkAccount(token, payload)
      const { accessToken, user, gift } = data.data
      setAuth(user, accessToken)
      const productType = gift?.productType ?? info?.productType
      if (gift?.giftId) sessionStorage.setItem('giftContentGiftId', gift.giftId)
      navigate(`/gift/perform/${token}/${productType === 'will' ? 'will' : 'photo'}`, { replace: true })
    } catch (err) {
      setAccountError(err?.response?.data?.message ?? '처리에 실패했습니다.')
    } finally {
      setIsLinking(false)
    }
  }, [token, navigate, setAuth, info])

  const submitDecline = useCallback(async () => {
    try {
      const { data } = await declinePerform(token)
      setDeclineResult(data.data)
      setPhase(PHASE.DECLINED)
    } catch (err) {
      setVerifyError(err?.response?.data?.message ?? '거절 처리에 실패했습니다.')
    }
  }, [token])

  return {
    phase,
    info,
    fetchError,
    verifyError,
    isVerifying,
    accountError,
    isLinking,
    declineResult,
    submitVerification,
    goToAccount,
    submitAccount,
    submitDecline,
  }
}

export default useGiftPerform
