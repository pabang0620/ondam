import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { willApi } from './willApi.js'

// 백엔드 uploadDeathCertificate 제한과 동일 - 사용자가 서버 응답을 기다리지 않고
// 바로 안내받을 수 있도록 프론트에서도 선검증한다 (서버가 최종 판정, 여기는 보조)
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export function useWillRelease() {
  const { token } = useParams()
  const [previewUrl, setPreviewUrl] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  // FIX: ep-006 - 렌더마다 새로 만들어지는 `{ current: false }` 리터럴은 ref가
  // 아니라 죽은 가드였다. 훅 최상위 useRef로 교체.
  const pendingRef = useRef(false)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubmitError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setSubmitError('사진(JPG, PNG) 또는 PDF 파일만 올릴 수 있습니다. 다른 파일을 선택해 주세요.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setSubmitError('파일 용량이 너무 큽니다. 10MB 이하 파일로 다시 선택해 주세요.')
      e.target.value = ''
      return
    }

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

    if (pendingRef.current) return
    pendingRef.current = true

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // 서류 파일 업로드 - 계정 없이 이 링크(초대 토큰)만으로 인증됨
      const formData = new FormData()
      formData.append('file', selectedFile)
      const { data: uploadData } = await willApi.uploadDeathCertificate(token, formData)
      const deathCertS3Key = uploadData.data?.s3Key
      const deathCertUrl = uploadData.data?.url

      // 공개 요청
      await willApi.submitRelease(token, { deathCertS3Key, deathCertUrl })
      setIsSubmitted(true)
    } catch (err) {
      // FIX: DEV-24 - 서류 제출 실패를 제출 완료로 위장하지 않는다 (유가족이 실제로 접수되지 않은 걸 모르게 됨)
      // 감정적으로 취약한 사용자가 보는 화면이라 서버의 기술적 메시지를 그대로 노출하지 않고,
      // 상태 코드별로 다음 행동을 알 수 있는 안내 문구로 바꾼다.
      const status = err?.response?.status
      if (status === 404) {
        setSubmitError('링크가 유효하지 않습니다. 문자나 카카오톡으로 받으신 링크를 다시 확인해 주세요.')
      } else if (status === 409) {
        setSubmitError('이미 접수되었거나 처리된 요청입니다. 문의사항은 고객센터로 연락해 주세요.')
      } else if (status === 429) {
        setSubmitError('잠시 후 다시 시도해 주세요.')
      } else {
        setSubmitError('서류 제출에 실패했습니다. 잠시 후 다시 시도해 주세요. 계속 안 되면 고객센터로 연락해 주세요.')
      }
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
