import { useState, useEffect, useCallback } from 'react'
import { adminApi } from './adminApi.js'

const ALL = 'ALL'

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
      // FIX: DEV-24 - 주문 목록 조회 실패를 가짜 데이터로 위장하지 않는다
      setError(err?.response?.data?.message ?? '주문 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setOrders([])
      setTotal(0)
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
