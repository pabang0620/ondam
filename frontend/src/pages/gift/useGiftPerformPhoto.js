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
  // FIX: 무한 폴링 결함 (photo/usePhotoProcessing.js와 동일한 유형) - 환불은 "오류"가
  // 아니라 "결제가 정상적으로 취소됐다"는 정보라 ERROR와 분리된 화면·톤이 필요하다.
  REFUNDED: 'refunded',
}

// GET /photo/orders/:id/status가 돌려주는 status는 photo_orders.status
// (PHOTO_ORDER_STATUS, shared/constants/enums.js: pending_payment/paid/processing/
// completed/failed/refunded)다. pending_payment/paid/processing은 계속 폴링해야
// 하는 대기·진행 상태이고, completed/failed/refunded 3종은 아래에서 개별 분기로
// 처리하는 종료 상태다.
const KNOWN_NON_TERMINAL_STATUSES = new Set(['pending_payment', 'paid', 'processing'])

function useGiftPerformPhoto() {
  const giftId = sessionStorage.getItem('giftContentGiftId')

  const [step, setStep] = useState(STEP.CONSENT)
  const [photoType, setPhotoType] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploadedUrl, setUploadedUrl] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState(null)
  const [isSavingConsent, setIsSavingConsent] = useState(false)
  // FIX: 무한 폴링 결함 - usePhotoProcessing.js와 동일하게 환불은 error와 별개 상태로 둔다.
  const [isRefunded, setIsRefunded] = useState(false)
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
        } else if (status === 'refunded') {
          // FIX: 무한 폴링 결함 - photoWorker.js의 finalizeOrderFailure/
          // refundGiftFallback이 AI 처리 최종 실패 시 자동 환불하고 photo_orders.status를
          // 'refunded'로 확정한다. 이 분기가 없어 완료·실패 어느 쪽도 아닌 상태가 되어
          // 3초(정확히는 4초)마다 영원히 폴링했다 - 결제도 취소됐는데 화면은
          // "사진을 만들고 있어요"만 계속 보여줬다.
          // 선물 경로는 결제자(자녀)와 화면을 보는 수행자(부모)가 다르므로,
          // "실패했다"가 아니라 "환불은 보내주신 분께 처리됐고 수행자는 할 일이
          // 없다"는 점을 명확히 안내한다 (완료 보고 3절 근거).
          clearInterval(pollRef.current)
          setIsRefunded(true)
          setStep(STEP.REFUNDED)
        } else if (status === 'failed') {
          clearInterval(pollRef.current)
          setError('사진 제작에 실패했어요. 환불 절차가 진행 중이니 잠시 후 다시 확인해 주세요.')
          setStep(STEP.ERROR)
        } else if (!KNOWN_NON_TERMINAL_STATUSES.has(status)) {
          // FIX: 방어적 폴백 - PHOTO_ORDER_STATUS에 없는 값이 오면(스키마 변경/오탈자 등)
          // 무한 폴링에 빠지지 않도록 멈추고 새로고침을 안내한다 (usePhotoProcessing.js와 동일).
          clearInterval(pollRef.current)
          setError('처리 상태를 확인할 수 없습니다. 잠시 후 페이지를 새로고침해 다시 시도해 주세요.')
          setStep(STEP.ERROR)
        }
        // pending_payment/paid/processing이면 다음 주기에 계속 폴링한다.
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
    isRefunded,
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
