import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({ region: process.env.AWS_REGION })

/**
 * S3 URL 또는 키에서 오브젝트 키 추출
 * https://{bucket}.s3.{region}.amazonaws.com/{key} 형태 지원
 * 이미 키 형태인 경우 그대로 반환
 * @param {string} url
 * @returns {string|null}
 */
export const extractS3KeyFromUrl = (url) => {
  if (!url) return null
  try {
    const { pathname } = new URL(url)
    return pathname.startsWith('/') ? pathname.slice(1) : pathname
  } catch {
    return url  // 이미 키 형태면 그대로 반환
  }
}

const getS3Bucket = () => {
  const bucket = process.env.S3_BUCKET
  if (!bucket) {
    throw Object.assign(new Error('S3_BUCKET 환경변수가 설정되지 않았습니다'), { status: 500 })
  }
  return bucket
}

/**
 * S3 객체의 서명된 다운로드 URL 생성
 * @param {string} s3Key  — S3 오브젝트 키
 * @param {number} expiresInSeconds — 만료 시간(초)
 * @returns {Promise<string>} 서명된 URL
 */
export const getPresignedUrl = async (s3Key, expiresInSeconds) => {
  const command = new GetObjectCommand({
    Bucket: getS3Bucket(),
    Key: s3Key,
  })
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds })
}

/**
 * S3 오브젝트를 Buffer로 다운로드
 * @param {string} s3Key
 * @returns {Promise<Buffer>}
 */
export const downloadFromS3 = async (s3Key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: getS3Bucket(),
      Key: s3Key,
    })
    const response = await s3Client.send(command)
    const chunks = []
    for await (const chunk of response.Body) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  } catch (err) {
    throw Object.assign(
      new Error(`S3 다운로드 실패 (${s3Key}): ${err.message}`),
      { status: 500 },
    )
  }
}

/**
 * Buffer를 S3에 업로드
 * @param {string} s3Key
 * @param {Buffer} buffer
 * @param {{ contentType?: string, useKms?: boolean }} options
 * @returns {Promise<string>} 업로드된 오브젝트 URL
 */
export const uploadToS3 = async (s3Key, buffer, { contentType, useKms = false } = {}) => {
  try {
    const bucket = getS3Bucket()

    if (useKms && !process.env.KMS_KEY_ID) {
      throw Object.assign(new Error('KMS_KEY_ID 환경변수가 설정되지 않았습니다'), { status: 500 })
    }

    const params = {
      Bucket: bucket,
      Key: s3Key,
      Body: buffer,
      ...(contentType && { ContentType: contentType }),
      ...(useKms && {
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: process.env.KMS_KEY_ID,
      }),
    }

    const command = new PutObjectCommand(params)
    await s3Client.send(command)

    return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`
  } catch (err) {
    if (err.status) throw err  // 이미 래핑된 에러는 그대로 전파
    throw Object.assign(
      new Error(`S3 업로드 실패 (${s3Key}): ${err.message}`),
      { status: 500 },
    )
  }
}
