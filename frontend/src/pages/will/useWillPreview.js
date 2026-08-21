import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { willApi } from './willApi.js'

export function useWillPreview() {
  const navigate = useNavigate()

  const consents = JSON.parse(localStorage.getItem('will_consents') || '{}')
  const beneficiaries = JSON.parse(localStorage.getItem('will_beneficiaries') || '[]')
  const audioS3Key = localStorage.getItem('will_audio_s3key') || ''
  const voiceSampleId = localStorage.getItem('will_voice_sample_id') || ''
  const photoS3Key = localStorage.getItem('will_photo_s3key') || ''

  // 중간 단계 새로고침 시 필수 데이터 누락 여부 검사 → 이전 단계로 redirect
  useEffect(() => {
    const consentValues = Object.values(consents)
    const hasConsent = consentValues.length > 0 && consentValues.every(Boolean)
    if (!hasConsent) {
      navigate('/will/consent', { replace: true })
      return
    }
    if (beneficiaries.length === 0) {
      navigate('/will/beneficiaries', { replace: true })
      return
    }
    if (!audioS3Key) {
      navigate('/will/record', { replace: true })
      return
    }
    if (!photoS3Key) {
      navigate('/will/photo', { replace: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [title, setTitle] = useState('나의 유언장')
  const [contentText, setContentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const handleSubmit = useCallback(async () => {
    if (!voiceSampleId) {
      setSubmitError('음성 샘플이 준비되지 않았습니다. 이전 단계(녹음)로 돌아가세요.')
      return
    }
    if (!contentText.trim()) {
      setSubmitError('유언 메시지를 입력해 주세요.')
      return
    }
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        voiceSampleId: voiceSampleId,
        title,
        contentText,
        releasePolicy: 'manual_admin',
        beneficiaries: beneficiaries.map(({ name, email, phone, relationship }) => ({
          name,
          email,
          phone,
          relationship,
        })),
      }

      const { data } = await willApi.createWill(payload)
      const willId = data.data?.willId || data.data?.id
      localStorage.setItem('will_current_id', willId)
      navigate(`/will/payment?willId=${willId}`)
    } catch (err) {
      // FIX: DEV-24 - 생성 실패를 가짜 will_id로 위장해 결제 단계로 진행시키지 않는다
      setSubmitError(err?.response?.data?.message ?? '유언장 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }, [voiceSampleId, beneficiaries, contentText, navigate, title])

  return {
    consents,
    beneficiaries,
    audioS3Key,
    voiceSampleId,
    photoS3Key,
    title,
    setTitle,
    contentText,
    setContentText,
    isSubmitting,
    submitError,
    handleSubmit,
  }
}
