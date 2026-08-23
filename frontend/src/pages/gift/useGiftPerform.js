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
  const [needsAccountConsent, setNeedsAccountConsent] = useState(false)
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

  // 2026-08-23: 기존 계정으로 로그인(mode==='login')하는 수행자 중 약관 필수화
  // 이전 가입자는 terms 동의 기록이 없어 서버(giftPerformService.linkAccount →
  // ensureRequiredAccountConsents)가 400으로 막는다. 여기서는 그 특정 실패만
  // 식별해 "동의 보완" 흐름을 열어준다 - 로그인 자격 실패(401)나 본인확인 미완료
  // (400 '본인 확인이 먼저 필요합니다')와는 구분해야 하므로, 자격 검증을 통과한
  // 뒤에만 도달하는 이 경로가 서버에서 공통으로 붙이는 고정 문구
  // ('동의가 필요합니다')로 식별한다. 정확히 어떤 항목(privacy/terms)이 빠졌는지는
  // 한글 라벨을 파싱하지 않는다(라벨 조합 순서·문구가 바뀌면 조용히 깨지는 취약한
  // 방식이라) - 대신 필수 동의 항목 전체를 다시 보여준다. 이미 동의가 있는 항목을
  // 함께 보내도 서버는 실제로 없는 항목만 저장하므로(ensureRequiredAccountConsents의
  // missingTypes 필터링) 안전하다.
  const submitAccount = useCallback(async (payload) => {
    setIsLinking(true)
    setAccountError(null)
    setNeedsAccountConsent(false)
    try {
      const { data } = await linkAccount(token, payload)
      const { accessToken, user, gift } = data.data
      setAuth(user, accessToken)
      const productType = gift?.productType ?? info?.productType
      if (gift?.giftId) sessionStorage.setItem('giftContentGiftId', gift.giftId)
      navigate(`/gift/perform/${token}/${productType === 'will' ? 'will' : 'photo'}`, { replace: true })
    } catch (err) {
      const status = err?.response?.status
      const message = err?.response?.data?.message ?? '처리에 실패했습니다.'
      if (status === 400 && message.includes('동의가 필요합니다')) {
        setNeedsAccountConsent(true)
      }
      setAccountError(message)
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
    needsAccountConsent,
    isLinking,
    declineResult,
    submitVerification,
    goToAccount,
    submitAccount,
    submitDecline,
  }
}

export default useGiftPerform
