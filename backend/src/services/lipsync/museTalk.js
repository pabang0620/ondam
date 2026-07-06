/**
 * MuseTalk 립싱크 어댑터 (Fal.ai 경유)
 * 공식 문서: https://fal.ai/models/fal-ai/musetalk
 *
 * 자체 GPU 호스팅 대신 Fal.ai의 큐 기반 API로 연결한다.
 * MuseTalk도 Sync.so와 마찬가지로 정지 이미지가 아닌 "영상" 입력을 요구하므로
 * photoToVideo.js로 프로필 사진을 짧은 mp4로 먼저 변환한다.
 */

import { randomUUID } from 'crypto'
import { uploadToS3, getPresignedUrl } from '../../utils/s3.js'
import { convertPhotoToVideo } from './photoToVideo.js'

const FAL_QUEUE_BASE = 'https://queue.fal.run'
const PRESIGNED_URL_EXPIRES_SEC = 60 * 60

export const name = 'musetalk'

// TODO: Fal.ai 결과 CDN 실제 호스트를 공식 문서/실제 응답으로 재확인 필요
export const allowedResultHosts = ['fal.media', 'v3.fal.media', 'storage.googleapis.com']

export const isConfigured = () => Boolean(process.env.FAL_API_KEY)

const getApiKey = () => {
  const apiKey = process.env.FAL_API_KEY
  if (!apiKey) {
    throw Object.assign(new Error('FAL_API_KEY 환경변수가 설정되지 않았습니다'), { status: 500 })
  }
  return apiKey
}

/**
 * @param {{ photoBuffer: Buffer, audioBuffer: Buffer }} params
 * @returns {Promise<{ externalJobId: string, stagingS3Keys: string[] }>}
 */
export const submit = async ({ photoBuffer, audioBuffer }) => {
  const apiKey = getApiKey()

  // 사진 → 짧은 mp4 영상 변환 (MuseTalk도 video 입력만 허용)
  const videoBuffer = await convertPhotoToVideo(photoBuffer, { durationSec: 8 })

  const stagingId = randomUUID()
  const videoKey = `lipsync-staging/musetalk/${stagingId}/source.mp4`
  const audioKey = `lipsync-staging/musetalk/${stagingId}/audio.mp3`
  const stagingS3Keys = [videoKey, audioKey]

  await uploadToS3(videoKey, videoBuffer, { contentType: 'video/mp4', useKms: true })
  await uploadToS3(audioKey, audioBuffer, { contentType: 'audio/mpeg', useKms: true })

  const sourceVideoUrl = await getPresignedUrl(videoKey, PRESIGNED_URL_EXPIRES_SEC)
  const audioUrl = await getPresignedUrl(audioKey, PRESIGNED_URL_EXPIRES_SEC)

  const res = await fetch(`${FAL_QUEUE_BASE}/fal-ai/musetalk`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_video_url: sourceVideoUrl,
      audio_url: audioUrl,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw Object.assign(new Error(`MuseTalk(Fal) API 오류 (${res.status}): ${errText}`), { status: 500 })
  }

  const data = await res.json()
  const externalJobId = data.request_id
  if (!externalJobId) {
    throw Object.assign(new Error('MuseTalk(Fal) API 응답에서 request_id를 찾을 수 없습니다'), { status: 500 })
  }

  return { externalJobId, stagingS3Keys }
}

/**
 * @param {string} externalJobId
 * @returns {Promise<{ status: 'pending'|'completed', videoUrl: string|null }>}
 */
export const poll = async (externalJobId) => {
  const apiKey = getApiKey()

  const statusRes = await fetch(`${FAL_QUEUE_BASE}/fal-ai/musetalk/requests/${externalJobId}/status`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!statusRes.ok) {
    const errText = await statusRes.text()
    throw Object.assign(new Error(`MuseTalk(Fal) 폴링 오류 (${statusRes.status}): ${errText}`), { status: 500 })
  }
  const statusData = await statusRes.json()

  if (statusData.status === 'COMPLETED') {
    const resultRes = await fetch(`${FAL_QUEUE_BASE}/fal-ai/musetalk/requests/${externalJobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!resultRes.ok) {
      const errText = await resultRes.text()
      throw Object.assign(new Error(`MuseTalk(Fal) 결과 조회 오류 (${resultRes.status}): ${errText}`), { status: 500 })
    }
    const resultData = await resultRes.json()
    const videoUrl = resultData?.video?.url
    if (!videoUrl) {
      throw Object.assign(new Error('MuseTalk(Fal) COMPLETED 상태이나 video.url이 없습니다'), { status: 500 })
    }
    return { status: 'completed', videoUrl }
  }

  if (statusData.status === 'IN_QUEUE' || statusData.status === 'IN_PROGRESS') {
    return { status: 'pending', videoUrl: null }
  }

  // TODO: Fal 실패 상태값의 정확한 명칭 재확인 필요
  // (공식 문서에 명시된 값은 IN_QUEUE/IN_PROGRESS/COMPLETED뿐이라 실패 케이스는
  //  별도 status 문자열이 아니라 HTTP 에러코드로 표현될 가능성이 있음)
  throw Object.assign(new Error(`MuseTalk(Fal) 알 수 없는 상태: ${statusData.status}`), { status: 500 })
}
