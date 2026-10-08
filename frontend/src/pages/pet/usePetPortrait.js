import { useState, useEffect, useCallback, useRef } from 'react'
import { petApi } from './petApi.js'

const STYLES = [
  { key: 'oil', label: '유화', desc: '고전적인 유화 스타일의 초상화' },
  { key: 'watercolor', label: '수채화', desc: '부드럽고 감성적인 수채화 스타일' },
  { key: 'illustration', label: '일러스트', desc: '따뜻한 느낌의 디지털 일러스트' },
]

export function usePetPortrait(petId) {
  const [media, setMedia] = useState([])
  // 스타일/사진 모두 기본 선택 없음으로 시작한다. 사용자가 직접 눌러야만 선택된다.
  const [selectedStyle, setSelectedStyle] = useState(null)
  const [selectedMediaId, setSelectedMediaId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mediaError, setMediaError] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [result, setResult] = useState(null)
  // 남은 AI 초상화 매수 (구독자 월 3매 / 무료 티어 평생 1회 체험) - null이면 아직 조회 전
  const [quota, setQuota] = useState(null)
  const [quotaError, setQuotaError] = useState(null)
  // 새 사진 추가(업로드) 상태 - 연타로 중복 업로드되지 않게 ref로 즉시 잠근다
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const uploadPendingRef = useRef(false)

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
    if (!petId) return
    setIsLoading(true)
    setMediaError(null)
    try {
      const res = await petApi.getPetMedia(petId, signal)
      if (res.data.success) {
        const list = res.data.data ?? []
        setMedia(list)
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

  // 반려동물 상세 페이지(usePetDetail.handleMediaUpload)와 동일한 경로:
  // POST /uploads/photo -> POST /pet/:petId/media. 성공하면 목록에 추가하고 즉시 선택한다.
  const handleMediaUpload = async (file) => {
    if (!file || !petId || uploadPendingRef.current) return
    uploadPendingRef.current = true
    setIsUploading(true)
    setUploadError(null)
    try {
      const uploadRes = await petApi.uploadPhoto(file)
      const { s3Key, url, mimeType, size } = uploadRes.data.data
      const addRes = await petApi.addPetMedia(petId, {
        mediaType: 'photo',
        fileUrl: url,
        s3Key,
        mimeType,
        fileSize: size,
      })
      if (addRes.data.success) {
        const added = addRes.data.data
        setMedia((prev) => [...prev, added])
        setSelectedMediaId(added.media_id)
      }
    } catch (err) {
      setUploadError(err?.response?.data?.message ?? '사진 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      uploadPendingRef.current = false
      setIsUploading(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedStyle || !selectedMediaId) return
    if (isGenerating || isUploading) return

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
      // [DEV-32] 실패한 시도는 매수에서 제외되므로(백엔드 petRepository 참조)
      // 실패 후에도 quota를 다시 불러와 화면의 남은 매수를 최신 상태로 맞춘다.
      setGenerateError(err?.response?.data?.message ?? err?.message ?? 'AI 초상화 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsGenerating(false)
      fetchQuota()
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
    quota,
    quotaError,
    isUploading,
    uploadError,
    handleMediaUpload,
  }
}
