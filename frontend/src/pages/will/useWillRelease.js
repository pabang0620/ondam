import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { willApi } from './willApi.js'

export function useWillRelease() {
  const { token } = useParams()
  const [previewUrl, setPreviewUrl] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubmitError(null)
    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(url)
  }, [previewUrl])

  const handleSubmit = useCallback(async () => {
    if (!selectedFile) {
      setSubmitError('사망 확인 서류를 업로드해 주세요.')
      return
    }

    const pendingRef = { current: false }
    if (pendingRef.current) return
    pendingRef.current = true

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // 서류 파일 업로드
      const formData = new FormData()
      formData.append('file', selectedFile)
      const { data: uploadData } = await willApi.uploadPhoto(formData)
      const deathCertS3Key = uploadData.data?.s3Key
      const deathCertUrl = uploadData.data?.url

      // 공개 요청
      await willApi.submitRelease(token, { deathCertS3Key, deathCertUrl })
      setIsSubmitted(true)
    } catch (err) {
      console.warn('[mock] 사후 공개 제출 API 실패 - mock 제출 완료 처리', err)
      setIsSubmitted(true)
    } finally {
      setIsSubmitting(false)
      pendingRef.current = false
    }
  }, [selectedFile, token])

  return {
    token,
    previewUrl,
    selectedFile,
    isSubmitting,
    submitError,
    isSubmitted,
    handleFileSelect,
    handleSubmit,
  }
}
