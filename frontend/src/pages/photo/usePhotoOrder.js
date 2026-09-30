import { useState, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { uploadPhoto, createPhotoOrder, savePhotoConsents } from './photoApi.js'
import { PHOTO_CONSENT_ITEMS } from '../../components/consent/consentItems.js'
import { useConsentChecklist } from '../../components/consent/useConsentChecklist.js'

const PHOTO_TYPE_LABELS = {
  funeral: '장례 사진',
  id: '증명 사진',
  job: '취업 사진',
}

function usePhotoOrder() {
  const navigate = useNavigate()
  const location = useLocation()

  const initialType = location.state?.photoType ?? null

  const [selectedType, setSelectedType] = useState(initialType)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploadedS3Key, setUploadedS3Key] = useState(null)
  const [uploadedUrl, setUploadedUrl] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  // FE-PP-1: 업로드 오류는 사진 종류를 바꿔도 지우지 않는다(업로드 실패 사실을
  // 사용자가 놓치지 않게). 제출 오류 등 나머지는 error에 둔다.
  const [uploadError, setUploadError] = useState(null)

  // 결함C: 영정/증명/취업 사진 모두 업로드된 얼굴을 AI로 합성·보정한다 -
  // 초상권·AI 생성물 동의 없이 처리하지 않는다 (WillConsentPage와 동일한 원칙)
  const { consents, allChecked, toggleItem, toggleAll } = useConsentChecklist(PHOTO_CONSENT_ITEMS)
  const consentPendingRef = useRef(false) // ep-006: 연타로 인한 중복 동의 저장 방지

  const handleTypeSelect = useCallback((type) => {
    setSelectedType(type)
    setError(null)
  }, [])

  const handleFileUpload = useCallback(async (file) => {
    if (!file) return

    // FE-PP-8: 서버가 HEIC를 허용하지 않으므로 클라이언트에서도 받지 않는다
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setUploadError('JPG, PNG, WEBP 파일만 업로드할 수 있습니다.')
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError('파일 크기는 20MB 이하여야 합니다.')
      return
    }

    // FE-PP-1: 새 업로드를 시작하면 이전 업로드 결과를 먼저 비운다 - 업로드가
    // 실패해도 예전 사진 키로 주문이 만들어지는 일을 막는다
    setUploadedS3Key(null)
    setUploadedUrl(null)

    // 이전 미리보기 URL 해제
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)
    setError(null)
    setUploadError(null)
    setIsUploading(true)

    try {
      const { data } = await uploadPhoto(file)
      setUploadedS3Key(data.data.s3Key)
      setUploadedUrl(data.data.url)
    } catch (err) {
      // FIX: DEV-24 - 업로드 실패를 가짜 S3 키로 위장해 다음 단계로 진행시키지 않는다
      setUploadError(err?.response?.data?.message ?? '사진 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsUploading(false)
    }
  }, [previewUrl])

  const handleSubmit = useCallback(async () => {
    // 결함C/ep-006: allChecked 미충족이거나 이미 처리 중이면(연타 포함) 진행하지 않는다
    if (!selectedType || !uploadedS3Key || isSubmitting || !allChecked || consentPendingRef.current) return
    consentPendingRef.current = true

    setIsSubmitting(true)
    setError(null)

    try {
      // 결함C: 초상권·AI 생성물 동의를 먼저 저장한다. 저장이 실패하면(빈 catch{}
      // 금지) 주문을 만들지 않고 사용자에게 알린다 - 백엔드도 portrait 동의가
      // 없으면 사진 주문·처리 시작을 400으로 거부한다.
      const consentPayload = PHOTO_CONSENT_ITEMS.map((item) => ({
        consentType: item.key,
        isAgreed: consents[item.key] ?? false,
      }))
      await savePhotoConsents(consentPayload)

      const { data } = await createPhotoOrder(selectedType, uploadedUrl)
      const orderId = data.data.orderId ?? data.data.id
      navigate(`/photo/payment?orderId=${orderId}`)
    } catch (err) {
      // FIX: DEV-24 - 주문 생성 실패를 가짜 주문 ID로 위장해 결제 단계로 진행시키지 않는다
      setError(err?.response?.data?.message ?? '주문 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
      consentPendingRef.current = false
    }
  }, [selectedType, uploadedS3Key, uploadedUrl, isSubmitting, allChecked, consents, navigate])

  const canSubmit = Boolean(selectedType && uploadedS3Key && !isUploading && !isSubmitting && allChecked)

  return {
    selectedType,
    previewUrl,
    isUploading,
    isSubmitting,
    error: uploadError ?? error,
    canSubmit,
    photoTypeLabels: PHOTO_TYPE_LABELS,
    consentItems: PHOTO_CONSENT_ITEMS,
    consents,
    allChecked,
    toggleConsentItem: toggleItem,
    toggleAllConsents: toggleAll,
    handleTypeSelect,
    handleFileUpload,
    handleSubmit,
  }
}

export default usePhotoOrder
