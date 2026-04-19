import { useState, useEffect, useCallback } from 'react'
import { petApi } from './petApi.js'

export function usePetDetail(petId) {
  const [pet, setPet] = useState(null)
  const [media, setMedia] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [isStatusChanging, setIsStatusChanging] = useState(false)

  const fetchDetail = useCallback(async () => {
    if (!petId) return
    setIsLoading(true)
    setError(null)
    try {
      const [petRes, mediaRes] = await Promise.all([
        petApi.getPet(petId),
        petApi.getPetMedia(petId),
      ])
      if (petRes.data.success) setPet(petRes.data.data)
      if (mediaRes.data.success) setMedia(mediaRes.data.data ?? [])
    } catch (err) {
      setError(err.response?.data?.message || '정보를 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [petId])

  useEffect(() => {
    const ac = new AbortController()
    fetchDetail()
    return () => ac.abort()
  }, [fetchDetail])

  const handleMediaUpload = async (file) => {
    if (!file) return
    setIsUploading(true)
    setUploadError(null)
    try {
      const uploadRes = await petApi.uploadPhoto(file)
      const { s3Key, url } = uploadRes.data.data
      const addRes = await petApi.addPetMedia(petId, {
        mediaType: 'photo',
        fileUrl: url,
        s3Key,
      })
      if (addRes.data.success) {
        setMedia((prev) => [...prev, addRes.data.data])
      }
    } catch (err) {
      setUploadError(err.response?.data?.message || '사진 업로드에 실패했습니다.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleStatusChange = async () => {
    if (isStatusChanging) return
    setIsStatusChanging(true)
    try {
      const res = await petApi.updatePetStatus(petId, 'deceased')
      if (res.data.success) {
        setPet((prev) => ({ ...prev, status: 'deceased', ...res.data.data }))
      }
    } catch (err) {
      setError(err.response?.data?.message || '상태 변경에 실패했습니다.')
    } finally {
      setIsStatusChanging(false)
    }
  }

  return {
    pet,
    media,
    isLoading,
    error,
    isUploading,
    uploadError,
    isStatusChanging,
    handleMediaUpload,
    handleStatusChange,
    refetch: fetchDetail,
  }
}
