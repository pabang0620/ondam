import { useState, useEffect, useCallback } from 'react'
import { petApi } from './petApi.js'

// 주의: refetch 는 fetchPets(signal) 형태다. onClick={refetch} 로 넘기면 이벤트가 signal 로 들어가므로 () => refetch() 로 호출할 것.
export function usePet({ enabled = true } = {}) {
  const [pets, setPets] = useState([])
  const [isLoading, setIsLoading] = useState(enabled)
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
    if (!enabled) {
      setIsLoading(false)
      return
    }
    const ac = new AbortController()
    fetchPets(ac.signal)
    return () => ac.abort()
  }, [fetchPets, enabled])

  return { pets, isLoading, error, refetch: fetchPets }
}
