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
  const [willsError, setWillsError] = useState(null)

  useEffect(() => {
    const ac = new AbortController()

    const load = async () => {
      setWillsError(null)
      try {
        const { data } = await willApi.getWills()
        const list = (data.data || []).filter((w) => w.status === 'active')
        setWills(list)
        if (list.length > 0) setSelectedWillId(list[0].id || list[0].willId)
      } catch (err) {
        // FIX: DEV-27 - 조회 실패를 빈 목록으로 조용히 흘려보내지 않는다. 빈 목록은
        // "유언장이 없음"으로 보여 조회 실패를 사용자가 오인하게 되고, 그 상태로 제출하면
        // voiceSampleId가 빈 값으로 전송돼 서버 400을 유발한다(G2-2).
        setWills([])
        setWillsError(err?.response?.data?.message ?? '유언장 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
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

    // FIX: DEV-27 - 목록 조회 실패(willsError)나 유언장이 아직 없는 경우 selectedWillId가
    // 빈 문자열이다. 이 상태로 제출하면 voiceSampleId가 빈 값으로 전송돼 서버 400을
    // 유발하므로, 여기서 먼저 막고 사용자에게 원인을 알려준다.
    if (!selectedWillId) {
      setSubmitError(
        willsError ?? '사용할 유언장이 없습니다. 먼저 유언장을 등록해 주세요.',
      )
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
      // FIX: DEV-24 - 생성 실패를 가짜 will_id로 위장해 결제 단계로 진행시키지 않는다
      setSubmitError(err?.response?.data?.message ?? '이벤트 영상 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
      pendingRef.current = false
    }
  }, [contentText, eventType, selectedWillId, willsError, navigate])

  return {
    wills,
    willsError,
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
