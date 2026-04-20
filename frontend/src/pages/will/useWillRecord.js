import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { willApi } from './willApi.js'

export function useWillRecord() {
  const navigate = useNavigate()
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState(null)
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setRecordedBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        stream.getTracks().forEach((t) => t.stop())
      }

      recorder.start(250)
      setIsRecording(true)
      setDuration(0)

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    } catch {
      setUploadError('마이크 접근 권한이 필요합니다.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRecording])

  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setRecordedBlob(null)
    setAudioUrl(null)
    setDuration(0)
    setUploadError(null)
  }, [audioUrl])

  const handleUpload = useCallback(async () => {
    if (!recordedBlob) return
    setIsUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('file', recordedBlob, 'voice-sample.webm')

    try {
      const { data } = await willApi.uploadAudio(formData)
      const { voiceSampleId, s3Key } = data.data ?? {}
      if (voiceSampleId) localStorage.setItem('will_voice_sample_id', voiceSampleId)
      localStorage.setItem('will_audio_s3key', s3Key)
      navigate('/will/photo')
    } catch {
      setUploadError('업로드에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setIsUploading(false)
    }
  }, [recordedBlob, navigate])

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return {
    isRecording,
    recordedBlob,
    duration,
    audioUrl,
    isUploading,
    uploadError,
    formattedDuration: formatDuration(duration),
    startRecording,
    stopRecording,
    resetRecording,
    handleUpload,
  }
}
