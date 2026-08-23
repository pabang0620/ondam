import crypto from 'crypto'
import { KMSClient, EncryptCommand, DecryptCommand, GenerateDataKeyCommand } from '@aws-sdk/client-kms'

const kmsClient = new KMSClient({ region: process.env.AWS_REGION })

const getKmsKeyId = () => {
  const keyId = process.env.KMS_KEY_ID
  if (!keyId) {
    throw Object.assign(new Error('KMS_KEY_ID 환경변수가 설정되지 않았습니다'), { status: 500 })
  }
  return keyId
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
  const response = await kmsClient.send(command)
  return {
    encrypted: Buffer.from(response.CiphertextBlob),
    kmsKeyId: KMS_KEY_ID,
  }
}

/**
 * KMS 암호화된 Buffer를 복호화해 평문 문자열 반환
 * @param {Buffer} encryptedBuffer
 * @returns {Promise<string>}
 */
export const decryptBuffer = async (encryptedBuffer) => {
  const command = new DecryptCommand({
    CiphertextBlob: encryptedBuffer,
  })
  const response = await kmsClient.send(command)
  return Buffer.from(response.Plaintext).toString('utf8')
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

  const { Plaintext: dataKeyPlain, CiphertextBlob: dataKeyEncrypted } = await kmsClient.send(
    new GenerateDataKeyCommand({ KeyId: KMS_KEY_ID, KeySpec: ENVELOPE_DATA_KEY_SPEC }),
  )

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

  const { Plaintext: dataKeyPlain } = await kmsClient.send(
    new DecryptCommand({ CiphertextBlob: encryptedDataKey }),
  )

  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(dataKeyPlain), iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}
