import { useState, useEffect, useCallback } from 'react'
import { petApi } from './petApi.js'

const STYLES = [
  { key: 'oil', label: '유화', desc: '고전적인 유화 스타일의 초상화' },
  { key: 'watercolor', label: '수채화', desc: '부드럽고 감성적인 수채화 스타일' },
  { key: 'illustration', label: '일러스트', desc: '따뜻한 느낌의 디지털 일러스트' },
]

export function usePetPortrait(petId) {
  const [media, setMedia] = useState([])
  const [selectedStyle, setSelectedStyle] = useState(null)
  const [selectedMediaId, setSelectedMediaId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mediaError, setMediaError] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [result, setResult] = useState(null)

  const fetchMedia = useCallback(async () => {
    if (!petId) return
    setIsLoading(true)
    setMediaError(null)
    try {
      const res = await petApi.getPetMedia(petId)
      if (res.data.success) setMedia(res.data.data ?? [])
    } catch (err) {
      // FIX: DEV-27 - 조회 실패를 빈 목록으로 조용히 흘려보내지 않는다. 빈 목록은
      // "등록된 사진이 없습니다"로 표시돼 조회 실패를 사용자가 오인하게 된다.
      // 실패는 별도 에러 상태로 화면에 노출한다(G2-2).
      setMedia([])
      setMediaError(err?.response?.data?.message ?? '사진 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsLoading(false)
    }
  }, [petId])

  useEffect(() => {
    const ac = new AbortController()
    fetchMedia()
    return () => ac.abort()
  }, [fetchMedia])

  const handleGenerate = async () => {
    if (!selectedStyle || !selectedMediaId) return
    if (isGenerating) return

    setIsGenerating(true)
    setGenerateError(null)
    setResult(null)

    try {
      // 1단계: 초상화 생성 요청 (백엔드에서 params 불필요)
      const res = await petApi.createPortrait(petId, {})
      if (!res.data.success) {
        throw new Error(res.data.message || 'AI 초상화 생성 요청에 실패했습니다.')
      }

      // 2단계: 상태 폴링 (최대 60초, 2초 간격)
      const MAX_POLLS = 30
      let polls = 0
      let pollInterval = null

      await new Promise((resolve, reject) => {
        pollInterval = setInterval(async () => {
          if (polls >= MAX_POLLS) {
            clearInterval(pollInterval)
            reject(new Error('AI 초상화 생성 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'))
            return
          }
          polls += 1

          try {
            const statusRes = await petApi.getPortraitStatus(petId)
            if (!statusRes.data.success) {
              clearInterval(pollInterval)
              reject(new Error(statusRes.data.message || '상태 조회에 실패했습니다.'))
              return
            }

            const { status, portraitUrl } = statusRes.data.data ?? {}

            if (status === 'completed') {
              clearInterval(pollInterval)
              if (portraitUrl) setResult({ url: portraitUrl })
              resolve()
              return
            }

            if (status === 'failed') {
              clearInterval(pollInterval)
              reject(new Error('AI 초상화 생성에 실패했습니다. 다시 시도해 주세요.'))
            }
            // pending / processing - 다음 interval 대기
          } catch (err) {
            clearInterval(pollInterval)
            reject(err)
          }
        }, 2000)
      })
    } catch (err) {
      // FIX: DEV-24 - AI 초상화 생성 실패를 가짜 이미지로 위장하지 않는다
      setGenerateError(err?.response?.data?.message ?? err?.message ?? 'AI 초상화 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsGenerating(false)
    }
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
  }
}
