/**
 * D-ID 립싱크 어댑터
 * 공식 문서: https://docs.d-id.com/reference/createtalk
 *
 * D-ID는 사진을 "영상으로 선변환"할 필요 없이 이미지 URL을 그대로 받는다(3개 벤더 중 가장 단순).
 * 단, 이미지/오디오 모두 우리가 접근 가능한 URL로 먼저 제공해야 하므로 S3 presigned URL을 사용한다.
 */

import { randomUUID } from 'crypto'
import { uploadToS3, getPresignedUrl } from '../../utils/s3.js'

const DID_API_BASE = 'https://api.d-id.com'
// D-ID가 presigned URL로 이미지/오디오를 내려받는 데 필요한 최소 유효시간
const PRESIGNED_URL_EXPIRES_SEC = 60 * 60

export const name = 'did'

// TODO: D-ID 결과(result_url) 실제 호스트를 공식 문서/실제 응답으로 재확인 필요.
// 알려진 관례: D-ID talks 결과물은 자체 S3 버킷(d-id-talks-prod)에 호스팅됨.
export const allowedResultHosts = ['d-id-talks-prod.s3.us-west-2.amazonaws.com', 'd-id.com']

export const isConfigured = () => Boolean(process.env.DID_API_KEY)

const getAuthHeader = () => {
  const apiKey = process.env.DID_API_KEY
  if (!apiKey) {
    throw Object.assign(new Error('DID_API_KEY 환경변수가 설정되지 않았습니다'), { status: 500 })
  }
  // TODO: D-ID Basic Auth 정확한 관례(예: `${apiKey}:` 형태) 공식 문서로 재확인 필요
  return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`
}

/**
 * @param {{ photoBuffer: Buffer, audioBuffer: Buffer }} params
 * @returns {Promise<{ externalJobId: string, stagingS3Keys: string[] }>}
 */
export const submit = async ({ photoBuffer, audioBuffer }) => {
  if (!isConfigured()) {
    throw Object.assign(new Error('DID_API_KEY 환경변수가 설정되지 않았습니다'), { status: 500 })
  }

  const stagingId = randomUUID()
  const photoKey = `lipsync-staging/did/${stagingId}/photo.jpg`
  const audioKey = `lipsync-staging/did/${stagingId}/audio.mp3`
  const stagingS3Keys = [photoKey, audioKey]

  await uploadToS3(photoKey, photoBuffer, { contentType: 'image/jpeg', useKms: true })
  await uploadToS3(audioKey, audioBuffer, { contentType: 'audio/mpeg', useKms: true })

  const sourceUrl = await getPresignedUrl(photoKey, PRESIGNED_URL_EXPIRES_SEC)
  const audioUrl = await getPresignedUrl(audioKey, PRESIGNED_URL_EXPIRES_SEC)

  // TODO: script.type='audio'일 때의 정확한 하위 필드명(audio_url 등)과
  // config 객체 필요 여부를 https://docs.d-id.com/reference/createtalk 로 재확인 필요
  const res = await fetch(`${DID_API_BASE}/talks`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_url: sourceUrl,
      script: {
        type: 'audio',
        audio_url: audioUrl,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw Object.assign(new Error(`D-ID API 오류 (${res.status}): ${errText}`), { status: 500 })
  }

  const data = await res.json()
  // TODO: 응답 필드명 `id` 공식 문서로 재확인 필요 (추정치)
  const externalJobId = data.id
  if (!externalJobId) {
    throw Object.assign(new Error('D-ID API 응답에서 talk id를 찾을 수 없습니다'), { status: 500 })
  }

  return { externalJobId, stagingS3Keys }
}

/**
 * @param {string} externalJobId
 * @returns {Promise<{ status: 'pending'|'completed', videoUrl: string|null }>}
 */
export const poll = async (externalJobId) => {
  const res = await fetch(`${DID_API_BASE}/talks/${externalJobId}`, {
    headers: { Authorization: getAuthHeader() },
  })

  if (!res.ok) {
    const errText = await res.text()
    throw Object.assign(new Error(`D-ID 폴링 오류 (${res.status}): ${errText}`), { status: 500 })
  }

  const data = await res.json()

  // TODO: status 값(created/started/done/error 관례) 및 result_url 필드명 공식 문서로 재확인 필요
  if (data.status === 'done') {
    if (!data.result_url) {
      throw Object.assign(new Error('D-ID done 상태이나 result_url이 없습니다'), { status: 500 })
    }
    return { status: 'completed', videoUrl: data.result_url }
  }

  if (data.status === 'error') {
    throw Object.assign(
      new Error(`D-ID 영상 생성 실패: ${data.error?.description ?? data.error ?? 'unknown error'}`),
      { status: 500 },
    )
  }

  return { status: 'pending', videoUrl: null }
}
