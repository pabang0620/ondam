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

  const fetchMedia = useCallback(async () => {
    if (!petId) return
    setIsLoading(true)
    try {
      const res = await petApi.getPetMedia(petId)
      if (res.data.success) setMedia(res.data.data ?? [])
    } catch {
      // silent — 미디어 없으면 빈 배열
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
      // AI 초상화는 mock — mediaType: 'portrait' 로 추가
      const selectedMedia = media.find((m) => m.mediaId === selectedMediaId)
      const res = await petApi.addPetMedia(petId, {
        mediaType: 'portrait',
        url: selectedMedia?.url ?? '',
        caption: `AI 초상화 (${STYLES.find((s) => s.key === selectedStyle)?.label})`,
        aiStyle: selectedStyle,
        sourceMediaId: selectedMediaId,
      })
      if (res.data.success) {
        setResult(res.data.data)
      }
    } catch (err) {
      setGenerateError(err.response?.data?.message || 'AI 초상화 생성에 실패했습니다.')
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
