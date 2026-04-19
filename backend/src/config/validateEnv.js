/**
 * 필수 환경변수 검증
 * 서버 시작 시 호출 — 누락 시 process.exit(1)으로 즉시 종료
 * AI/결제 등 외부 API 키는 warning만 출력 (개발 환경 편의)
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
  'HIGGSFIELD_API_KEY',
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
    console.error('[env] 필수 환경변수 누락 — 서버를 시작할 수 없습니다:')
    missing.forEach((key) => console.error(`  - ${key}`))
    process.exit(1)
  }

  const warnMissing = WARNING_ONLY.filter((key) => !process.env[key])
  if (warnMissing.length > 0) {
    console.warn('[env] 외부 API 환경변수 미설정 (해당 기능 비활성화됨):')
    warnMissing.forEach((key) => console.warn(`  - ${key}`))
  }
}
