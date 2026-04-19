import { useState, useEffect, useCallback } from 'react'
import { mypageApi } from './mypageApi.js'

export function useMy() {
  const [user, setUser] = useState(null)
  const [photoOrders, setPhotoOrders] = useState([])
  const [wills, setWills] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationSettings, setNotificationSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSettingsUpdating, setIsSettingsUpdating] = useState(false)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [meRes, ordersRes, willsRes, unreadRes] = await Promise.all([
        mypageApi.getMe(),
        mypageApi.getPhotoOrders(),
        mypageApi.getWills(),
        mypageApi.getUnreadCount(),
      ])
      if (meRes.data.success) setUser(meRes.data.data)
      if (ordersRes.data.success) setPhotoOrders(ordersRes.data.data ?? [])
      if (willsRes.data.success) setWills(willsRes.data.data ?? [])
      if (unreadRes.data.success) setUnreadCount(unreadRes.data.data?.count ?? 0)
    } catch (err) {
      setError(err.response?.data?.message || '정보를 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchNotificationSettings = useCallback(async () => {
    try {
      const res = await mypageApi.getNotificationSettings()
      if (res.data.success) setNotificationSettings(res.data.data)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetchAll()
    return () => ac.abort()
  }, [fetchAll])

  const handleToggleNotification = async (key, value) => {
    if (isSettingsUpdating) return
    const prev = notificationSettings
    const next = { ...notificationSettings, [key]: value }
    setNotificationSettings(next)
    setIsSettingsUpdating(true)
    try {
      await mypageApi.updateNotificationSettings(next)
    } catch {
      setNotificationSettings(prev)
    } finally {
      setIsSettingsUpdating(false)
    }
  }

  return {
    user,
    photoOrders,
    wills,
    unreadCount,
    notificationSettings,
    isLoading,
    error,
    isSettingsUpdating,
    fetchNotificationSettings,
    handleToggleNotification,
  }
}
