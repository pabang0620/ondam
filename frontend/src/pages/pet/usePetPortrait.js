import { useState, useEffect, useCallback, useRef } from 'react'
import { petApi } from './petApi.js'

// 폴링 상한 초과는 실패가 아니다 - 서버에서는 계속 만들고 있을 수 있다
const POLL_TIMEOUT_MESSAGE = '아직 만드는 중입니다. 잠시 후 이 화면을 다시 열어 확인해 주세요'
const MISSING_URL_MESSAGE = '초상화를 만들었지만 결과를 불러오지 못했습니다. 잠시 후 이 화면을 다시 열어 확인해 주세요.'

const STYLES = [
  { key: 'oil', label: '유화', desc: '고전적인 유화 스타일의 초상화' },
  { key: 'watercolor', label: '수채화', desc: '부드럽고 감성적인 수채화 스타일' },
  { key: 'illustration', label: '일러스트', desc: '따뜻한 느낌의 디지털 일러스트' },
]

export function usePetPortrait(petId) {
  const [media, setMedia] = useState([])
  // [DEV-33] 아무것도 고르지 않고 진행하는 어르신 사용자를 위해 첫 번째 스타일을
  // 기본 선택 상태로 시작한다(null이면 버튼이 계속 비활성 상태로 남는다).
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0].key)
  const [selectedMediaId, setSelectedMediaId] = useState(null)
  // FIX: 초기값 false면 첫 페인트에 "등록된 사진이 없습니다"가 한 프레임 깜빡인다
  const [isLoading, setIsLoading] = useState(true)
  const [mediaError, setMediaError] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [result, setResult] = useState(null)
  // 남은 AI 초상화 매수 (구독자 월 3매 / 무료 티어 평생 1회 체험) - null이면 아직 조회 전
  const [quota, setQuota] = useState(null)
  const [quotaError, setQuotaError] = useState(null)

  const fetchQuota = useCallback(async () => {
    if (!petId) return
    setQuotaError(null)
    try {
      const res = await petApi.getPortraitQuota(petId)
      if (res.data.success) setQuota(res.data.data)
    } catch (err) {
      // 조회 실패 시 매수를 알 수 없으므로 임의로 "생성 가능"으로 단정하지 않는다.
      // 버튼은 quota가 null이 아닐 때만 남은 매수 기준으로 활성화되므로, 조회
      // 실패 상태에서는 안내 문구만 노출하고 생성 버튼은 비활성 유지된다.
      setQuotaError(err?.response?.data?.message ?? '남은 초상화 매수를 불러오지 못했습니다.')
    }
  }, [petId])

  useEffect(() => {
    fetchQuota()
  }, [fetchQuota])

  // FIX: 결함4 - signal 미전달로 abort()가 무효했던 문제 수정
  const fetchMedia = useCallback(async (signal) => {
    if (!petId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setMediaError(null)
    try {
      const res = await petApi.getPetMedia(petId, signal)
      if (res.data.success) {
        const list = res.data.data ?? []
        setMedia(list)
        // [DEV-33] 사진도 스타일과 마찬가지로 기본 선택을 채워 어르신이 아무것도
        // 고르지 않고 진행하는 경우를 방지한다. 이미 고른 사진이 있으면 덮어쓰지 않는다.
        setSelectedMediaId((prev) => {
          if (prev) return prev
          const firstPhoto = list.find((m) => m.media_type === 'photo')
          return firstPhoto?.media_id ?? prev
        })
      }
    } catch (err) {
      if (err.name === 'CanceledError') return
      // FIX: DEV-27 - 조회 실패를 빈 목록으로 조용히 흘려보내지 않는다. 빈 목록은
      // "등록된 사진이 없습니다"로 표시돼 조회 실패를 사용자가 오인하게 된다.
      // 실패는 별도 에러 상태로 화면에 노출한다(G2-2).
      setMedia([])
      setMediaError(err?.response?.data?.message ?? '사진 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [petId])

  useEffect(() => {
    const ac = new AbortController()
    fetchMedia(ac.signal)
    return () => ac.abort()
  }, [fetchMedia])

  // FIX: interval을 ref로 보관해 언마운트 시 정리한다(이전엔 지역 변수라 화면을
  // 떠나도 폴링이 계속 돌며 언마운트된 컴포넌트의 상태를 갱신했다).
  const pollIntervalRef = useRef(null)
  const isMountedRef = useRef(true)

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      stopPolling()
    }
  }, [stopPolling])

  // 상태 폴링 (최대 60초, 2초 간격). 완료/실패/상한 초과 시 resolve/reject.
  const pollStatus = useCallback(() => new Promise((resolve, reject) => {
    const MAX_POLLS = 30
    let polls = 0
    stopPolling()
    pollIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current) {
        stopPolling()
        return
      }
      if (polls >= MAX_POLLS) {
        stopPolling()
        reject(new Error(POLL_TIMEOUT_MESSAGE))
        return
      }
      polls += 1

      try {
        const statusRes = await petApi.getPortraitStatus(petId)
        if (!isMountedRef.current) return
        if (!statusRes.data.success) {
          stopPolling()
          reject(new Error(statusRes.data.message || '상태 조회에 실패했습니다.'))
          return
        }

        const { status, portraitUrl } = statusRes.data.data ?? {}

        if (status === 'completed') {
          stopPolling()
          // FIX: 완료인데 결과 주소가 없으면 성공으로 위장하지 않는다
          if (!portraitUrl) {
            reject(new Error(MISSING_URL_MESSAGE))
            return
          }
          setResult({ url: portraitUrl })
          resolve()
          return
        }

        if (status === 'failed') {
          stopPolling()
          reject(new Error('AI 초상화 생성에 실패했습니다. 다시 시도해 주세요.'))
        }
        // pending / processing - 다음 interval 대기
      } catch (err) {
        stopPolling()
        reject(err)
      }
    }, 2000)
  }), [petId, stopPolling])

  const runPolling = useCallback(async () => {
    try {
      await pollStatus()
    } catch (err) {
      if (!isMountedRef.current) return
      // FIX: DEV-24 - AI 초상화 생성 실패를 가짜 이미지로 위장하지 않는다
      // [DEV-32] 실패한 시도는 매수에서 제외되므로(백엔드 petRepository 참조)
      // 실패 후에도 quota를 다시 불러와 화면의 남은 매수를 최신 상태로 맞춘다.
      setGenerateError(err?.response?.data?.message ?? err?.message ?? 'AI 초상화 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false)
        fetchQuota()
      }
    }
  }, [pollStatus, fetchQuota])

  // FIX: 마운트 시 1회 상태를 조회해 진행 중/완료된 작업을 이어받는다(화면을 다시
  // 열었을 때 결과가 사라지거나 중복 생성하지 않도록). 응답: { status, progress, portraitUrl? },
  // 작업이 없으면 { status: 'none' }.
  useEffect(() => {
    if (!petId) return
    let cancelled = false
    petApi.getPortraitStatus(petId)
      .then((res) => {
        if (cancelled || !res.data.success) return
        const { status, portraitUrl } = res.data.data ?? {}
        if (status === 'completed' && portraitUrl) {
          setResult({ url: portraitUrl })
        } else if (status === 'pending' || status === 'queued' || status === 'processing') {
          setIsGenerating(true)
          setGenerateError(null)
          runPolling()
        }
      })
      .catch(() => {
        // 이어받기 조회 실패는 새 생성을 막지 않는다 - 조용히 기본 화면을 유지
      })
    return () => { cancelled = true }
  }, [petId, runPolling])

  const handleGenerate = async () => {
    if (!selectedStyle || !selectedMediaId) return
    if (isGenerating) return

    setIsGenerating(true)
    setGenerateError(null)
    setResult(null)

    try {
      // 1단계: 초상화 생성 요청 - [DEV-33] 선택한 스타일/사진을 실제로 전송한다.
      // 이전에는 빈 객체({})만 보내 사용자가 무엇을 골라도 결과에 반영되지 않았다.
      const res = await petApi.createPortrait(petId, { style: selectedStyle, mediaId: selectedMediaId })
      if (!res.data.success) {
        throw new Error(res.data.message || 'AI 초상화 생성 요청에 실패했습니다.')
      }
    } catch (err) {
      if (!isMountedRef.current) return
      setGenerateError(err?.response?.data?.message ?? err?.message ?? 'AI 초상화 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      setIsGenerating(false)
      fetchQuota()
      return
    }
    // 2단계: 상태 폴링
    await runPolling()
  }

  return {
    media,
    isLoading,
    mediaError,
    refetchMedia: fetchMedia,
    styles: STYLES,
    selectedStyle,
    setSelectedStyle,
    selectedMediaId,
    setSelectedMediaId,
    isGenerating,
    generateError,
    result,
    handleGenerate,
    quota,
    quotaError,
  }
}
