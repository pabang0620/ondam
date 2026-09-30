import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { willApi } from './willApi.js'

// 백엔드 계약: 음성 샘플 길이 10~300초, 파일 30MB 이하
export const MIN_DURATION_SEC = 10
export const MAX_DURATION_SEC = 300
const MAX_FILE_BYTES = 30 * 1024 * 1024

// recorder.mimeType 기준으로 업로드 파일명 확장자를 정한다
function extensionForMime(mimeType) {
  const type = (mimeType || '').toLowerCase()
  if (type.includes('mp4')) return 'm4a'
  if (type.includes('ogg')) return 'ogg'
  return 'webm'
}

// getUserMedia / MediaRecorder 실패 원인별 안내 문구
function recordErrorMessage(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return '마이크 사용이 허용되지 않았습니다. 브라우저 주소창의 자물쇠 아이콘을 눌러 마이크를 허용해 주세요.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return '연결된 마이크를 찾지 못했습니다. 마이크를 연결한 뒤 다시 시도해 주세요.'
    case 'NotReadableError':
      return '다른 프로그램이 마이크를 사용 중입니다. 다른 앱을 닫고 다시 시도해 주세요.'
    default:
      return '이 브라우저에서는 녹음을 지원하지 않습니다. 아래 "파일 업로드"를 이용하시거나 다른 브라우저로 시도해 주세요.'
  }
}

export function useWillRecord() {
  const navigate = useNavigate()
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const elapsedRef = useRef(0)
  // 녹음 시작 중복 가드 - 권한 팝업 대기 중 버튼을 여러 번 눌러도 1회만 시작
  const startingRef = useRef(false)

  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState(null)
  const [uploadFileName, setUploadFileName] = useState('voice-sample.webm')
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  // 미리듣기 URL 교체 시 이전 URL 해제
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  // 언마운트 시 녹음 중이면 recorder 정지 + 마이크 트랙 해제
  useEffect(() => {
    return () => {
      clearTimer()
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null
        try {
          recorder.stop()
        } catch {
          // 이미 정지된 경우 무시
        }
      }
      mediaRecorderRef.current = null
      stopTracks()
    }
  }, [])

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    clearTimer()
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    setIsRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    if (startingRef.current || mediaRecorderRef.current?.state === 'recording') return
    startingRef.current = true
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        const unsupported = new Error('unsupported')
        unsupported.name = 'NotSupportedError'
        throw unsupported
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setRecordedBlob(blob)
        setUploadFileName(`voice-sample.${extensionForMime(mimeType)}`)
        setAudioUrl(URL.createObjectURL(blob))
        setUploadError(null)
        mediaRecorderRef.current = null
        stopTracks()
      }

      recorder.start(250)
      elapsedRef.current = 0
      setDuration(0)
      setIsRecording(true)
      setUploadError(null)

      timerRef.current = setInterval(() => {
        elapsedRef.current += 1
        setDuration(elapsedRef.current)
        // 최대 길이 도달 시 자동 정지
        if (elapsedRef.current >= MAX_DURATION_SEC) stopRecording()
      }, 1000)
    } catch (err) {
      stopTracks()
      mediaRecorderRef.current = null
      setUploadError(recordErrorMessage(err))
    } finally {
      startingRef.current = false
    }
  }, [stopRecording])

  const resetRecording = useCallback(() => {
    setRecordedBlob(null)
    setAudioUrl(null)
    setDuration(0)
    setUploadError(null)
  }, [])

  const handleUpload = useCallback(async () => {
    if (!recordedBlob) return
    if (duration < MIN_DURATION_SEC || duration > MAX_DURATION_SEC) {
      setUploadError(
        duration < MIN_DURATION_SEC
          ? '녹음이 너무 짧습니다. 10초 이상 녹음해 주세요.'
          : '녹음이 너무 깁니다. 5분 이하로 녹음해 주세요.',
      )
      return
    }
    setIsUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('file', recordedBlob, uploadFileName)

    try {
      const { data: uploadData } = await willApi.uploadAudio(formData)
      const { s3Key } = uploadData.data ?? {}
      const { data: sampleData } = await willApi.createVoiceSample({ s3Key, durationSec: duration })
      const { voiceSampleId } = sampleData.data ?? {}
      localStorage.setItem('will_voice_sample_id', voiceSampleId)
      localStorage.setItem('will_audio_s3key', s3Key)
      navigate('/will/photo')
    } catch (err) {
      // FIX: DEV-24 - 업로드 실패를 가짜 voice_sample_id로 위장해 다음 단계로 진행시키지 않는다
      setUploadError(err?.response?.data?.message ?? '음성 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsUploading(false)
    }
  }, [recordedBlob, uploadFileName, duration, navigate])

  const handleFileUpload = useCallback((file) => {
    if (!file) return

    if (!file.type.startsWith('audio/')) {
      setUploadError('오디오 파일만 업로드할 수 있습니다. (mp3, m4a, wav 등)')
      return
    }

    if (file.size > MAX_FILE_BYTES) {
      setUploadError('파일 크기가 너무 큽니다. 30MB 이하 파일을 사용해 주세요.')
      return
    }

    setUploadError(null)

    // AudioContext로 길이 추출 (실패하면 0 → 업로드 전 길이 검사에서 안내)
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (AudioCtx) {
      const ac = new AudioCtx()
      file.arrayBuffer()
        .then((buf) => ac.decodeAudioData(buf))
        .then((decoded) => setDuration(Math.round(decoded.duration)))
        .catch(() => setDuration(0))
        .finally(() => ac.close())
    } else {
      setDuration(0)
    }

    setRecordedBlob(file)
    setUploadFileName(file.name || 'voice-sample.webm')
    setAudioUrl(URL.createObjectURL(file))
  }, [])

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
    handleFileUpload,
  }
}
