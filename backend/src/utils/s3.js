import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({ region: process.env.AWS_REGION })

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
}

/**
 * Buffer를 S3에 업로드
 * @param {string} s3Key
 * @param {Buffer} buffer
 * @param {{ contentType?: string, useKms?: boolean }} options
 * @returns {Promise<string>} 업로드된 오브젝트 URL
 */
export const uploadToS3 = async (s3Key, buffer, { contentType, useKms = false } = {}) => {
  const bucket = getS3Bucket()

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
}
