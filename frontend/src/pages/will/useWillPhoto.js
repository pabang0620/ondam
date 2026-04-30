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
      console.warn('[mock] 사진 업로드 API 실패 - mock 사진 데이터 사용', err)
      const mockPhotoUrl = 'https://picsum.photos/seed/face-photo/600/800'
      const mockS3Key = `wills/mock-user/face-photo-${Date.now()}.jpg`
      localStorage.setItem('will_photo_s3key', mockS3Key)
      localStorage.setItem('will_photo_url', mockPhotoUrl)
      navigate('/will/preview')
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
