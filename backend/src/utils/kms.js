import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms'

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
