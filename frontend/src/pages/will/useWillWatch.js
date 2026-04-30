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
        console.warn('[mock] 유언 영상 조회 API 실패 — mock 영상 데이터 표시', err)
        setWillData({
          willId: 'mock-will-001',
          title: '사랑하는 가족에게',
          creatorName: '김온담',
          resultVideoUrl: 'https://placehold.co/1280x720/000000/ffffff?text=AI+유언+영상',
          releasedAt: new Date().toISOString(),
          message: '사랑하는 가족 여러분, 제가 살아있는 동안 전하지 못했던 말들을 이 영상에 담았습니다. 언제나 건강하고 행복하게 지내세요.',
        })
      } finally {
        setIsLoading(false)
      }
    }

    load()
    return () => ac.abort()
  }, [token])

  return { willData, isLoading, fetchError }
}
