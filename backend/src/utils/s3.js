import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
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
    const parsed = new URL(url)
    const bucket = process.env.S3_BUCKET
    const region = process.env.AWS_REGION
    if (bucket && region) {
      const allowedHost = `${bucket}.s3.${region}.amazonaws.com`
      if (parsed.hostname !== allowedHost) return null
    }
    const path = parsed.pathname
    return path.startsWith('/') ? path.slice(1) : path
  } catch {
    // 이미 키 형태인 경우 - path traversal 차단
    if (url.includes('..')) return null
    return url
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
 * @param {string} s3Key  - S3 오브젝트 키
 * @param {number} expiresInSeconds - 만료 시간(초)
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
 * S3 객체의 서명된 "다운로드"(첨부) URL 생성 - SPEC-05 2절 4번(원본 다운로드 제공).
 * getPresignedUrl과 달리 응답에 Content-Disposition: attachment를 실어 브라우저가
 * 새 탭에서 재생하는 대신 파일로 저장하도록 강제한다. 기존 getPresignedUrl의
 * 시그니처·동작은 건드리지 않는다(재생용 인라인 URL은 그대로 유지).
 *
 * downloadFilename은 사람이 알아볼 수 있는 이름(예: "마지막영상편지_홍길동.mp4")을
 * 그대로 넘기면 된다 - RFC 6266/5987에 따라 filename*=UTF-8''(퍼센트 인코딩)으로
 * 실어 한글이 깨지지 않게 하고, 구형 브라우저를 위한 ASCII 전용 filename= 폴백도
 * 함께 넣는다(한글이 포함된 문자열을 그대로 quoted-string에 넣으면 헤더가 깨진다).
 *
 * @param {string} s3Key
 * @param {number} expiresInSeconds
 * @param {string} [downloadFilename] - 사람이 읽을 다운로드 파일명(확장자 포함)
 * @returns {Promise<string>} 서명된 다운로드 URL
 */
export const getPresignedDownloadUrl = async (s3Key, expiresInSeconds, downloadFilename) => {
  const asciiFallback = 'ondam_video.mp4'
  const contentDisposition = downloadFilename
    ? `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`
    : 'attachment'

  const command = new GetObjectCommand({
    Bucket: getS3Bucket(),
    Key: s3Key,
    ResponseContentDisposition: contentDisposition,
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

/**
 * S3 오브젝트 삭제 (립싱크 스테이징 파일 등 임시 오브젝트 정리용)
 * @param {string} s3Key
 * @returns {Promise<void>}
 */
export const deleteFromS3 = async (s3Key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: getS3Bucket(),
      Key: s3Key,
    })
    await s3Client.send(command)
  } catch (err) {
    if (err.status) throw err
    throw Object.assign(
      new Error(`S3 삭제 실패 (${s3Key}): ${err.message}`),
      { status: 500 },
    )
  }
}
