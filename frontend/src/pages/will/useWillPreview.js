import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { willApi } from './willApi.js'
import { readWillJson } from './willStorage.js'

export function useWillPreview() {
  const navigate = useNavigate()

  const consents = readWillJson('will_consents', {})
  const storedBeneficiaries = readWillJson('will_beneficiaries', [])
  const beneficiaries = Array.isArray(storedBeneficiaries) ? storedBeneficiaries : []
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

  const [title, setTitle] = useState('나의 영상 편지')
  const [contentText, setContentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  // 서버 오류 code - VOICE_NOT_READY(대기 안내) / VOICE_FAILED(재녹음 안내) 분기용
  const [submitErrorCode, setSubmitErrorCode] = useState(null)

  const handleSubmit = useCallback(async () => {
    setSubmitErrorCode(null)
    if (!voiceSampleId) {
      setSubmitError('음성 샘플이 준비되지 않았습니다. 이전 단계(녹음)로 돌아가세요.')
      return
    }
    if (!contentText.trim()) {
      setSubmitError('편지 내용을 입력해 주세요.')
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
      // 백엔드 계약: createWill 응답 data는 { willId, will_id } 둘 다 담는다.
      // 어느 쪽도 없으면 willId=undefined로 결제 페이지에 가지 않도록 여기서 멈춘다.
      const willId = data?.data?.willId ?? data?.data?.will_id
      if (!willId) {
        setSubmitError('영상 편지 정보를 받지 못했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      localStorage.setItem('will_current_id', willId)
      navigate(`/will/payment?willId=${encodeURIComponent(willId)}`)
    } catch (err) {
      // FIX: DEV-24 - 생성 실패를 가짜 will_id로 위장해 결제 단계로 진행시키지 않는다
      const code = err?.response?.data?.code ?? null
      setSubmitErrorCode(code)
      if (code === 'VOICE_NOT_READY') {
        setSubmitError('목소리를 아직 준비하고 있습니다. 잠시 뒤 다시 "제작 시작" 버튼을 눌러 주세요.')
      } else if (code === 'VOICE_FAILED') {
        setSubmitError('녹음된 목소리를 처리하지 못했습니다. 번거로우시겠지만 다시 녹음해 주세요.')
      } else {
        setSubmitError(err?.response?.data?.message ?? '영상 편지 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
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
    submitErrorCode,
    handleSubmit,
  }
}
