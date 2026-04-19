import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { willApi } from './willApi.js'

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
    if (!file.type.startsWith('image/')) {
      setUploadError('이미지 파일만 업로드할 수 있습니다.')
      return
    }
    setUploadError(null)
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
  }, [])

  const handleFileUpload = useCallback(async (file) => {
    if (!file) return
    setIsUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const { data } = await willApi.uploadPhoto(formData)
      const s3Key = data.data?.s3Key || data.data?.fileUrl
      localStorage.setItem('will_photo_s3key', s3Key)
      navigate('/will/preview')
    } catch {
      setUploadError('사진 업로드에 실패했습니다. 다시 시도해 주세요.')
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
