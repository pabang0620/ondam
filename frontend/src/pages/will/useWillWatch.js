import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { willApi } from './willApi.js'

export function useWillWatch() {
  const { token } = useParams()
  const [willData, setWillData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    if (!token) return

    const ac = new AbortController()

    const load = async () => {
      setIsLoading(true)
      setFetchError(null)
      try {
        const { data } = await willApi.watchWill(token)
        setWillData(data.data)
      } catch {
        setFetchError('영상을 불러오지 못했습니다. 링크가 유효하지 않거나 만료되었습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    load()
    return () => ac.abort()
  }, [token])

  return { willData, isLoading, fetchError }
}
