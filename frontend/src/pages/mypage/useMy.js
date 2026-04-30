import { useState, useEffect, useCallback } from 'react'
import { mypageApi } from './mypageApi.js'
import { useAuthStore } from '../../store/authStore.js'

const MOCK_PHOTO_ORDERS = [
  {
    orderId: 'mock-order-001',
    photoType: 'funeral',
    status: 'completed',
    createdAt: '2025-10-12T09:00:00.000Z',
  },
  {
    orderId: 'mock-order-002',
    photoType: 'id',
    status: 'processing',
    createdAt: '2025-11-05T14:30:00.000Z',
  },
  {
    orderId: 'mock-order-003',
    photoType: 'funeral',
    status: 'pending',
    createdAt: '2026-01-20T11:15:00.000Z',
  },
]

const MOCK_WILLS = [
  {
    willId: 'mock-will-0001-uuid',
    title: '소중한 가족에게 남기는 말',
    status: 'completed',
    createdAt: '2025-09-01T08:00:00.000Z',
  },
]

const MOCK_NOTIFICATION_SETTINGS = {
  emailMarketing: false,
  pushOrder: true,
  pushWill: true,
  pushPromotion: false,
}

export function useMy() {
  const authUser = useAuthStore((s) => s.user)
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
      console.warn('[mock] 마이페이지 API 실패 - mock 데이터로 대체합니다', err)
      setUser(
        authUser
          ? {
              nickname: authUser.nickname || '데모 사용자',
              email: authUser.email || 'demo@ondam.kr',
            }
          : { nickname: '데모 사용자', email: 'demo@ondam.kr' },
      )
      setPhotoOrders(MOCK_PHOTO_ORDERS)
      setWills(MOCK_WILLS)
      setUnreadCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [authUser])

  const fetchNotificationSettings = useCallback(async () => {
    try {
      const res = await mypageApi.getNotificationSettings()
      if (res.data.success) setNotificationSettings(res.data.data)
    } catch (err) {
      console.warn('[mock] 알림 설정 API 실패 - mock 데이터로 대체합니다', err)
      setNotificationSettings(MOCK_NOTIFICATION_SETTINGS)
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
