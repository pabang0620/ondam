import { useState, useEffect, useCallback } from 'react'
import { getMyGifts, resendGiftLink, cancelGift } from './giftApi.js'

const STATUS_LABELS = {
  paid: '결제 대기',
  link_sent: '링크 발송됨',
  opened: '링크 열람됨',
  in_progress: '진행 중',
  completed: '완성됨',
  declined: '거절됨',
  refunded: '환불됨',
  expired: '만료됨',
}

function useGiftMine() {
  const [gifts, setGifts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionState, setActionState] = useState({}) // giftId -> 'resending' | 'canceling' | 'done'

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await getMyGifts(1, 20)
      setGifts(data.data ?? [])
    } catch (err) {
      setError(err?.response?.data?.message ?? '선물 목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleResend = useCallback(async (giftId) => {
    setActionState((s) => ({ ...s, [giftId]: 'resending' }))
    try {
      await resendGiftLink(giftId)
      setActionState((s) => ({ ...s, [giftId]: 'resent' }))
      await load()
    } catch (err) {
      setError(err?.response?.data?.message ?? '재발급에 실패했습니다.')
      setActionState((s) => ({ ...s, [giftId]: null }))
    }
  }, [load])

  const handleCancel = useCallback(async (giftId) => {
    setActionState((s) => ({ ...s, [giftId]: 'canceling' }))
    try {
      await cancelGift(giftId)
      await load()
    } catch (err) {
      setError(err?.response?.data?.message ?? '취소에 실패했습니다.')
    } finally {
      setActionState((s) => ({ ...s, [giftId]: null }))
    }
  }, [load])

  return { gifts, isLoading, error, actionState, statusLabels: STATUS_LABELS, handleResend, handleCancel }
}

export default useGiftMine
