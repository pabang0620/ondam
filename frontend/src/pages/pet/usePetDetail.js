import { useState, useEffect, useCallback } from 'react'
import { petApi } from './petApi.js'

export function usePetDetail(petId) {
  const [pet, setPet] = useState(null)
  const [media, setMedia] = useState([])
  // FIX: DEV-31 - useMemorial과 동일한 깜빡임. 초기값 false면 첫 페인트에서
  // PetDetailPage의 `error || !pet` 분기가 먼저 걸려 "반려동물 정보를 찾을 수
  // 없습니다"가 한 프레임 노출된다.
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [isStatusChanging, setIsStatusChanging] = useState(false)
  const [statusChangeError, setStatusChangeError] = useState(null)
  const [isSavingMemorial, setIsSavingMemorial] = useState(false)
  const [memorialSaveError, setMemorialSaveError] = useState(null)

  const fetchDetail = useCallback(async () => {
    // petId가 없으면 조회 자체가 불가능하다 - 초기값이 true이므로 여기서 내려주지
    // 않으면 "불러오는 중..."에서 영원히 멈춘다.
    if (!petId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const [petRes, mediaRes] = await Promise.all([
        petApi.getPet(petId),
        petApi.getPetMedia(petId),
      ])
      if (petRes.data.success) setPet(petRes.data.data)
      if (mediaRes.data.success) setMedia(mediaRes.data.data ?? [])
    } catch (err) {
      // FIX: DEV-24 - 반려동물 상세 조회 실패를 가짜 데이터로 위장하지 않는다
      setError(err?.response?.data?.message ?? '반려동물 정보를 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [petId])

  useEffect(() => {
    const ac = new AbortController()
    fetchDetail()
    return () => ac.abort()
  }, [fetchDetail])

  const handleMediaUpload = async (file) => {
    if (!file) return
    setIsUploading(true)
    setUploadError(null)
    try {
      const uploadRes = await petApi.uploadPhoto(file)
      // FIX D6 - mimeType/size는 항상 업로드 응답에 실려 있는데(uploadRoutes.js
      // POST /uploads/photo) 지금까지 꺼내지 않고 버려서, pet_media.mime_type/
      // file_size(둘 다 NOT NULL)가 항상 NULL로 INSERT 시도돼 500이 났다.
      const { s3Key, url, mimeType, size } = uploadRes.data.data
      const addRes = await petApi.addPetMedia(petId, {
        mediaType: 'photo',
        fileUrl: url,
        s3Key,
        mimeType,
        fileSize: size,
      })
      if (addRes.data.success) {
        setMedia((prev) => [...prev, addRes.data.data])
      }
    } catch (err) {
      // FIX: DEV-24 - 사진 업로드 실패를 가짜 blob 사진 추가로 위장하지 않는다
      setUploadError(err?.response?.data?.message ?? '사진 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleStatusChange = async () => {
    if (isStatusChanging) return
    setIsStatusChanging(true)
    setStatusChangeError(null)
    try {
      const res = await petApi.updatePetStatus(petId, 'deceased')
      if (res.data.success) {
        setPet((prev) => ({ ...prev, pet_status: 'deceased', ...res.data.data }))
      }
    } catch (err) {
      // FIX: DEV-24 - 상태 변경 API 실패를 로컬에서만 성공 처리하지 않는다
      setStatusChangeError(err?.response?.data?.message ?? '무지개다리 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsStatusChanging(false)
    }
  }

  // FIX: DEV-30 - 추모 페이지 접근 코드를 설정할 수 있는 유일한 API(PUT /api/pet/:petId)를
  // 호출하는 곳이 프론트에 하나도 없어서, 어떤 사용자도 코드를 설정할 수 없었고 그 결과
  // 모든 펫 추모 페이지가 영구 404였다(백엔드가 "접근 코드 없으면 비공개"로 확정했기 때문).
  // memorialSlug도 같은 이유로 함께 받는다 - 추모 페이지 URL(/memorial/:slug) 자체가
  // slug 없이는 존재할 수 없어서, 코드만 설정 가능하게 해서는 여전히 페이지에 도달할
  // 방법이 없다(PetDetailPage의 "추모 페이지 보기" 링크도 pet.memorial_slug가 있어야만
  // 렌더된다).
  const handleUpdateMemorialSettings = async ({ memorialSlug, memorialAccessCode, isPublic }) => {
    if (isSavingMemorial) return
    setIsSavingMemorial(true)
    setMemorialSaveError(null)
    try {
      const res = await petApi.updatePet(petId, { memorialSlug, memorialAccessCode, isPublic })
      if (res.data.success) {
        setPet((prev) => ({ ...prev, ...res.data.data }))
        return true
      }
      return false
    } catch (err) {
      // FIX: DEV-24 - 저장 실패를 로컬에서만 성공 처리하지 않는다
      setMemorialSaveError(err?.response?.data?.message ?? '추모 페이지 설정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      return false
    } finally {
      setIsSavingMemorial(false)
    }
  }

  return {
    pet,
    media,
    isLoading,
    error,
    isUploading,
    uploadError,
    isStatusChanging,
    statusChangeError,
    isSavingMemorial,
    memorialSaveError,
    handleMediaUpload,
    handleStatusChange,
    handleUpdateMemorialSettings,
    refetch: fetchDetail,
  }
}
