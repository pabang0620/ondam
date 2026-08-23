import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { toSafeFailureMessage } from './failureMessages.js'
import { KMS_KEY_ID_MISSING_CODE } from './kms.js'

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

/**
 * [FIX D14] S3 벤더 설정(리전·버킷) 부재를 "예상 못 한 서버 버그"(500)가 아니라
 * "외부 의존성이 일시적으로 준비되지 않음"(503)으로 구분한다 - kms.js의
 * assertKmsRegionConfigured와 동일한 근거. AWS_REGION이 없으면 getSignedUrl이
 * 서명 단계에서 이미 raw AWS SDK 에러를 던질 수 있어 버킷 확인과 함께 체크한다.
 */
const getS3Bucket = () => {
  if (!process.env.AWS_REGION) {
    // [결함1 수정] 환경변수명은 내부 인프라 구조라 사용자 응답에 노출하지 않는다.
    // 원본은 로그로만 남기고, 응답 메시지는 toSafeFailureMessage로 안전하게 치환한다.
    console.error('[s3] AWS_REGION 환경변수가 설정되지 않았습니다')
    throw Object.assign(new Error(toSafeFailureMessage('AWS_REGION 환경변수가 설정되지 않았습니다')), { status: 503 })
  }
  const bucket = process.env.S3_BUCKET
  if (!bucket) {
    console.error('[s3] S3_BUCKET 환경변수가 설정되지 않았습니다')
    throw Object.assign(new Error(toSafeFailureMessage('S3_BUCKET 환경변수가 설정되지 않았습니다')), { status: 503 })
  }
  return bucket
}

/**
 * [FIX D14] kms.js의 wrapKmsError와 동일한 근거 - 환경변수가 형식상 존재해도 값
 * 자체가 유효하지 않으면(만료/무효 자격 증명 등) s3Client.send()가 raw AWS SDK
 * 에러(InvalidAccessKeyId 등)를 던지고, 이 역시 .status가 없어 500이 된다. 벤더에
 * 닿을 수 없는 원인만 503으로 재분류하고, 그 외(예: 잘못된 Key로 인한 NoSuchKey처럼
 * 우리 쪽 로직 문제일 가능성이 있는 에러)는 500 그대로 둔다.
 */
const VENDOR_UNAVAILABLE_ERROR_PATTERN =
  /CredentialsProviderError|UnrecognizedClientException|InvalidClientTokenId|InvalidAccessKeyId|AuthorizationHeaderMalformed|MissingAuthenticationToken|ExpiredTokenException|SignatureDoesNotMatch|AccessDenied|NetworkingError|TimeoutError|ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENOTFOUND/i

const wrapS3Error = (err, fallbackMessage) => {
  if (err.status) return err // getS3Bucket()의 503은 재래핑하지 않고 그대로 전파
  const signature = `${err.name ?? ''} ${err.code ?? ''} ${err.message ?? ''}`
  if (VENDOR_UNAVAILABLE_ERROR_PATTERN.test(signature)) {
    // [결함1 수정] AWS SDK 원문을 그대로 노출하지 않는다. 원본은 로그로만 남긴다.
    console.error('[s3] 벤더 오류 (503로 재분류):', err.name, err.code, err.message)
    const safeMessage = toSafeFailureMessage(err.message) ?? '지금은 처리가 어려워요. 잠시 후 다시 시도해 주세요.'
    return Object.assign(new Error(safeMessage), { status: 503 })
  }
  // [결함1 수정] fallbackMessage(예: "S3 다운로드 실패 (${s3Key}): ${err.message}")는
  // S3 키·벤더 원문을 담고 있어 그대로 노출하지 않는다. 원본은 로그로만 남긴다.
  console.error('[s3]', fallbackMessage)
  const safeFallback = toSafeFailureMessage(fallbackMessage) ?? '처리 중 문제가 발생했어요. 다시 시도해 주세요.'
  return Object.assign(new Error(safeFallback), { status: 500 })
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
    throw wrapS3Error(err, `S3 다운로드 실패 (${s3Key}): ${err.message}`)
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
      // [결함1 수정] err.status가 이미 있으면 wrapS3Error가 그대로 전파하므로(위
      // wrapS3Error의 `if (err.status) return err`), 이 시점에 바로 안전한
      // 메시지로 만들어야 한다.
      // [전수점검 - willService.js 회귀와 동일 클래스 예방] 현재 이 에러를 호출부
      // (videoWorker 등)가 메시지 문자열로 분기해 폴백하는 곳은 없다 - useKms 업로드는
      // 항상 하드 실패한다(SSE-KMS 없이 영상 파일을 올리지 않는다). 다만 kms.js의
      // getKmsKeyId()와 동일한 성격의 에러이므로, 향후 여기에도 로컬 개발 폴백이
      // 추가될 경우를 대비해 동일한 구조적 마커(code)를 지금부터 붙여둔다 - 문자열
      // 비교로 분기하는 코드가 새로 생기는 것을 원천 차단한다.
      console.error('[s3] KMS_KEY_ID 환경변수가 설정되지 않았습니다 (SSE-KMS 업로드 요청)')
      throw Object.assign(
        new Error(toSafeFailureMessage('KMS_KEY_ID 환경변수가 설정되지 않았습니다')),
        { status: 503, code: KMS_KEY_ID_MISSING_CODE },
      )
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
    throw wrapS3Error(err, `S3 업로드 실패 (${s3Key}): ${err.message}`)
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
    throw wrapS3Error(err, `S3 삭제 실패 (${s3Key}): ${err.message}`)
  }
}
