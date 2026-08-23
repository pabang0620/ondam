import multer from 'multer'
import multerS3 from 'multer-s3'
import { S3Client } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'

// ─── S3 클라이언트 ────────────────────────────────────────────────────────────

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

// ─── 벤더 미설정·자격 증명 무효 → 503 가드 (utils/kms.js·utils/s3.js와 동일 근거) ─────
//
// [결함 4 수정] 이 파일은 원래 kms.js/s3.js의 wrapKmsError/getS3Bucket류 가드를 타지
// 않았다 - S3_BUCKET/AWS_REGION이 비어 있거나 자격 증명이 무효하면 multer-s3가
// 업로드 시점에 raw AWS SDK 에러(CredentialsProviderError, InvalidAccessKeyId 등)를
// 던지는데, 그 에러엔 .status가 없어 multerErrorHandler(MulterError만 처리)를 그냥
// 통과해버리고 글로벌 에러 핸들러에서 500이 됐다. willController.uploadReleaseDocument만
// 컨트롤러 레벨에서 개별적으로 이 가드를 우회 구현하고 있었다 - 이제 미들웨어
// 자체에 넣어 uploadSingleImage/uploadSingleAudio/uploadSingle/uploadMultiple/
// uploadDeathCertificate를 쓰는 모든 라우트(uploads/photo, uploads/audio,
// 사망증명서 업로드 등)가 일관되게 503을 받는다.
const VENDOR_UNAVAILABLE_ERROR_PATTERN =
  /CredentialsProviderError|UnrecognizedClientException|InvalidClientTokenId|InvalidAccessKeyId|AuthorizationHeaderMalformed|MissingAuthenticationToken|ExpiredTokenException|SignatureDoesNotMatch|AccessDenied|NetworkingError|TimeoutError|ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENOTFOUND/i

/**
 * S3_BUCKET/AWS_REGION(및 useKms인 경우 KMS_KEY_ID) 환경변수 부재를
 * "예상 못 한 서버 버그"(500)가 아니라 "외부 의존성이 일시적으로 준비되지
 * 않음"(503)으로 구분한다. multer를 태우기 전에 먼저 확인한다.
 */
const assertUploadVendorConfigured = (useKms) => {
  if (!process.env.AWS_REGION) {
    throw Object.assign(new Error('AWS_REGION 환경변수가 설정되지 않았습니다'), { status: 503 })
  }
  if (!process.env.S3_BUCKET) {
    throw Object.assign(new Error('S3_BUCKET 환경변수가 설정되지 않았습니다'), { status: 503 })
  }
  if (useKms && !process.env.KMS_KEY_ID) {
    throw Object.assign(new Error('KMS_KEY_ID 환경변수가 설정되지 않았습니다'), { status: 503 })
  }
}

/**
 * multer 인스턴스의 .single()/.array() 핸들러를 감싸 (1) 업로드 시도 전 벤더 설정
 * 부재를 503으로 먼저 걸러내고, (2) 환경변수는 있어도 값 자체가 무효한 자격
 * 증명이라 multer-s3가 PutObject 시점에 던지는 raw AWS SDK 에러를 503으로
 * 재분류한다. MulterError(파일 크기·개수 등)는 그대로 통과시켜 기존
 * multerErrorHandler가 400으로 정규화하도록 둔다 - 벤더 도달 불가 원인이
 * 아닌 에러(예: 우리 쪽 로직 문제)까지 503으로 뭉개지 않는다.
 * @param {import('multer').Multer} multerHandler - upload.single(field) 또는 upload.array(field, n) 결과
 * @param {boolean} useKms
 */
const wrapUpload = (multerHandler, useKms) => (req, res, callback) => {
  try {
    assertUploadVendorConfigured(useKms)
  } catch (err) {
    return callback(err)
  }

  multerHandler(req, res, (err) => {
    if (err) {
      if (!(err instanceof multer.MulterError) && !err.status) {
        const signature = `${err.name ?? ''} ${err.code ?? ''} ${err.message ?? ''}`
        if (VENDOR_UNAVAILABLE_ERROR_PATTERN.test(signature)) {
          return callback(Object.assign(new Error(`파일 업로드 실패: ${err.message}`), { status: 503 }))
        }
      }
      return callback(err)
    }
    return callback()
  })
}

// ─── MIME / 확장자 허용 목록 ──────────────────────────────────────────────────
//
// 주의: multerS3는 파일을 S3로 스트리밍하므로 Node.js 레이어에서 magic bytes를
// 직접 읽을 수 없다. 대신 MIME 타입(Content-Type 헤더) + 확장자 이중 검증으로
// 위장 파일을 걸러낸다.
// multerS3.AUTO_CONTENT_TYPE은 S3 저장 시 실제 MIME을 재탐지하므로
// Content-Type 위조 파일이 올라가더라도 S3 메타데이터에는 올바른 값이 기록된다.

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_AUDIO_MIMES = ['audio/mpeg', 'audio/wav', 'audio/webm']
const ALLOWED_ALL_MIMES = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_AUDIO_MIMES]
// 사망증명서 등 신원 서류 업로드 전용 - 이미지 + PDF (아래 uploadDeathCertificate에서만 사용)
const ALLOWED_DOCUMENT_MIMES = [...ALLOWED_IMAGE_MIMES, 'application/pdf']

// MIME → 허용 확장자 목록 (소문자)
const MIME_TO_EXTENSIONS = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png':  ['.png'],
  'image/webp': ['.webp'],
  'audio/mpeg': ['.mp3'],
  'audio/wav':  ['.wav'],
  'audio/webm': ['.webm'],
  'application/pdf': ['.pdf'],
}

const IMAGE_MAX_BYTES = 20 * 1024 * 1024   // 20 MB
const AUDIO_MAX_BYTES = 200 * 1024 * 1024  // 200 MB
const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024 // 10 MB - 사망증명서 스캔본 기준

// ─── multerS3 스토리지 팩토리 ─────────────────────────────────────────────────

/**
 * @param {string} folder       - S3 경로 prefix
 * @param {boolean} useKms      - SSE-KMS 적용 여부 (음성·영상 파일 필수)
 */
const buildStorage = (folder, useKms = false) =>
  multerS3({
    s3,
    bucket: process.env.S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    ...(useKms && {
      serverSideEncryption: 'aws:kms',
      ssekmsKeyId: process.env.KMS_KEY_ID,
    }),
    key: (req, file, cb) => {
      const userId = req.user?.userId ?? 'anonymous'
      const ext = path.extname(file.originalname).toLowerCase()
      const key = `${folder}/${userId}/${uuidv4()}${ext}`
      cb(null, key)
    },
  })

// ─── 토큰 스코프 스토리지 (비회원 업로드 전용) ─────────────────────────────────────
//
// req.user가 없는 무인증 경로(사망증명서 업로드 등)를 위한 스토리지 팩토리.
// req.user.userId 대신, 사전 미들웨어(willController.attachReleaseContext 등)가
// 서버에서 토큰을 검증해 req.releaseContext에 심어둔 willId/beneficiaryId로 키를
// 만든다. 클라이언트가 넘긴 값이 아니라 서버가 DB 조회로 확정한 값만 키에 들어가므로
// S3 키 경로 조작이 불가능하다.

const buildTokenScopedStorage = (folder, useKms = false) =>
  multerS3({
    s3,
    bucket: process.env.S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    ...(useKms && {
      serverSideEncryption: 'aws:kms',
      ssekmsKeyId: process.env.KMS_KEY_ID,
    }),
    key: (req, file, cb) => {
      const ctx = req.releaseContext
      if (!ctx?.willId || !ctx?.beneficiaryId) {
        return cb(new Error('요청 정보를 확인할 수 없습니다'))
      }
      const ext = path.extname(file.originalname).toLowerCase()
      const key = `${folder}/${ctx.willId}/release-docs/${ctx.beneficiaryId}/${uuidv4()}${ext}`
      cb(null, key)
    },
  })

// ─── fileFilter 팩토리 ────────────────────────────────────────────────────────
//
// MIME + 확장자 이중 검증:
// 1) Content-Type 헤더(file.mimetype)가 허용 목록에 있는지 확인
// 2) 원본 파일명 확장자가 해당 MIME의 허용 확장자 목록에 있는지 확인
// → 확장자를 .jpg로 바꾼 스크립트 파일, 또는 MIME을 image/jpeg로 위장한
//   audio 파일 등을 이중으로 차단한다.

const buildFileFilter = (allowedMimes) => (req, file, cb) => {
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(
      Object.assign(new Error(`허용되지 않는 파일 형식입니다 (${file.mimetype})`), {
        status: 400,
      }),
    )
  }

  const ext = path.extname(file.originalname).toLowerCase()
  const allowedExts = MIME_TO_EXTENSIONS[file.mimetype] ?? []
  if (!allowedExts.includes(ext)) {
    return cb(
      Object.assign(
        new Error(`파일 확장자(${ext})가 MIME 타입(${file.mimetype})과 일치하지 않습니다`),
        { status: 400 },
      ),
    )
  }

  cb(null, true)
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * 이미지 단일 업로드
 * @param {string} fieldName - form-data 필드명
 * @param {string} folder    - S3 경로 prefix (예: 'photos')
 */
export const uploadSingleImage = (fieldName, folder) =>
  wrapUpload(
    multer({
      storage: buildStorage(folder),
      limits: { fileSize: IMAGE_MAX_BYTES },
      fileFilter: buildFileFilter(ALLOWED_IMAGE_MIMES),
    }).single(fieldName),
    false,
  )

/**
 * 오디오 단일 업로드 - SSE-KMS 적용 필수 (음성권 보호)
 * @param {string} fieldName - form-data 필드명
 * @param {string} folder    - S3 경로 prefix (예: 'wills')
 */
export const uploadSingleAudio = (fieldName, folder) =>
  wrapUpload(
    multer({
      storage: buildStorage(folder, true),  // KMS 암호화 필수
      limits: { fileSize: AUDIO_MAX_BYTES },
      fileFilter: buildFileFilter(ALLOWED_AUDIO_MIMES),
    }).single(fieldName),
    true,
  )

/**
 * 범용 단일 업로드 (이미지 + 오디오 모두 허용, 이미지 크기 기준 적용)
 * @param {string} fieldName
 * @param {string} folder
 */
export const uploadSingle = (fieldName, folder) =>
  wrapUpload(
    multer({
      storage: buildStorage(folder),
      limits: { fileSize: AUDIO_MAX_BYTES },
      fileFilter: buildFileFilter(ALLOWED_ALL_MIMES),
    }).single(fieldName),
    false,
  )

/**
 * 사망증명서 등 신원 서류 업로드 (비회원, 초대 토큰 경유) - SSE-KMS 필수
 * req.releaseContext(willId, beneficiaryId)가 사전에 설정되어 있어야 한다.
 * (willRoutes.js: willController.attachReleaseContext → 이 미들웨어 순서로 사용)
 * @param {string} fieldName - form-data 필드명
 */
export const uploadDeathCertificate = (fieldName) =>
  wrapUpload(
    multer({
      storage: buildTokenScopedStorage('wills', true), // KMS 암호화 필수 - 민감 신원 서류
      limits: { fileSize: DOCUMENT_MAX_BYTES },
      fileFilter: buildFileFilter(ALLOWED_DOCUMENT_MIMES),
    }).single(fieldName),
    true,
  )

/**
 * 다중 파일 업로드
 * @param {string} fieldName
 * @param {number} maxCount
 * @param {string} folder
 */
export const uploadMultiple = (fieldName, maxCount, folder) =>
  wrapUpload(
    multer({
      storage: buildStorage(folder),
      limits: { fileSize: IMAGE_MAX_BYTES },
      fileFilter: buildFileFilter(ALLOWED_IMAGE_MIMES),
    }).array(fieldName, maxCount),
    false,
  )

/**
 * multer 에러를 400으로 정규화하는 에러 핸들러
 * server.js 글로벌 에러 핸들러에 등록하거나 라우트 뒤에 사용
 */
export const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: '파일 크기가 허용 한도를 초과했습니다',
      LIMIT_FILE_COUNT: '업로드 가능한 파일 수를 초과했습니다',
      LIMIT_UNEXPECTED_FILE: '허용되지 않는 필드명입니다',
    }
    return res.status(400).json({
      success: false,
      message: messages[err.code] ?? '파일 업로드 오류가 발생했습니다',
    })
  }
  next(err)
}
