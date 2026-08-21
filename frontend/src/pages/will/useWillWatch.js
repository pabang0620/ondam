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
      } catch (err) {
        // FIX: DEV-24 - 조회 실패를 가짜 유언 영상으로 위장하지 않는다
        setFetchError(err?.response?.data?.message ?? '영상을 찾을 수 없습니다. 링크가 만료되었거나 올바르지 않습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    load()
    return () => ac.abort()
  }, [token])

  return { willData, isLoading, fetchError }
}
