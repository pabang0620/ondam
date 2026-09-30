/**
 * 환경변수 검증 및 환경 판별 유틸
 * 서버 시작 시 호출 - 필수 변수 누락 시 process.exit(1)
 */

const REQUIRED = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'DB_HOST',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_USER',
]

const WARNING_ONLY = [
  'GEMINI_API_KEY',
  'ELEVENLABS_API_KEY',
  'SYNC_API_KEY',
  'FAL_API_KEY',
  'DID_API_KEY',
  'TOSS_SECRET_KEY',
  'TOSS_WEBHOOK_SECRET',
  'KMS_KEY_ID',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'S3_BUCKET',
  'REDIS_HOST',
  'COOLSMS_API_KEY',
  'COOLSMS_API_SECRET',
  'COOLSMS_SENDER',
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
  'GMAIL_USER',
  'KAKAO_CLIENT_ID',
  'KAKAO_CLIENT_SECRET',
]

export const validateEnv = () => {
  const missing = REQUIRED.filter((key) => !process.env[key])

  if (missing.length > 0) {
    console.error('[env] 필수 환경변수 누락 - 서버를 시작할 수 없습니다:')
    missing.forEach((key) => console.error(`  - ${key}`))
    process.exit(1)
  }

  // NODE_ENV 검증
  const validEnvs = ['production', 'development', 'test']
  const currentEnv = process.env.NODE_ENV
  if (!validEnvs.includes(currentEnv)) {
    console.error(`[env] NODE_ENV는 ${validEnvs.join(', ')} 중 하나여야 합니다. 현재: ${currentEnv}`)
    process.exit(1)
  }

  // production 필수 변수
  if (currentEnv === 'production') {
    const prodRequired = ['CLIENT_URL', 'REDIS_HOST', 'TOSS_SECRET_KEY', 'KMS_KEY_ID']
    const prodMissing = prodRequired.filter((key) => !process.env[key])
    if (prodMissing.length > 0) {
      console.error('[env] production 환경에서 필수인 환경변수 누락:')
      prodMissing.forEach((key) => console.error(`  - ${key}`))
      process.exit(1)
    }

    // production에서 MOCK 플래그 금지
    if (process.env.PAYMENT_MOCK === 'true') {
      console.error('[env] production 환경에서 PAYMENT_MOCK=true는 허용되지 않습니다')
      process.exit(1)
    }
    if (process.env.AI_MOCK === 'true') {
      console.error('[env] production 환경에서 AI_MOCK=true는 허용되지 않습니다')
      process.exit(1)
    }
  }

  // JWT 시크릿 검증
  const jwtSecret = process.env.JWT_SECRET
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET
  if (jwtSecret === jwtRefreshSecret) {
    console.error('[env] JWT_SECRET과 JWT_REFRESH_SECRET이 동일하면 안 됩니다')
    process.exit(1)
  }
  if (jwtSecret.length < 32 || jwtRefreshSecret.length < 32) {
    console.error('[env] JWT_SECRET과 JWT_REFRESH_SECRET은 각각 32자 이상이어야 합니다')
    process.exit(1)
  }

  const warnMissing = WARNING_ONLY.filter((key) => !process.env[key])
  if (warnMissing.length > 0) {
    console.warn('[env] 외부 API 환경변수 미설정 (해당 기능 비활성화됨):')
    warnMissing.forEach((key) => console.warn(`  - ${key}`))
  }
}

export const isLocalDevEnvironment = () => {
  return process.env.NODE_ENV === 'development'
}
