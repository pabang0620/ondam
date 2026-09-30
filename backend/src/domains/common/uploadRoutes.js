import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../../middleware/auth.js'
import {
  uploadSingleImage,
  uploadSingleAudio,
  multerErrorHandler,
} from './uploadMiddleware.js'
import { success, error } from '../../utils/response.js'

const router = Router()

// [AUTH-11] S3 저장 비용·남용 방지 - 사용자 단위 제한. requireAuth 뒤에 두므로
// req.user가 항상 존재한다 (다른 도메인 limiter와 같은 keyGenerator 패턴)
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10분
  max: 60,                   // 10분 내 최대 60회
  keyGenerator: (req) => req.user?.userId ?? req.ip,
  message: { success: false, message: '업로드 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 모든 업로드 라우트 인증 필수
router.use(requireAuth)
router.use(uploadLimiter)

/**
 * POST /api/uploads/photo
 * 사진(이미지) 업로드 → S3 키 + URL 반환
 * form-data 필드: file
 */
router.post('/photo', (req, res, next) => {
  const upload = uploadSingleImage('file', 'photos')
  upload(req, res, (err) => {
    if (err) return next(err)
    if (!req.file) {
      return error(res, '업로드할 파일이 없습니다', 400)
    }
    return success(res, {
      s3Key: req.file.key,
      url: req.file.location,
      mimeType: req.file.mimetype,
      size: req.file.size,
    }, '사진 업로드 완료')
  })
})

/**
 * POST /api/uploads/audio
 * 음성 파일 업로드 → S3 키 + URL 반환
 * form-data 필드: file
 */
router.post('/audio', (req, res, next) => {
  const upload = uploadSingleAudio('file', 'wills')
  upload(req, res, (err) => {
    if (err) return next(err)
    if (!req.file) {
      return error(res, '업로드할 파일이 없습니다', 400)
    }
    return success(res, {
      s3Key: req.file.key,
      url: req.file.location,
      mimeType: req.file.mimetype,
      size: req.file.size,
    }, '음성 업로드 완료')
  })
})

// multer 에러 정규화 (이 라우터 범위 내에서만 동작)
router.use(multerErrorHandler)

export default router
