import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import {
  getPerformInfo, verifyPerform, linkAccount, declinePerform,
  getGiftErrorMessage, isRecipientMismatch, markAccountLinked, isAccountLinked,
} from './giftApi.js'

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
  // FE-GMA-11: 410(완료/거절/환불/만료)은 "오류"가 아니라 안내라 화면 톤을 달리한다.
  const [fetchStatus, setFetchStatus] = useState(null)
  const [verifyError, setVerifyError] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [accountError, setAccountError] = useState(null)
  const [needsAccountConsent, setNeedsAccountConsent] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const [declineResult, setDeclineResult] = useState(null)
  // FE-GMA-8: 거절 실패는 verifyError(본인확인 단계 전용)가 아니라 별도 state로 두고
  // Intro/Account 단계에서 보여준다. ref 잠금으로 연타 중복 요청을 막는다.
  const [declineError, setDeclineError] = useState(null)
  const [isDeclining, setIsDeclining] = useState(false)
  const declinePendingRef = useRef(false)

  const showFetchError = useCallback((err, fallback) => {
    setFetchStatus(err?.response?.status ?? null)
    setFetchError(err?.response?.data?.message ?? fallback)
    setPhase(PHASE.ERROR)
  }, [])

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
      showFetchError(err, '링크를 확인할 수 없습니다.')
    }
  }, [token, showFetchError])

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
      } else if (status === 410) {
        showFetchError(err, '더 이상 유효하지 않은 링크입니다.')
      } else {
        setVerifyError(err?.response?.data?.message ?? '본인 확인에 실패했습니다.')
      }
    } finally {
      setIsVerifying(false)
    }
  }, [token, showFetchError])

  const goToContent = useCallback((productType) => {
    navigate(`/gift/perform/${token}/${productType === 'will' ? 'will' : 'photo'}`, { replace: true })
  }, [navigate, token])

  // FE-GMA-1: 예전에는 "로그인 상태면" linkAccount 없이 곧장 콘텐츠로 보냈다 - 다른
  // 계정(예: 선물을 보낸 자녀 본인)으로 로그인된 기기에서 열면 수령자 연결 없이
  // 진행돼 서버 검증(403)에 막히거나 엉뚱한 계정에 결과물이 쌓였다. 이제는 이 탭에서
  // 이 선물 링크로 계정 연결이 성공한 경우에만 계정 단계를 건너뛴다.
  const goToAccount = useCallback(() => {
    setDeclineError(null)
    if (isAuthenticated && isAccountLinked(token)) {
      goToContent(info?.productType)
      return
    }
    setPhase(PHASE.ACCOUNT)
  }, [isAuthenticated, info, token, goToContent])

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
    setDeclineError(null)
    setNeedsAccountConsent(false)
    try {
      const { data } = await linkAccount(token, payload)
      const { accessToken, user, gift } = data.data
      setAuth(user, accessToken)
      markAccountLinked(token)
      const productType = gift?.productType ?? info?.productType
      if (gift?.giftId) sessionStorage.setItem('giftContentGiftId', gift.giftId)
      goToContent(productType)
    } catch (err) {
      const status = err?.response?.status
      if (status === 410) {
        showFetchError(err, '더 이상 유효하지 않은 링크입니다.')
        return
      }
      const message = getGiftErrorMessage(err, '처리에 실패했습니다.')
      if (!isRecipientMismatch(err) && status === 400 && message.includes('동의가 필요합니다')) {
        setNeedsAccountConsent(true)
      }
      setAccountError(message)
    } finally {
      setIsLinking(false)
    }
  }, [token, setAuth, info, goToContent, showFetchError])

  const submitDecline = useCallback(async () => {
    if (declinePendingRef.current) return
    declinePendingRef.current = true
    setIsDeclining(true)
    setDeclineError(null)
    try {
      const { data } = await declinePerform(token)
      setDeclineResult(data.data)
      setPhase(PHASE.DECLINED)
    } catch (err) {
      if (err?.response?.status === 410) {
        showFetchError(err, '더 이상 유효하지 않은 링크입니다.')
      } else {
        setDeclineError(getGiftErrorMessage(err, '거절 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'))
      }
    } finally {
      setIsDeclining(false)
      declinePendingRef.current = false
    }
  }, [token, showFetchError])

  return {
    phase,
    info,
    fetchError,
    fetchStatus,
    verifyError,
    isVerifying,
    accountError,
    needsAccountConsent,
    isLinking,
    declineResult,
    declineError,
    isDeclining,
    submitVerification,
    goToAccount,
    submitAccount,
    submitDecline,
  }
}

export default useGiftPerform
