import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { willApi } from './willApi.js'
import apiClient from '../../config/apiClient.js'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_PHOTO_BYTES = 20 * 1024 * 1024 // 20MB

// 업로드 전 사전 검사 - 통과하면 null, 아니면 안내 문구
function validatePhoto(file) {
  const name = file.name?.toLowerCase() ?? ''
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
  if (!ALLOWED_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return 'JPG, PNG, WEBP 형식의 사진만 업로드 가능합니다.'
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return '사진 용량이 너무 큽니다. 20MB 이하 사진을 선택해 주세요.'
  }
  return null
}

export function useWillPhoto() {
  const navigate = useNavigate()
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileUpload = useCallback(async (file) => {
    setIsUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const { data } = await willApi.uploadPhoto(formData)
      const uploadedUrl = data.data?.url
      const s3Key = data.data?.s3Key
      localStorage.setItem('will_photo_s3key', s3Key)

      // Save as profile image so activateWill can use it
      await apiClient.put('/users/me', { profileImageUrl: uploadedUrl })
      localStorage.setItem('will_photo_url', uploadedUrl)

      navigate('/will/preview')
    } catch (err) {
      // FIX: DEV-24 - 업로드 실패를 가짜 사진으로 위장해 다음 단계로 진행시키지 않는다
      setUploadError(err?.response?.data?.message ?? '사진 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsUploading(false)
    }
  }, [navigate])

  const handleChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0]
      // 같은 파일을 다시 골라도 onChange가 발생하도록 초기화
      e.target.value = ''
      if (!file) return
      const error = validatePhoto(file)
      if (error) {
        setUploadError(error)
        return
      }
      setUploadError(null)
      setPreviewUrl(URL.createObjectURL(file))
      await handleFileUpload(file)
    },
    [handleFileUpload],
  )

  const clearPhoto = useCallback(() => {
    setPreviewUrl(null)
    setUploadError(null)
  }, [])

  return {
    previewUrl,
    isUploading,
    uploadError,
    handleChange,
    clearPhoto,
  }
}
