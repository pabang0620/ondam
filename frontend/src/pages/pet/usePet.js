import { useState, useEffect, useCallback } from 'react'
import { petApi } from './petApi.js'

const MOCK_PETS = [
  {
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
  {
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
]

export function usePet() {
  const [pets, setPets] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchPets = useCallback(async (signal) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await petApi.getPets()
      if (data.success) setPets(data.data)
    } catch (err) {
      if (err.name !== 'CanceledError') {
        console.warn('[mock] usePet.fetchPets - 백엔드 응답 없음, mock 데이터로 대체', err)
        setPets(MOCK_PETS)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchPets(ac.signal)
    return () => ac.abort()
  }, [fetchPets])

  return { pets, isLoading, error, refetch: fetchPets }
}
