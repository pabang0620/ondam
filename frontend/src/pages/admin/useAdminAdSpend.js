import { useState, useEffect, useCallback } from 'react'
import { adminApi } from './adminApi.js'

const toISODate = (d) => d.toISOString().slice(0, 10)
const todayISO = () => toISODate(new Date())
const monthAgoISO = () => {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return toISODate(d)
}

const EMPTY_FORM = { channel: '', periodStart: '', periodEnd: '', spendKrw: '', note: '' }

export function useAdminAdSpend() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const [recentChannels, setRecentChannels] = useState([])

  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const [cacRange, setCacRange] = useState({ startDate: monthAgoISO(), endDate: todayISO() })
  const [cacResult, setCacResult] = useState(null)
  const [isCacLoading, setIsCacLoading] = useState(false)
  const [cacError, setCacError] = useState(null)

  // FIX: 결함4 - signal 미전달로 abort()가 무효했던 문제 수정
  const fetchList = useCallback(async (p = 1, signal) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await adminApi.getAdSpendList(p, 20, '', signal)
      if (data.success) {
        setItems(data.data ?? [])
        setTotal(data.meta?.total ?? 0)
      }
    } catch (err) {
      if (err.name === 'CanceledError') return
      // 조회 실패를 가짜 데이터로 위장하지 않는다 (다른 admin 훅과 동일 원칙)
      setError(err?.response?.data?.message ?? '광고비 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setItems([])
      setTotal(0)
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [])

  const fetchRecentChannels = useCallback(async () => {
    try {
      const { data } = await adminApi.getRecentChannels()
      if (data.success) setRecentChannels(data.data ?? [])
    } catch {
      // 자동완성 제안일 뿐이라 실패해도 입력 자체는 계속 가능 - 조용히 무시
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchList(page, ac.signal)
    return () => ac.abort()
  }, [fetchList, page])

  useEffect(() => {
    fetchRecentChannels()
  }, [fetchRecentChannels])

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const startEdit = (item) => {
    setEditingId(item.adSpendId)
    setFormError(null)
    setForm({
      channel: item.channel,
      periodStart: String(item.periodStart).slice(0, 10),
      periodEnd: String(item.periodEnd).slice(0, 10),
      spendKrw: String(item.spendKrw),
      note: item.note ?? '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  const submitForm = async (e) => {
    e.preventDefault()
    setFormError(null)

    if (!form.channel.trim() || !form.periodStart || !form.periodEnd || form.spendKrw === '') {
      setFormError('채널·기간·광고비를 모두 입력해 주세요.')
      return
    }
    if (form.periodEnd < form.periodStart) {
      setFormError('종료일은 시작일보다 빠를 수 없습니다.')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        channel: form.channel.trim(),
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        spendKrw: Number(form.spendKrw),
        ...(form.note.trim() && { note: form.note.trim() }),
      }
      if (editingId) {
        await adminApi.updateAdSpend(editingId, payload)
      } else {
        await adminApi.createAdSpend(payload)
      }
      cancelEdit()
      await fetchList(page)
      await fetchRecentChannels()
    } catch (err) {
      setFormError(err?.response?.data?.message ?? '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSaving(false)
    }
  }

  const removeItem = async (id) => {
    try {
      await adminApi.deleteAdSpend(id)
      if (editingId === id) cancelEdit()
      await fetchList(page)
    } catch (err) {
      setError(err?.response?.data?.message ?? '삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  const updateCacRange = (field, value) => setCacRange((prev) => ({ ...prev, [field]: value }))

  const fetchCac = async () => {
    setIsCacLoading(true)
    setCacError(null)
    try {
      const { data } = await adminApi.getCac(cacRange.startDate, cacRange.endDate)
      if (data.success) setCacResult(data.data)
    } catch (err) {
      setCacError(err?.response?.data?.message ?? 'CAC 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      setCacResult(null)
    } finally {
      setIsCacLoading(false)
    }
  }

  return {
    items,
    total,
    page,
    setPage,
    isLoading,
    error,
    recentChannels,
    form,
    updateField,
    editingId,
    startEdit,
    cancelEdit,
    submitForm,
    isSaving,
    formError,
    removeItem,
    cacRange,
    updateCacRange,
    cacResult,
    isCacLoading,
    cacError,
    fetchCac,
  }
}
