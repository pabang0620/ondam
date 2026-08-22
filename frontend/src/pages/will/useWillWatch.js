import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { willApi } from './willApi.js'

// 화면 단계 - SPEC-05 2절 순서를 그대로 따른다
// info(진입 정보 로딩) → verify(본인 확인 입력) → prepare(마음의 준비 화면) → playing(재생)
// locked/expired/error는 각 단계에서 벗어나는 예외 경로
const PHASE = {
  LOADING: 'loading',
  VERIFY: 'verify',
  LOCKED: 'locked',
  EXPIRED: 'expired', // SPEC-05 3절 - 열람 링크(90일) 만료, 연장 요청 가능
  PREPARE: 'prepare',
  PLAYING: 'playing',
  ERROR: 'error',
}

export function useWillWatch() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [phase, setPhase] = useState(PHASE.LOADING)
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [willTitle, setWillTitle] = useState('')
  const [willData, setWillData] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [verifyError, setVerifyError] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isExtending, setIsExtending] = useState(false)
  const [extendError, setExtendError] = useState(null)

  useEffect(() => {
    if (!token) return

    const ac = new AbortController()

    const load = async () => {
      setPhase(PHASE.LOADING)
      setFetchError(null)
      try {
        const { data } = await willApi.getWatchInfo(token)
        const info = data.data
        setBeneficiaryName(info?.beneficiaryName ?? '')
        setWillTitle(info?.willTitle ?? '')
        if (info?.expired) {
          setPhase(PHASE.EXPIRED)
        } else if (info?.locked) {
          setPhase(PHASE.LOCKED)
        } else {
          setPhase(PHASE.VERIFY)
        }
      } catch (err) {
        // FIX: DEV-24 - 조회 실패를 가짜 유언 영상으로 위장하지 않는다
        setFetchError(err?.response?.data?.message ?? '영상을 찾을 수 없습니다. 링크가 만료되었거나 올바르지 않습니다.')
        setPhase(PHASE.ERROR)
      }
    }

    load()
    return () => ac.abort()
  }, [token])

  // 휴대폰 뒤 4자리 대조 - 성공하면 prepare 단계로만 넘어간다(자동재생 금지, 준비
  // 화면에서 사용자가 직접 눌러야 재생된다)
  const submitVerification = useCallback(async (phoneLast4) => {
    if (!token || isVerifying) return
    setIsVerifying(true)
    setVerifyError(null)
    try {
      const { data } = await willApi.verifyWatchAccess(token, phoneLast4)
      setWillData(data.data)
      setPhase(PHASE.PREPARE)
    } catch (err) {
      const status = err?.response?.status
      const message = err?.response?.data?.message
      if (status === 423) {
        setPhase(PHASE.LOCKED)
        setVerifyError(message ?? '본인 확인 시도 횟수를 초과했습니다. 고객센터로 문의해 주세요.')
      } else if (status === 410) {
        // 정보 조회 이후 만료된 경우(defense in depth) - 만료 화면으로 전환
        setPhase(PHASE.EXPIRED)
      } else {
        setVerifyError(message ?? '휴대폰 번호 뒤 4자리를 다시 확인해 주세요.')
      }
    } finally {
      setIsVerifying(false)
    }
  }, [token, isVerifying])

  // "마음의 준비가 되시면" 버튼 - 여기서만 실제 재생 화면으로 전환한다(SPEC-05 2절)
  const startPlayback = useCallback(() => {
    setPhase(PHASE.PLAYING)
  }, [])

  // 만료 화면의 "연장 요청하기" 버튼 - 새 토큰을 발급받아 그 페이지로 바로 이동시킨다
  // (SPEC-05 3절, 재발급마다 구토큰 무효화는 서버가 처리)
  const requestExtension = useCallback(async () => {
    if (!token || isExtending) return
    setIsExtending(true)
    setExtendError(null)
    try {
      const { data } = await willApi.requestWatchExtension(token)
      const newToken = data?.data?.token
      if (newToken) {
        navigate(`/watch/${newToken}`, { replace: true })
      } else {
        setExtendError('링크 연장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    } catch (err) {
      setExtendError(err?.response?.data?.message ?? '링크 연장 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsExtending(false)
    }
  }, [token, isExtending, navigate])

  return {
    phase,
    beneficiaryName,
    willTitle,
    willData,
    fetchError,
    verifyError,
    isVerifying,
    isExtending,
    extendError,
    submitVerification,
    startPlayback,
    requestExtension,
  }
}

export { PHASE }
