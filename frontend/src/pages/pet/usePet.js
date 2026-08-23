import { useState, useEffect, useCallback } from 'react'
import { petApi } from './petApi.js'

export function usePet() {
  const [pets, setPets] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // FIX: 결함4 - signal이 petApi.getPets()에 전달되지 않아 AbortController.abort()가
  // 무효했다(무효한 코드). 이제 signal을 실제로 전달한다.
  const fetchPets = useCallback(async (signal) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await petApi.getPets(signal)
      if (data.success) setPets(data.data)
    } catch (err) {
      // FIX: DEV-24 - 반려동물 목록 조회 실패를 가짜 데이터로 위장하지 않는다
      if (err.name !== 'CanceledError') {
        setError(err?.response?.data?.message ?? '반려동물 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchPets(ac.signal)
    return () => ac.abort()
  }, [fetchPets])

  return { pets, isLoading, error, refetch: fetchPets }
}
