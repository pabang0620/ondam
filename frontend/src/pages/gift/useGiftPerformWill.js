import { useState, useCallback, useRef, useEffect } from 'react'
import apiClient from '../../config/apiClient.js'
// will 도메인의 검증된 API 호출 함수를 그대로 재사용한다(재설계 없음) - 음성 클론·
// 유언장 생성·영상 활성화·상태폴링 로직은 willApi.js/willService.js와 동일하다.
import { willApi } from '../will/willApi.js'
import { uploadPhoto } from '../photo/photoApi.js'
import { attachWillOrder, completeGift } from './giftApi.js'

export const STEP = {
  CONSENT: 'consent',
  PHOTO: 'photo',
  VOICE: 'voice',
  MESSAGE: 'message',
  BENEFICIARY: 'beneficiary',
  GENERATING: 'generating',
  DONE: 'done',
  ERROR: 'error',
}

function useGiftPerformWill() {
  const giftId = sessionStorage.getItem('giftContentGiftId')

  const [step, setStep] = useState(STEP.CONSENT)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [profileImageUrl, setProfileImageUrl] = useState(null)
  const [voiceSampleId, setVoiceSampleId] = useState(null)
  const [title, setTitle] = useState('')
  const [contentText, setContentText] = useState('')
  const [beneficiary, setBeneficiary] = useState({ name: '', email: '', phone: '', relationship: '' })

  const pollRef = useRef(null)
  useEffect(() => () => clearInterval(pollRef.current), [])

  const submitConsent = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post('/auth/consents', { consents: [{ consentType: 'voice', isAgreed: true }] })
      setStep(STEP.PHOTO)
    } catch (err) {
      setError(err?.response?.data?.message ?? '동의 저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }, [])

  const uploadProfilePhoto = useCallback(async (file) => {
    setBusy(true)
    setError(null)
    try {
      const { data } = await uploadPhoto(file)
      const url = data.data.url
      await apiClient.put('/users/me', { profileImageUrl: url })
      setProfileImageUrl(url)
      setStep(STEP.VOICE)
    } catch (err) {
      setError(err?.response?.data?.message ?? '사진 업로드에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }, [])

  const pollVoiceReady = useCallback((sampleId) => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await willApi.getVoiceSampleStatus(sampleId)
        const status = data.data?.cloneStatus
        if (status === 'ready') {
          clearInterval(pollRef.current)
          setVoiceSampleId(sampleId)
          setStep(STEP.MESSAGE)
        } else if (status === 'failed') {
          clearInterval(pollRef.current)
          setError('음성 처리 중 문제가 발생했습니다. 다시 녹음해 주세요.')
        }
      } catch {
        // 일시적 폴링 실패는 무시
      }
    }, 4000)
  }, [])

  const uploadVoice = useCallback(async (file) => {
    setBusy(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data: uploadRes } = await willApi.uploadAudio(formData)
      const { s3Key, size } = uploadRes.data
      const { data: sampleRes } = await willApi.createVoiceSample({ s3Key, fileSize: size })
      pollVoiceReady(sampleRes.data.voiceSampleId)
    } catch (err) {
      setError(err?.response?.data?.message ?? '음성 업로드에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }, [pollVoiceReady])

  const submitMessage = useCallback(() => {
    if (!title.trim() || !contentText.trim()) return
    setStep(STEP.BENEFICIARY)
  }, [title, contentText])

  const pollVideoReady = useCallback((willId) => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await willApi.getWillStatus(willId)
        const willStatus = data.data?.willStatus
        if (willStatus === 'active') {
          clearInterval(pollRef.current)
          try {
            await completeGift(giftId, { willId })
          } catch {
            // gift 완료 표시 실패해도 영상 자체는 이미 완성됐다 - 조용히 넘어간다
          }
          setStep(STEP.DONE)
        }
      } catch {
        // 일시적 폴링 실패는 무시
      }
    }, 5000)
  }, [giftId])

  const submitBeneficiary = useCallback(async () => {
    if (!beneficiary.name.trim() || !beneficiary.email.trim() || !beneficiary.relationship.trim()) return
    if (!giftId || !voiceSampleId) return
    setBusy(true)
    setError(null)
    try {
      const { data: willRes } = await willApi.createWill({
        voiceSampleId,
        title: title.trim(),
        contentText: contentText.trim(),
        releasePolicy: 'manual_admin',
        beneficiaries: [beneficiary],
      })
      const willId = willRes.data.willId
      await attachWillOrder(giftId, willId)
      await willApi.activateWill(willId)
      setStep(STEP.GENERATING)
      pollVideoReady(willId)
    } catch (err) {
      setError(err?.response?.data?.message ?? '진행 중 문제가 발생했습니다.')
      setStep(STEP.ERROR)
    } finally {
      setBusy(false)
    }
  }, [beneficiary, giftId, voiceSampleId, title, contentText, pollVideoReady])

  return {
    STEP,
    step,
    error,
    busy,
    profileImageUrl,
    title,
    setTitle,
    contentText,
    setContentText,
    beneficiary,
    setBeneficiary,
    submitConsent,
    uploadProfilePhoto,
    uploadVoice,
    submitMessage,
    submitBeneficiary,
    canSubmit: Boolean(giftId),
  }
}

export default useGiftPerformWill
