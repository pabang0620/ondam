import { useState, useEffect, useCallback } from 'react'
import { petApi } from './petApi.js'

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
        setError(err.response?.data?.message || '반려동물 목록을 불러오지 못했습니다.')
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
