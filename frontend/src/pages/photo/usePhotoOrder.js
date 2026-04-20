import { useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { uploadPhoto, createPhotoOrder } from './photoApi.js'

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

  const handleTypeSelect = useCallback((type) => {
    setSelectedType(type)
    setError(null)
  }, [])

  const handleFileUpload = useCallback(async (file) => {
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    if (!allowedTypes.includes(file.type)) {
      setError('JPG, PNG, WEBP, HEIC 파일만 업로드할 수 있습니다.')
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('파일 크기는 20MB 이하여야 합니다.')
      return
    }

    // 이전 미리보기 URL 해제
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)
    setError(null)
    setIsUploading(true)

    try {
      const { data } = await uploadPhoto(file)
      setUploadedS3Key(data.data.s3Key)
      setUploadedUrl(data.data.url)
    } catch (err) {
      setError('사진 업로드에 실패했습니다. 다시 시도해 주세요.')
      URL.revokeObjectURL(localUrl)
      setPreviewUrl(null)
    } finally {
      setIsUploading(false)
    }
  }, [previewUrl])

  const handleSubmit = useCallback(async () => {
    if (!selectedType || !uploadedS3Key || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const { data } = await createPhotoOrder(selectedType, uploadedUrl)
      const orderId = data.data.orderId ?? data.data.id
      navigate(`/photo/payment?orderId=${orderId}`)
    } catch (err) {
      setError('주문 생성에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedType, uploadedS3Key, uploadedUrl, isSubmitting, navigate])

  const canSubmit = Boolean(selectedType && uploadedS3Key && !isUploading && !isSubmitting)

  return {
    selectedType,
    previewUrl,
    isUploading,
    isSubmitting,
    error,
    canSubmit,
    photoTypeLabels: PHOTO_TYPE_LABELS,
    handleTypeSelect,
    handleFileUpload,
    handleSubmit,
  }
}

export default usePhotoOrder
