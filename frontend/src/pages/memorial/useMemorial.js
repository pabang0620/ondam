import { useState, useEffect, useCallback } from 'react'
import { memorialApi } from './memorialApi.js'

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
      setError(err.response?.data?.message || '추모 페이지를 불러오지 못했습니다.')
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
