import { useState, useCallback, useRef, useEffect } from 'react'
// photo 도메인의 검증된 API 호출 함수를 그대로 재사용한다(재설계 없음) - 업로드·주문
// 생성·처리시작·상태폴링 로직은 photoApi.js/photoService.js와 동일하다.
import { uploadPhoto, createPhotoOrder, startProcessing, getPhotoOrderStatus, savePhotoConsents } from '../photo/photoApi.js'
import { attachPhotoOrder, completeGift } from './giftApi.js'
import { PHOTO_CONSENT_ITEMS } from '../../components/consent/consentItems.js'
import { useConsentChecklist } from '../../components/consent/useConsentChecklist.js'

const PHOTO_TYPES = [
  { type: 'funeral', label: '장례 사진' },
  { type: 'id', label: '증명 사진' },
  { type: 'job', label: '취업 사진' },
]

// 결함C: AI 사진관 선물 수행 경로는 동의 화면이 0개였다. 일반 경로(PhotoOrderPage)와
// 동일하게 CONSENT 단계를 먼저 거치게 한다.
const STEP = {
  CONSENT: 'consent',
  SELECT: 'select',
  SUBMITTING: 'submitting',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
}

function useGiftPerformPhoto() {
  const giftId = sessionStorage.getItem('giftContentGiftId')

  const [step, setStep] = useState(STEP.CONSENT)
  const [photoType, setPhotoType] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploadedUrl, setUploadedUrl] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState(null)
  const [isSavingConsent, setIsSavingConsent] = useState(false)
  const pollRef = useRef(null)
  const consentPendingRef = useRef(false) // ep-006: 연타로 인한 중복 동의 저장 방지

  const { consents, allChecked, toggleItem, toggleAll } = useConsentChecklist(PHOTO_CONSENT_ITEMS)

  useEffect(() => () => clearInterval(pollRef.current), [])

  const submitConsent = useCallback(async () => {
    if (!allChecked || consentPendingRef.current) return
    consentPendingRef.current = true
    setIsSavingConsent(true)
    setError(null)
    try {
      const consentPayload = PHOTO_CONSENT_ITEMS.map((item) => ({
        consentType: item.key,
        isAgreed: consents[item.key] ?? false,
      }))
      // FIX: D와 동일한 원칙 - 저장 실패를 삼키지 않고 다음 단계로 못 넘어가게 막는다.
      await savePhotoConsents(consentPayload)
      setStep(STEP.SELECT)
    } catch (err) {
      setError(err?.response?.data?.message ?? '동의 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSavingConsent(false)
      consentPendingRef.current = false
    }
  }, [allChecked, consents])

  const handleTypeSelect = useCallback((t) => setPhotoType(t), [])

  const handleFileUpload = useCallback(async (file) => {
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    if (!allowed.includes(file.type)) {
      setError('JPG, PNG, WEBP, HEIC 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('파일 크기는 20MB 이하여야 합니다.')
      return
    }
    setPreviewUrl(URL.createObjectURL(file))
    setError(null)
    setIsUploading(true)
    try {
      const { data } = await uploadPhoto(file)
      setUploadedUrl(data.data.url)
    } catch (err) {
      setError(err?.response?.data?.message ?? '사진 업로드에 실패했습니다.')
    } finally {
      setIsUploading(false)
    }
  }, [])

  const pollStatus = useCallback((orderId) => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await getPhotoOrderStatus(orderId)
        const status = data.data?.status
        if (status === 'completed') {
          clearInterval(pollRef.current)
          try {
            await completeGift(giftId, { orderId })
          } catch {
            // gift 완료 표시 실패해도 사진 자체는 이미 완성됐다 - 조용히 넘어간다
          }
          setStep(STEP.DONE)
        } else if (status === 'failed') {
          clearInterval(pollRef.current)
          setError('사진 제작 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
          setStep(STEP.ERROR)
        }
      } catch {
        // 일시적 폴링 실패는 무시하고 다음 주기에 재시도
      }
    }, 4000)
  }, [giftId])

  const handleSubmit = useCallback(async () => {
    if (!photoType || !uploadedUrl || !giftId) return
    setStep(STEP.SUBMITTING)
    setError(null)
    try {
      const { data } = await createPhotoOrder(photoType, uploadedUrl)
      const orderId = data.data.orderId ?? data.data.id
      await attachPhotoOrder(giftId, orderId)
      await startProcessing(orderId)
      setStep(STEP.PROCESSING)
      pollStatus(orderId)
    } catch (err) {
      setError(err?.response?.data?.message ?? '진행 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      setStep(STEP.ERROR)
    }
  }, [photoType, uploadedUrl, giftId, pollStatus])

  return {
    STEP,
    step,
    photoType,
    previewUrl,
    isUploading,
    error,
    photoTypes: PHOTO_TYPES,
    canSubmit: Boolean(photoType && uploadedUrl && !isUploading && giftId),
    consentItems: PHOTO_CONSENT_ITEMS,
    consents,
    allChecked,
    isSavingConsent,
    toggleConsentItem: toggleItem,
    toggleAllConsents: toggleAll,
    submitConsent,
    handleTypeSelect,
    handleFileUpload,
    handleSubmit,
  }
}

export default useGiftPerformPhoto
