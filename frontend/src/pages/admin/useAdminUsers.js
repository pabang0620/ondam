import { useState, useEffect, useCallback } from 'react'
import { adminApi } from './adminApi.js'

const LIMIT = 20

const MOCK_USERS = [
  { userId: 'u-001', nickname: '김민수', email: 'minsu@example.com', role: 'user', createdAt: '2024-06-01T00:00:00.000Z', subscriptionPlan: '베이직' },
  { userId: 'u-002', nickname: '이지혜', email: 'jihye@example.com', role: 'user', createdAt: '2024-07-15T00:00:00.000Z', subscriptionPlan: null },
  { userId: 'u-003', nickname: '박동현', email: 'donghyun@example.com', role: 'user', createdAt: '2024-08-20T00:00:00.000Z', subscriptionPlan: '프리미엄' },
  { userId: 'u-004', nickname: '최수아', email: 'sua@example.com', role: 'user', createdAt: '2024-09-05T00:00:00.000Z', subscriptionPlan: null },
  { userId: 'u-005', nickname: '한지우', email: 'jiwoo@example.com', role: 'user', createdAt: '2024-10-11T00:00:00.000Z', subscriptionPlan: '베이직' },
  { userId: 'u-006', nickname: '정유진', email: 'yujin@example.com', role: 'user', createdAt: '2024-11-03T00:00:00.000Z', subscriptionPlan: null },
  { userId: 'u-007', nickname: '오준혁', email: 'junhyuk@example.com', role: 'admin', createdAt: '2024-12-19T00:00:00.000Z', subscriptionPlan: null },
  { userId: 'u-008', nickname: '윤서연', email: 'seoyeon@example.com', role: 'user', createdAt: '2025-01-08T00:00:00.000Z', subscriptionPlan: null },
  { userId: 'u-009', nickname: '임채원', email: 'chaewon@example.com', role: 'user', createdAt: '2025-02-14T00:00:00.000Z', subscriptionPlan: '베이직' },
  { userId: 'u-010', nickname: '강민지', email: 'minji@example.com', role: 'user', createdAt: '2025-03-22T00:00:00.000Z', subscriptionPlan: null },
]

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
      console.warn('[mock] 회원 목록 API 실패 - mock 데이터로 대체합니다', err)
      const filtered = q
        ? MOCK_USERS.filter(
            (u) =>
              u.nickname.includes(q) ||
              u.email.includes(q),
          )
        : MOCK_USERS
      setUsers(filtered)
      setTotal(filtered.length)
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
