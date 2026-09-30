import crypto from 'crypto'
import { KMSClient, EncryptCommand, DecryptCommand, GenerateDataKeyCommand } from '@aws-sdk/client-kms'
import { toSafeFailureMessage } from './failureMessages.js'

const kmsClient = new KMSClient({ region: process.env.AWS_REGION })

/**
 * [FIX D14] KMS 벤더 설정(리전) 부재를 "예상 못 한 서버 버그"(500)가 아니라
 * "외부 의존성이 일시적으로 준비되지 않음"(503)으로 구분한다. AWS_REGION이 없으면
 * kmsClient.send()가 raw AWS SDK 에러("Region is missing" 등)를 던지는데, 이
 * 에러엔 .status가 없어 글로벌 에러 핸들러가 무조건 500으로 응답해 왔다 - 그러면
 * 모니터링에서 "서비스가 설정 미비로 잠시 못 뜬 것"과 "코드에 진짜 버그가 있는 것"을
 * 구분할 수 없다. decryptBuffer/decryptStringEnvelope처럼 KMS_KEY_ID를 직접 쓰지
 * 않는 함수(복호화는 ciphertext에 키 참조가 내장돼 있어 필요 없음)도 이 가드를
 * 거치므로 getKmsKeyId() 안에서만 검사하지 않고 별도로 분리했다.
 */
const assertKmsRegionConfigured = () => {
  if (!process.env.AWS_REGION) {
    // [결함1 수정] 환경변수명은 내부 인프라 구조라 사용자 응답에 노출하지 않는다.
    // 원본은 로그로만 남기고, 응답 메시지는 toSafeFailureMessage로 안전하게 치환한다.
    console.error('[kms] AWS_REGION 환경변수가 설정되지 않았습니다')
    throw Object.assign(new Error(toSafeFailureMessage('AWS_REGION 환경변수가 설정되지 않았습니다')), { status: 503 })
  }
}

// [FIX 회귀 수정] 이전에는 willService.js가 이 함수가 던지는 에러를 err.message
// 문자열 정확 비교("KMS_KEY_ID 환경변수가 설정되지 않았습니다")로 감지해 로컬
// 개발 폴백(평문 저장)을 분기했다. 그런데 바로 위 toSafeFailureMessage 도입으로
// 사용자 노출 메시지가 안전한 한국어 문구로 치환되면서 그 문자열 비교가 더 이상
// 매칭되지 않게 됐고, 결과적으로 KMS_KEY_ID가 비어 있는 로컬 개발 환경에서
// 유언장 생성이 폴백 없이 항상 503으로 실패하는 회귀가 발생했다.
// 메시지는 사람이 읽는 텍스트라 국지화·안전화 목적으로 언제든 바뀔 수 있으므로,
// "환경변수가 아예 설정되지 않았다"는 사실은 메시지가 아니라 구조적으로 식별
// 가능한 별도 프로퍼티(code)로 전달한다 - 이 프로젝트가 이미 쓰는
// `Object.assign(new Error(...), { status })` 관례를 status와 동일한 방식으로
// 확장한 것뿐이며, 사용자 노출 메시지(toSafeFailureMessage 결과)는 그대로 유지한다.
// wrapKmsError는 `if (err.status) return err`로 이미 분류된 에러를 그대로
// 전파하므로, 이 code 프로퍼티는 encryptStringEnvelope 등을 거쳐도 유실되지 않는다.
export const KMS_KEY_ID_MISSING_CODE = 'KMS_KEY_ID_MISSING'

const getKmsKeyId = () => {
  assertKmsRegionConfigured()
  const keyId = process.env.KMS_KEY_ID
  if (!keyId) {
    console.error('[kms] KMS_KEY_ID 환경변수가 설정되지 않았습니다')
    throw Object.assign(
      new Error(toSafeFailureMessage('KMS_KEY_ID 환경변수가 설정되지 않았습니다')),
      { status: 503, code: KMS_KEY_ID_MISSING_CODE },
    )
  }
  return keyId
}

/**
 * [FIX D14] "환경변수가 비어 있다"만으로는 실제 장애를 다 못 잡는다 - 실측해보니
 * 이 프로젝트 개발 환경은 AWS_REGION/자격 증명이 형식상 전부 "존재"하지만(예:
 * ~/.aws/credentials의 유효하지 않은 AKID), 그 값 자체가 유효하지 않아 kmsClient.send()가
 * UnrecognizedClientException/InvalidClientTokenId 같은 raw AWS SDK 에러를 던진다 -
 * 이 에러들도 .status가 없어 그대로 500이 된다. 자격 증명·네트워크가 원인인 에러
 * 이름/코드만 골라 503으로 재분류하고, 그 외(예: ciphertext 손상을 뜻하는
 * InvalidCiphertextException처럼 진짜 코드/데이터 버그일 가능성이 있는 에러)는
 * 500 그대로 둔다 - "벤더에 닿을 수 없다"와 "우리 쪽 로직이 잘못됐다"를 구분하는
 * 것이 이 수정의 목적이라, 후자까지 503으로 뭉개면 오히려 실제 버그를 숨기게 된다.
 */
const VENDOR_UNAVAILABLE_ERROR_PATTERN =
  /CredentialsProviderError|UnrecognizedClientException|InvalidClientTokenId|InvalidAccessKeyId|AuthorizationHeaderMalformed|MissingAuthenticationToken|ExpiredTokenException|SignatureDoesNotMatch|AccessDenied|NetworkingError|TimeoutError|ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENOTFOUND/i

const wrapKmsError = (err) => {
  if (err.status) return err // 이미 분류된 에러(위 assert류의 503)는 재래핑하지 않고 그대로 전파
  const signature = `${err.name ?? ''} ${err.code ?? ''} ${err.message ?? ''}`
  if (VENDOR_UNAVAILABLE_ERROR_PATTERN.test(signature)) {
    // [결함1 수정] AWS SDK 원문(자격 증명 오류 등)을 그대로 노출하지 않는다.
    // 원본은 로그로만 남기고 안전한 문구로 치환한다.
    console.error('[kms] 벤더 오류 (503로 재분류):', err.name, err.code, err.message)
    const safeMessage = toSafeFailureMessage(err.message) ?? '지금은 처리가 어려워요. 잠시 후 다시 시도해 주세요.'
    return Object.assign(new Error(safeMessage), { status: 503 })
  }
  return err
}

/**
 * 평문 문자열을 KMS로 암호화
 * @param {string} plaintext
 * @returns {Promise<{ encrypted: Buffer, kmsKeyId: string }>}
 */
export const encryptString = async (plaintext) => {
  const KMS_KEY_ID = getKmsKeyId()
  const command = new EncryptCommand({
    KeyId: KMS_KEY_ID,
    Plaintext: Buffer.from(plaintext, 'utf8'),
  })
  try {
    const response = await kmsClient.send(command)
    return {
      encrypted: Buffer.from(response.CiphertextBlob),
      kmsKeyId: KMS_KEY_ID,
    }
  } catch (err) {
    throw wrapKmsError(err)
  }
}

/**
 * KMS 암호화된 Buffer를 복호화해 평문 문자열 반환
 * @param {Buffer} encryptedBuffer
 * @returns {Promise<string>}
 */
export const decryptBuffer = async (encryptedBuffer) => {
  assertKmsRegionConfigured()
  const command = new DecryptCommand({
    CiphertextBlob: encryptedBuffer,
  })
  try {
    const response = await kmsClient.send(command)
    return Buffer.from(response.Plaintext).toString('utf8')
  } catch (err) {
    throw wrapKmsError(err)
  }
}

/**
 * KMS 암호화된 값(Buffer 또는 base64 문자열)과 kmsKeyId를 받아 복호화
 * subscriptions.toss_billing_key_encrypted 복호화 용도
 * @param {Buffer|string} encryptedValue - DB에서 읽은 BLOB/Buffer 또는 base64 문자열
 * @param {string} _kmsKeyId - KMS 복호화 시 키 ID는 ciphertext에 포함되어 있으므로 미사용
 * @returns {Promise<string>}
 */
export const decryptString = async (encryptedValue, _kmsKeyId) => {
  const cipherBlob = Buffer.isBuffer(encryptedValue)
    ? encryptedValue
    : Buffer.from(encryptedValue, 'base64')
  return decryptBuffer(cipherBlob)
}

/**
 * DB BLOB/VARBINARY에서 읽은 KMS 암호문을 decryptBuffer에 넘길 Buffer로 정규화한다.
 * [버그 수정] videoWorker가 과거에 wills.result_video_s3_key_encrypted에 암호문 Buffer
 * 대신 base64 문자열(ASCII 바이트)을 저장해, 읽는 쪽에서 그 ASCII 바이트를 그대로
 * KMS Decrypt에 넘겨 복호화가 실패했다. 신규 데이터는 Buffer 원본으로 저장하고,
 * 과거 데이터(내용이 순수 base64 ASCII)는 여기서 디코드해 호환한다. 실제 KMS
 * 암호문은 첫 바이트가 0x01 등 비ASCII 제어 바이트라 base64 문자 집합과 겹치지 않는다.
 * @param {Buffer|Uint8Array|string} value
 * @returns {Buffer}
 */
const BASE64_ASCII_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/

export const toKmsCipherBuffer = (value) => {
  const buf = Buffer.isBuffer(value) ? value : Buffer.from(value)
  if (buf.length === 0 || buf.length % 4 !== 0) return buf
  const ascii = buf.toString('latin1')
  if (!BASE64_ASCII_PATTERN.test(ascii)) return buf
  return Buffer.from(ascii, 'base64')
}

// ─── 봉투 암호화 (envelope encryption) ────────────────────────────────────────
// AWS KMS의 Encrypt/Decrypt API(위 encryptString/decryptBuffer)는 평문 4,096바이트
// 제한이 있다. 유언 텍스트는 zod에서 최대 5,000자를 허용하는데 한글은 UTF-8로
// 글자당 최대 4바이트까지 갈 수 있어 최대 약 20,000바이트 - 이 한도를 넘을 수 있다.
// AWS가 4KB 초과 데이터에 공식 권장하는 표준 패턴이 봉투 암호화다: 매 암호화마다
// GenerateDataKey로 일회용 대칭키(평문 형태 + KMS로 암호화된 형태 두 가지)를
// 발급받아, 실제 데이터는 평문 데이터 키로 로컬 AES-256-GCM 암호화하고 평문 데이터
// 키는 즉시 버린다. 암호화된 데이터 키(해당 KMS 키로만 복호화 가능)만 암호문과
// 함께 저장한다 - 크기 제한이 로컬 AES 한도(사실상 무제한)로 바뀌고, KMS 호출은
// 데이터 키 발급/복호화 1회씩만 필요하다.
//
// 짧고(4KB 미만) 앞으로도 커질 일이 없는 데이터(빌링키, S3 키 등)는 기존
// encryptString/decryptBuffer를 그대로 쓴다 - 이 함수들을 바꾸지 않는다.
//
// 저장 포맷(하나의 Buffer/BLOB에 직렬화):
//   [1B]        formatVersion    = 0x01 (향후 알고리즘 교체 대비 식별자)
//   [2B BE]     edkLen           암호화된 데이터 키 길이(uint16)
//   [edkLen B]  encryptedDataKey GenerateDataKey의 CiphertextBlob
//   [12B]       iv               AES-256-GCM nonce
//   [16B]       authTag          AES-256-GCM 인증 태그
//   [나머지]     ciphertext       AES-256-GCM 암호문
// kmsKeyId(ARN)는 이 포맷 안에는 넣지 않고 기존과 동일하게 별도 컬럼
// (content_text_kms_key_id)에 저장한다 - Decrypt API가 CiphertextBlob 안에
// 원 키 정보를 자체적으로 담고 있어 복호화 시 KeyId를 다시 넘길 필요가 없다.
const ENVELOPE_FORMAT_VERSION = 0x01
const ENVELOPE_IV_LENGTH = 12
const ENVELOPE_AUTH_TAG_LENGTH = 16
const ENVELOPE_DATA_KEY_SPEC = 'AES_256'

/**
 * 4KB 제한 없이 임의 길이의 평문 문자열을 봉투 암호화한다.
 * @param {string} plaintext
 * @returns {Promise<{ encrypted: Buffer, kmsKeyId: string }>}
 */
export const encryptStringEnvelope = async (plaintext) => {
  const KMS_KEY_ID = getKmsKeyId()

  let dataKeyPlain
  let dataKeyEncrypted
  try {
    ;({ Plaintext: dataKeyPlain, CiphertextBlob: dataKeyEncrypted } = await kmsClient.send(
      new GenerateDataKeyCommand({ KeyId: KMS_KEY_ID, KeySpec: ENVELOPE_DATA_KEY_SPEC }),
    ))
  } catch (err) {
    throw wrapKmsError(err)
  }

  const iv = crypto.randomBytes(ENVELOPE_IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(dataKeyPlain), iv)
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()])
  const authTag = cipher.getAuthTag()
  // 평문 데이터 키는 여기서 용도가 끝난다 - 별도 변수에 다시 담거나 반환하지 않는다
  // (참조를 남기지 않아야 GC 대상이 되고, 실수로 로그·응답에 흘러나갈 표면도 없다).

  const encryptedDataKey = Buffer.from(dataKeyEncrypted)
  const header = Buffer.alloc(3)
  header.writeUInt8(ENVELOPE_FORMAT_VERSION, 0)
  header.writeUInt16BE(encryptedDataKey.length, 1)

  const encrypted = Buffer.concat([header, encryptedDataKey, iv, authTag, ciphertext])
  return { encrypted, kmsKeyId: KMS_KEY_ID }
}

/**
 * encryptStringEnvelope로 만든 Buffer를 복호화해 평문 문자열을 반환한다.
 * @param {Buffer|string} envelopeValue - DB에서 읽은 BLOB/Buffer (또는 base64 문자열)
 * @returns {Promise<string>}
 */
export const decryptStringEnvelope = async (envelopeValue) => {
  assertKmsRegionConfigured()
  const buf = Buffer.isBuffer(envelopeValue) ? envelopeValue : Buffer.from(envelopeValue, 'base64')

  const version = buf.readUInt8(0)
  if (version !== ENVELOPE_FORMAT_VERSION) {
    throw Object.assign(
      new Error(`알 수 없는 봉투 암호화 포맷 버전입니다: ${version}`),
      { status: 500 },
    )
  }
  const edkLen = buf.readUInt16BE(1)
  let offset = 3
  const encryptedDataKey = buf.subarray(offset, offset + edkLen)
  offset += edkLen
  const iv = buf.subarray(offset, offset + ENVELOPE_IV_LENGTH)
  offset += ENVELOPE_IV_LENGTH
  const authTag = buf.subarray(offset, offset + ENVELOPE_AUTH_TAG_LENGTH)
  offset += ENVELOPE_AUTH_TAG_LENGTH
  const ciphertext = buf.subarray(offset)

  let dataKeyPlain
  try {
    ;({ Plaintext: dataKeyPlain } = await kmsClient.send(
      new DecryptCommand({ CiphertextBlob: encryptedDataKey }),
    ))
  } catch (err) {
    throw wrapKmsError(err)
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(dataKeyPlain), iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}
