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
      // FIX: DEV-24 - 서류 제출 실패를 제출 완료로 위장하지 않는다 (유가족이 실제로 접수되지 않은 걸 모르게 됨)
      setSubmitError(err?.response?.data?.message ?? '서류 제출에 실패했습니다. 잠시 후 다시 시도해 주세요.')
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
