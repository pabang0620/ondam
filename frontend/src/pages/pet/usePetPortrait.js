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
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [result, setResult] = useState(null)

  const MOCK_MEDIA = [
    { media_id: 'media-001', pet_id: petId, media_type: 'photo', file_url: 'https://picsum.photos/seed/dog1/600/600', caption: '공원 산책', taken_at: '2023-05-10', sort_order: 1 },
    { media_id: 'media-002', pet_id: petId, media_type: 'photo', file_url: 'https://picsum.photos/seed/dog2/600/600', caption: '생일 파티', taken_at: '2023-03-15', sort_order: 2 },
    { media_id: 'media-003', pet_id: petId, media_type: 'photo', file_url: 'https://picsum.photos/seed/dog3/600/600', caption: '겨울 눈밭', taken_at: '2023-01-20', sort_order: 3 },
  ]

  const fetchMedia = useCallback(async () => {
    if (!petId) return
    setIsLoading(true)
    try {
      const res = await petApi.getPetMedia(petId)
      if (res.data.success) setMedia(res.data.data ?? [])
    } catch (err) {
      console.warn('[mock] usePetPortrait.fetchMedia - 백엔드 응답 없음, mock 미디어로 대체', err)
      setMedia(MOCK_MEDIA)
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId])

  useEffect(() => {
    const ac = new AbortController()
    fetchMedia()
    return () => ac.abort()
  }, [fetchMedia])

  const MOCK_PORTRAIT_URLS = {
    oil: 'https://picsum.photos/seed/portrait-oil/600/600',
    watercolor: 'https://picsum.photos/seed/portrait-watercolor/600/600',
    illustration: 'https://picsum.photos/seed/portrait-illustration/600/600',
  }

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
      console.warn('[mock] usePetPortrait.handleGenerate - AI API 실패, 2.5초 시뮬레이션 후 mock 초상화 반환', err)
      await new Promise((resolve) => setTimeout(resolve, 2500))
      const mockUrl = MOCK_PORTRAIT_URLS[selectedStyle] ?? 'https://picsum.photos/seed/portrait-default/600/600'
      setResult({ url: mockUrl })
    } finally {
      setIsGenerating(false)
    }
  }

  return {
    media,
    isLoading,
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
