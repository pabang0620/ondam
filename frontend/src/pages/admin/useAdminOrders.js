import { useState, useEffect, useCallback } from 'react'
import { adminApi } from './adminApi.js'

const ALL = 'ALL'

const MOCK_ORDERS = [
  {
    orderId: 'mock-ord-001',
    userId: 'mock-u-001',
    userName: '이민준',
    userEmail: 'minjun@example.com',
    photoType: 'funeral',
    status: 'completed',
    amountKrw: 29000,
    createdAt: '2026-03-10T10:00:00.000Z',
  },
  {
    orderId: 'mock-ord-002',
    userId: 'mock-u-002',
    userName: '박서연',
    userEmail: 'seoyeon@example.com',
    photoType: 'id',
    status: 'paid',
    amountKrw: 19000,
    createdAt: '2026-03-15T14:20:00.000Z',
  },
  {
    orderId: 'mock-ord-003',
    userId: 'mock-u-003',
    userName: '최준혁',
    userEmail: 'junhyuk@example.com',
    photoType: 'funeral',
    status: 'processing',
    amountKrw: 29000,
    createdAt: '2026-04-01T09:30:00.000Z',
  },
  {
    orderId: 'mock-ord-004',
    userId: 'mock-u-004',
    userName: '정수아',
    userEmail: 'sua@example.com',
    photoType: 'id',
    status: 'refunded',
    amountKrw: 19000,
    createdAt: '2026-04-10T16:45:00.000Z',
  },
  {
    orderId: 'mock-ord-005',
    userId: 'mock-u-005',
    userName: '한지우',
    userEmail: 'jiwoo@example.com',
    photoType: 'funeral',
    status: 'pending',
    amountKrw: 29000,
    createdAt: '2026-04-28T08:10:00.000Z',
  },
]

export function useAdminOrders() {
  const [orders, setOrders] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchOrders = useCallback(async (p, status) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await adminApi.getOrders(p, status === ALL ? '' : status, 20)
      if (data.success) {
        setOrders(data.data ?? [])
        setTotal(data.meta?.total ?? 0)
      }
    } catch (err) {
      console.warn('[mock] 주문 목록 API 실패 - mock 데이터로 대체합니다', err)
      const filtered = status === ALL
        ? MOCK_ORDERS
        : MOCK_ORDERS.filter((o) => o.status === status)
      setOrders(filtered)
      setTotal(filtered.length)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchOrders(page, statusFilter)
    return () => ac.abort()
  }, [fetchOrders, page, statusFilter])

  const handleStatusFilter = (status) => {
    setStatusFilter(status)
    setPage(1)
  }

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
  }

  return {
    orders,
    page,
    total,
    statusFilter,
    isLoading,
    error,
    handleStatusFilter,
    handlePageChange,
    refetch: () => fetchOrders(page, statusFilter),
  }
}
