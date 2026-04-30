import { useState, useEffect, useCallback } from 'react'
import { petApi } from './petApi.js'

const MOCK_PETS = {
  'mock-pet-001': {
    pet_id: 'mock-pet-001',
    user_id: 'mock-user-001',
    name: '콩이',
    species: 'dog',
    breed: '골든리트리버',
    pet_status: 'alive',
    birth_date: '2018-03-15',
    death_date: null,
    memorial_slug: null,
    profile_image_url: 'https://picsum.photos/seed/golden-retriever/600/600',
  },
  'mock-pet-002': {
    pet_id: 'mock-pet-002',
    user_id: 'mock-user-001',
    name: '나비',
    species: 'cat',
    breed: '코리안숏헤어',
    pet_status: 'deceased',
    birth_date: '2010-06-01',
    death_date: '2024-02-14',
    memorial_slug: 'navi-2024',
    profile_image_url: 'https://picsum.photos/seed/shorthair-cat/600/600',
  },
}

const MOCK_MEDIA = {
  'mock-pet-001': [
    { media_id: 'media-001', pet_id: 'mock-pet-001', media_type: 'photo', file_url: 'https://picsum.photos/seed/dog1/600/600', caption: '공원 산책', taken_at: '2023-05-10', sort_order: 1 },
    { media_id: 'media-002', pet_id: 'mock-pet-001', media_type: 'photo', file_url: 'https://picsum.photos/seed/dog2/600/600', caption: '생일 파티', taken_at: '2023-03-15', sort_order: 2 },
    { media_id: 'media-003', pet_id: 'mock-pet-001', media_type: 'photo', file_url: 'https://picsum.photos/seed/dog3/600/600', caption: '겨울 눈밭', taken_at: '2023-01-20', sort_order: 3 },
    { media_id: 'media-004', pet_id: 'mock-pet-001', media_type: 'photo', file_url: 'https://picsum.photos/seed/dog4/600/600', caption: '낮잠 중', taken_at: '2022-11-05', sort_order: 4 },
    { media_id: 'media-005', pet_id: 'mock-pet-001', media_type: 'photo', file_url: 'https://picsum.photos/seed/dog5/600/600', caption: '목욕 후', taken_at: '2022-08-30', sort_order: 5 },
    { media_id: 'media-006', pet_id: 'mock-pet-001', media_type: 'photo', file_url: 'https://picsum.photos/seed/dog6/600/600', caption: '가족 사진', taken_at: '2022-05-05', sort_order: 6 },
    { media_id: 'media-007', pet_id: 'mock-pet-001', media_type: 'video', file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', caption: '공 놀이', taken_at: '2023-07-01', sort_order: 7 },
  ],
  'mock-pet-002': [
    { media_id: 'media-101', pet_id: 'mock-pet-002', media_type: 'photo', file_url: 'https://picsum.photos/seed/cat1/600/600', caption: '창가에서', taken_at: '2023-10-10', sort_order: 1 },
    { media_id: 'media-102', pet_id: 'mock-pet-002', media_type: 'photo', file_url: 'https://picsum.photos/seed/cat2/600/600', caption: '따뜻한 햇살', taken_at: '2023-06-15', sort_order: 2 },
  ],
}

function getMockPet(petId) {
  return MOCK_PETS[petId] ?? {
    pet_id: petId,
    user_id: 'mock-user-001',
    name: '우리 아이',
    species: 'dog',
    breed: '',
    pet_status: 'alive',
    birth_date: null,
    death_date: null,
    memorial_slug: null,
    profile_image_url: 'https://picsum.photos/seed/pet-default/600/600',
  }
}

function getMockMedia(petId) {
  return MOCK_MEDIA[petId] ?? []
}

export function usePetDetail(petId) {
  const [pet, setPet] = useState(null)
  const [media, setMedia] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [isStatusChanging, setIsStatusChanging] = useState(false)

  const fetchDetail = useCallback(async () => {
    if (!petId) return
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
      console.warn('[mock] usePetDetail.fetchDetail - 백엔드 응답 없음, mock 데이터로 대체', err)
      setPet(getMockPet(petId))
      setMedia(getMockMedia(petId))
    } finally {
      setIsLoading(false)
    }
  }, [petId])

  useEffect(() => {
    const ac = new AbortController()
    fetchDetail()
    return () => ac.abort()
  }, [fetchDetail])

  // mock blob URL cleanup - unmount 시 생성된 objectURL 해제
  useEffect(() => {
    return () => {
      setMedia((prev) => {
        prev.filter((m) => m._isMockBlob).forEach((m) => URL.revokeObjectURL(m.file_url))
        return prev
      })
    }
  }, [])

  const handleMediaUpload = async (file) => {
    if (!file) return
    setIsUploading(true)
    setUploadError(null)
    try {
      const uploadRes = await petApi.uploadPhoto(file)
      const { s3Key, url } = uploadRes.data.data
      const addRes = await petApi.addPetMedia(petId, {
        mediaType: 'photo',
        fileUrl: url,
        s3Key,
      })
      if (addRes.data.success) {
        setMedia((prev) => [...prev, addRes.data.data])
      }
    } catch (err) {
      console.warn('[mock] usePetDetail.handleMediaUpload - 업로드 실패, mock 사진 추가', err)
      const mockObjectUrl = URL.createObjectURL(file)
      const mockMedia = {
        media_id: `mock-upload-${Date.now()}`,
        pet_id: petId,
        media_type: 'photo',
        file_url: mockObjectUrl,
        caption: '업로드된 사진',
        taken_at: new Date().toISOString(),
        sort_order: media.length + 1,
        _isMockBlob: true,
      }
      setMedia((prev) => [...prev, mockMedia])
    } finally {
      setIsUploading(false)
    }
  }

  const handleStatusChange = async () => {
    if (isStatusChanging) return
    setIsStatusChanging(true)
    try {
      const res = await petApi.updatePetStatus(petId, 'deceased')
      if (res.data.success) {
        setPet((prev) => ({ ...prev, pet_status: 'deceased', ...res.data.data }))
      }
    } catch (err) {
      console.warn('[mock] usePetDetail.handleStatusChange - API 실패, 로컬 상태만 변경', err)
      setPet((prev) => prev ? { ...prev, pet_status: 'deceased', memorial_slug: `memorial-${petId}` } : prev)
    } finally {
      setIsStatusChanging(false)
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
    handleMediaUpload,
    handleStatusChange,
    refetch: fetchDetail,
  }
}
