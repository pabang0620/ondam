import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { willApi } from './willApi.js'
import apiClient from '../../config/apiClient.js'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

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

  const handleFileSelect = useCallback((file) => {
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('JPG, PNG, WEBP 형식의 사진만 업로드 가능합니다')
      return
    }
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError('JPG, PNG, WEBP 형식의 사진만 업로드 가능합니다')
      return
    }
    setUploadError(null)
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
  }, [])

  const handleFileUpload = useCallback(async (file) => {
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) return
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!ALLOWED_EXTENSIONS.includes(ext)) return

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
      if (!file) return
      handleFileSelect(file)
      await handleFileUpload(file)
    },
    [handleFileSelect, handleFileUpload],
  )

  const clearPhoto = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setUploadError(null)
  }, [previewUrl])

  return {
    previewUrl,
    isUploading,
    uploadError,
    handleChange,
    clearPhoto,
  }
}
