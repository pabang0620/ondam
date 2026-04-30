import { useState, useEffect, useCallback } from 'react'
import { willApi } from './willApi.js'

const MOCK_WILLS = [
  {
    willId: 'mock-will-001',
    title: '사랑하는 가족에게',
    status: 'active',
    releasePolicy: 'manual_admin',
    releaseStatus: 'locked',
    eventType: null,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    resultVideoUrl: 'https://placehold.co/1280x720/000000/ffffff?text=AI+유언+영상',
    beneficiaries: [
      {
        beneficiaryId: 'mock-ben-001',
        name: '김민준',
        relationship: 'child',
        email: 'minjun@example.com',
        verifiedAt: null,
      },
      {
        beneficiaryId: 'mock-ben-002',
        name: '이지은',
        relationship: 'spouse',
        email: 'jieun@example.com',
        verifiedAt: new Date().toISOString(),
      },
    ],
  },
]

export function useWillVault() {
  const [wills, setWills] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const fetchWills = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const { data } = await willApi.getWills()
      setWills(data.data || [])
    } catch (err) {
      console.warn('[mock] 유언장 목록 API 실패 — mock 데이터 표시', err)
      setWills(MOCK_WILLS)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchWills()
    return () => ac.abort()
  }, [fetchWills])

  return { wills, isLoading, fetchError, refetch: fetchWills }
}
