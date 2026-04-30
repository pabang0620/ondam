import { useState, useEffect, useCallback } from 'react'
import { memorialApi } from './memorialApi.js'

const MOCK_PET = {
  petId: 'mock-pet-001',
  name: '故 김순자 님',
  birthDate: '1942-03-15',
  deathDate: '2024-11-20',
  breed: '사랑받은 가족',
  profileImageUrl: 'https://picsum.photos/seed/portrait1/600/800?grayscale',
}

const MOCK_MEDIA = [
  { mediaId: 'mock-m-001', url: 'https://picsum.photos/seed/memorial1/600/800', caption: '함께한 봄날' },
  { mediaId: 'mock-m-002', url: 'https://picsum.photos/seed/memorial2/600/800', caption: '가족 여행의 추억' },
  { mediaId: 'mock-m-003', url: 'https://picsum.photos/seed/memorial3/600/800', caption: '행복했던 날들' },
  { mediaId: 'mock-m-004', url: 'https://picsum.photos/seed/memorial4/600/800', caption: '소중한 순간' },
  { mediaId: 'mock-m-005', url: 'https://picsum.photos/seed/memorial5/600/800', caption: '영원히 기억할게요' },
  { mediaId: 'mock-m-006', url: 'https://picsum.photos/seed/memorial6/600/800', caption: '마지막 미소' },
]

export function useMemorial(slug) {
  const [pet, setPet] = useState(null)
  const [media, setMedia] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchMemorial = useCallback(async () => {
    if (!slug) return
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await memorialApi.getMemorial(slug)
      if (data.success) {
        setPet(data.data.pet)
        setMedia(data.data.media ?? [])
      }
    } catch (err) {
      console.warn('[mock] 추모 페이지 API 실패 - mock 데이터로 대체합니다', err)
      setPet(MOCK_PET)
      setMedia(MOCK_MEDIA)
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    const ac = new AbortController()
    fetchMemorial()
    return () => ac.abort()
  }, [fetchMemorial])

  return { pet, media, isLoading, error }
}
