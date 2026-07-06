/**
 * Sync.so 립싱크 어댑터
 * 공식 문서: https://sync.so/docs/quickstart (정확한 base URL/엔드포인트는 구현 시점 SDK 예시 기반 추정 - 재확인 필요)
 *
 * Sync.so는 input으로 정지 이미지가 아닌 "영상"을 요구하므로,
 * photoToVideo.js로 프로필 사진을 짧은 mp4로 먼저 변환한 뒤 S3에 올려 URL로 전달한다.
 */

import { randomUUID } from 'crypto'
import { uploadToS3, getPresignedUrl } from '../../utils/s3.js'
import { convertPhotoToVideo } from './photoToVideo.js'

// TODO: 정확한 base URL을 https://sync.so/docs/quickstart 로 재확인 필요 (SDK 예시 기반 추정)
const SYNC_API_BASE = 'https://api.sync.so'
const PRESIGNED_URL_EXPIRES_SEC = 60 * 60

export const name = 'sync'

// TODO: Sync.so 결과(output_url) 실제 호스트를 공식 문서/실제 응답으로 재확인 필요
export const allowedResultHosts = ['sync.so', 'storage.sync.so']

export const isConfigured = () => Boolean(process.env.SYNC_API_KEY)

const getApiKey = () => {
  const apiKey = process.env.SYNC_API_KEY
  if (!apiKey) {
    throw Object.assign(new Error('SYNC_API_KEY 환경변수가 설정되지 않았습니다'), { status: 500 })
  }
  return apiKey
}

/**
 * @param {{ photoBuffer: Buffer, audioBuffer: Buffer }} params
 * @returns {Promise<{ externalJobId: string, stagingS3Keys: string[] }>}
 */
export const submit = async ({ photoBuffer, audioBuffer }) => {
  const apiKey = getApiKey()

  // 사진 → 짧은 mp4 영상 변환 (Sync.so는 video 입력만 허용)
  const videoBuffer = await convertPhotoToVideo(photoBuffer, { durationSec: 8 })

  const stagingId = randomUUID()
  const videoKey = `lipsync-staging/sync/${stagingId}/source.mp4`
  const audioKey = `lipsync-staging/sync/${stagingId}/audio.mp3`
  const stagingS3Keys = [videoKey, audioKey]

  await uploadToS3(videoKey, videoBuffer, { contentType: 'video/mp4', useKms: true })
  await uploadToS3(audioKey, audioBuffer, { contentType: 'audio/mpeg', useKms: true })

  const videoUrl = await getPresignedUrl(videoKey, PRESIGNED_URL_EXPIRES_SEC)
  const audioUrl = await getPresignedUrl(audioKey, PRESIGNED_URL_EXPIRES_SEC)

  // TODO: 정확한 엔드포인트 경로/요청 필드명을 https://sync.so/docs/quickstart 로 재확인 필요 (SDK 예시 기반 추정)
  const res = await fetch(`${SYNC_API_BASE}/v2/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: [
        { type: 'video', url: videoUrl },
        { type: 'audio', url: audioUrl },
      ],
      model: 'lipsync-2',
      options: { sync_mode: 'cut_off' },
      output_file_name: `ondam-${stagingId}`,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw Object.assign(new Error(`Sync.so API 오류 (${res.status}): ${errText}`), { status: 500 })
  }

  const data = await res.json()
  // TODO: 응답 필드명 `id` 공식 문서로 재확인 필요 (추정치)
  const externalJobId = data.id
  if (!externalJobId) {
    throw Object.assign(new Error('Sync.so API 응답에서 job id를 찾을 수 없습니다'), { status: 500 })
  }

  return { externalJobId, stagingS3Keys }
}

/**
 * @param {string} externalJobId
 * @returns {Promise<{ status: 'pending'|'completed', videoUrl: string|null }>}
 */
export const poll = async (externalJobId) => {
  const apiKey = getApiKey()

  const res = await fetch(`${SYNC_API_BASE}/v2/generate/${externalJobId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const errText = await res.text()
    throw Object.assign(new Error(`Sync.so 폴링 오류 (${res.status}): ${errText}`), { status: 500 })
  }

  const data = await res.json()

  if (data.status === 'COMPLETED') {
    if (!data.output_url) {
      throw Object.assign(new Error('Sync.so COMPLETED 상태이나 output_url이 없습니다'), { status: 500 })
    }
    return { status: 'completed', videoUrl: data.output_url }
  }

  if (data.status === 'FAILED' || data.status === 'REJECTED') {
    throw Object.assign(
      new Error(`Sync.so 영상 생성 실패 (${data.status}): ${data.error ?? 'unknown error'}`),
      { status: 500 },
    )
  }

  return { status: 'pending', videoUrl: null }
}
