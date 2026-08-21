import { useState, useEffect, useCallback } from 'react'
import { adminApi } from './adminApi.js'

const LIMIT = 20

export function useAdminUsers() {
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchUsers = useCallback(async (p, q) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await adminApi.getUsers(p, q, LIMIT)
      if (data.success) {
        setUsers(data.data ?? [])
        setTotal(data.meta?.total ?? 0)
      }
    } catch (err) {
      // FIX: DEV-24 - 회원 목록 조회 실패를 가짜 데이터로 위장하지 않는다
      setError(err?.response?.data?.message ?? '회원 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setUsers([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchUsers(page, search)
    return () => ac.abort()
  }, [fetchUsers, page, search])

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
  }

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
  }

  const totalPages = Math.ceil(total / LIMIT) || 1

  return {
    users,
    page,
    total,
    totalPages,
    searchInput,
    isLoading,
    error,
    setSearchInput,
    handleSearch,
    handlePageChange,
  }
}
