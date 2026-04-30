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
      } catch (err) {
        console.warn('[mock] 유언장 목록 API 실패 — mock 활성 유언장 사용', err)
        const mockList = [{ willId: 'mock-will-001', title: '사랑하는 가족에게', status: 'active' }]
        setWills(mockList)
        setSelectedWillId('mock-will-001')
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
    } catch (err) {
      console.warn('[mock] 이벤트 유언장 생성 API 실패 — mock will_id 사용', err)
      const mockWillId = 'mock-event-will-' + Date.now().toString(36)
      localStorage.setItem('will_current_id', mockWillId)
      navigate(`/will/payment?willId=${mockWillId}`)
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
