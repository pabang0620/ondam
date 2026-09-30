import { useState, useEffect, useCallback, useRef } from 'react'
import { mypageApi } from './mypageApi.js'

const isCanceled = (err) => err?.name === 'CanceledError'

export function useMy() {
  const [user, setUser] = useState(null)
  const [photoOrders, setPhotoOrders] = useState([])
  const [wills, setWills] = useState([])
  const [notificationSettings, setNotificationSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  // FE-GMA-12: 조회별로 실패를 따로 기록한다. 예전에는 Promise.all이라 한 요청만
  // 실패해도 전체가 실패 처리됐고, 각 탭은 "내역이 없습니다"(빈 상태)로 보여 실제로
  // 비어 있는지 불러오지 못한 건지 구분할 수 없었다.
  const [errors, setErrors] = useState({ me: null, orders: null, wills: null })
  const [settingsError, setSettingsError] = useState(null)
  const [isSettingsUpdating, setIsSettingsUpdating] = useState(false)
  // FE-GMA-7: 알림 토글 저장 실패를 조용히 되돌리지 않고 알린다.
  const [toggleError, setToggleError] = useState(null)
  const togglePendingRef = useRef(false)

  // FIX: 결함4 - signal 미전달로 abort()가 무효했던 문제 수정
  // FE-GMA-12: unread-count는 이 화면 어디에서도 쓰지 않아 호출을 뺐다.
  const fetchAll = useCallback(async (signal) => {
    setIsLoading(true)
    setErrors({ me: null, orders: null, wills: null })
    const [meRes, ordersRes, willsRes] = await Promise.allSettled([
      mypageApi.getMe(signal),
      mypageApi.getPhotoOrders(signal),
      mypageApi.getWills(signal),
    ])
    if (signal?.aborted) return
    // FIX: DEV-24 - 마이페이지 조회 실패를 가짜 데이터로 위장하지 않는다
    const toError = (result, fallback) => {
      if (result.status === 'fulfilled') {
        return result.value?.data?.success ? null : fallback
      }
      if (isCanceled(result.reason)) return null
      return result.reason?.response?.data?.message ?? fallback
    }
    if (meRes.status === 'fulfilled' && meRes.value.data.success) setUser(meRes.value.data.data)
    if (ordersRes.status === 'fulfilled' && ordersRes.value.data.success) setPhotoOrders(ordersRes.value.data.data ?? [])
    if (willsRes.status === 'fulfilled' && willsRes.value.data.success) setWills(willsRes.value.data.data ?? [])
    setErrors({
      me: toError(meRes, '내 정보를 불러오지 못했습니다.'),
      orders: toError(ordersRes, '주문 내역을 불러오지 못했습니다.'),
      wills: toError(willsRes, '영상 편지 목록을 불러오지 못했습니다.'),
    })
    setIsLoading(false)
  }, [])

  const fetchNotificationSettings = useCallback(async () => {
    setSettingsError(null)
    try {
      const res = await mypageApi.getNotificationSettings()
      if (res.data.success) setNotificationSettings(res.data.data)
    } catch (err) {
      // FIX: DEV-24 - 알림 설정 조회 실패를 가짜 데이터로 위장하지 않는다
      setSettingsError(err?.response?.data?.message ?? '알림 설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchAll(ac.signal)
    return () => ac.abort()
  }, [fetchAll])

  const handleToggleNotification = async (key, value) => {
    if (togglePendingRef.current) return
    togglePendingRef.current = true
    const prev = notificationSettings
    const next = { ...notificationSettings, [key]: value }
    setNotificationSettings(next)
    setIsSettingsUpdating(true)
    setToggleError(null)
    try {
      await mypageApi.updateNotificationSettings(next)
    } catch (err) {
      setNotificationSettings(prev)
      setToggleError(err?.response?.data?.message ?? '알림 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSettingsUpdating(false)
      togglePendingRef.current = false
    }
  }

  return {
    user,
    photoOrders,
    wills,
    notificationSettings,
    isLoading,
    errors,
    settingsError,
    toggleError,
    isSettingsUpdating,
    refetch: () => fetchAll(),
    fetchNotificationSettings,
    handleToggleNotification,
  }
}
