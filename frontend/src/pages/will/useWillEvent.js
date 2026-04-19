import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { willApi } from './willApi.js'

const EVENT_TYPES = [
  { value: 'wedding', label: '결혼식', emoji: '💍' },
  { value: 'birth', label: '탄생', emoji: '👶' },
  { value: 'birthday', label: '생일', emoji: '🎂' },
]

export function useWillEvent() {
  const navigate = useNavigate()
  const [wills, setWills] = useState([])
  const [selectedWillId, setSelectedWillId] = useState('')
  const [eventType, setEventType] = useState('wedding')
  const [contentText, setContentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    const ac = new AbortController()

    const load = async () => {
      try {
        const { data } = await willApi.getWills()
        const list = (data.data || []).filter((w) => w.status === 'active')
        setWills(list)
        if (list.length > 0) setSelectedWillId(list[0].id || list[0].willId)
      } catch {
        // 목록 로드 실패는 조용히 처리
      }
    }

    load()
    return () => ac.abort()
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!contentText.trim()) {
      setSubmitError('이벤트 메시지를 입력해 주세요.')
      return
    }

    const pendingRef = { current: false }
    if (pendingRef.current) return
    pendingRef.current = true

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        voiceSampleId: selectedWillId,
        title: `${EVENT_TYPES.find((e) => e.value === eventType)?.label} 영상`,
        contentText,
        releasePolicy: 'manual_admin',
        eventType,
        beneficiaries: [],
      }
      const { data } = await willApi.createWill(payload)
      const willId = data.data?.willId || data.data?.id
      navigate(`/will/payment?willId=${willId}`)
    } catch {
      setSubmitError('이벤트 영상 생성 요청에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
      pendingRef.current = false
    }
  }, [contentText, eventType, selectedWillId, navigate])

  return {
    wills,
    selectedWillId,
    setSelectedWillId,
    eventTypes: EVENT_TYPES,
    eventType,
    setEventType,
    contentText,
    setContentText,
    isSubmitting,
    submitError,
    handleSubmit,
  }
}
