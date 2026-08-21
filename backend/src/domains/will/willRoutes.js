import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import * as willController from './willController.js'
import { WILL_RELEASE_POLICY, WILL_EVENT_TYPE } from '../../../../shared/constants/enums.js'

const router = Router()

// AI 처리 비용 방지 - 음성 클론/영상 생성 트리거 엔드포인트 전용
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 20,                   // 시간당 최대 20회
  keyGenerator: (req) => req.user?.userId ?? req.ip,
  message: { success: false, message: 'AI 처리 요청 한도를 초과했습니다' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ─── 스키마 ───────────────────────────────────────────────────────────────────

const uploadVoiceSampleSchema = z.object({
  body: z.object({
    s3Key: z.string().min(1, 'S3 키를 입력하세요'),
    durationSec: z.coerce.number().positive().max(30, '음성 녹음은 30초 이하여야 합니다').optional(),
    fileSize: z.coerce.number().positive().max(10 * 1024 * 1024, '음성 파일은 10MB 이하여야 합니다').optional(),
  }),
})

const voiceSampleIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('유효한 UUID'),
  }),
})

const createWillSchema = z.object({
  body: z.object({
    voiceSampleId: z.string().uuid('유효한 UUID'),
    title: z.string().trim().min(1, '제목을 입력하세요').max(200),
    contentText: z.string().trim().min(1, '유언 내용을 입력하세요').max(5000, '유언 내용은 5000자 이하여야 합니다'),
    releasePolicy: z.enum(WILL_RELEASE_POLICY).default('manual_admin'),
    // priceKrw는 클라이언트 입력을 받지 않는다 - 가격은 서버(willService의
    // WILL_BASIC_PRICE_KRW)가 단일 정본으로 결정한다. 결제 단계(preparePayment)의
    // 서버검증을 우회해 will 생성 단계에서 가격을 임의로 지정하는 경로를 차단.
    eventType: z.enum(WILL_EVENT_TYPE).optional(),
    beneficiaries: z.array(
      z.object({
        name: z.string().trim().min(1, '수혜자 이름을 입력하세요').max(100),
        email: z.string().email('유효한 이메일을 입력하세요'),
        phone: z.string().trim().max(20).optional(),
        relationship: z.string().trim().min(1, '관계를 입력하세요').max(50),
      }),
    ).default([]),
  }),
})

const willListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }).optional(),
})

const willIdParamSchema = z.object({
  params: z.object({
    willId: z.string().uuid('유효한 UUID'),
  }),
})

const requestReleaseSchema = z.object({
  params: z.object({
    token: z.string().length(64, '유효하지 않은 토큰입니다'),
  }),
  body: z.object({
    deathCertS3Key: z.string().min(1, '사망증명서 S3 키를 입력하세요'),
    deathCertUrl: z.string().url('유효한 사망증명서 URL을 입력하세요').refine((url) => {
      if (!url) return true
      try {
        const { protocol, hostname } = new URL(url)
        if (protocol !== 'https:') return false
        const bucket = process.env.S3_BUCKET
        const region = process.env.AWS_REGION
        if (bucket && region) {
          return hostname === `${bucket}.s3.${region}.amazonaws.com`
        }
        return hostname.endsWith('.amazonaws.com')
      } catch { return false }
    }, '허용되지 않는 URL입니다'),
  }),
})

const watchTokenSchema = z.object({
  params: z.object({
    token: z.string().length(64, '유효하지 않은 토큰입니다'),
  }),
})

// ─── 인증 필요 라우트 ──────────────────────────────────────────────────────────

router.post(
  '/voice-samples',
  requireAuth,
  aiLimiter,
  validate(uploadVoiceSampleSchema),
  willController.uploadVoiceSample,
)

router.get(
  '/voice-samples/:id/status',
  requireAuth,
  validate(voiceSampleIdSchema),
  willController.getVoiceSampleStatus,
)

router.post(
  '/wills',
  requireAuth,
  aiLimiter,
  validate(createWillSchema),
  willController.createWill,
)

router.get(
  '/wills',
  requireAuth,
  validate(willListSchema),
  willController.getWills,
)

router.get(
  '/wills/:willId',
  requireAuth,
  validate(willIdParamSchema),
  willController.getWill,
)

router.post(
  '/wills/:willId/activate',
  requireAuth,
  aiLimiter,
  validate(willIdParamSchema),
  willController.activateWill,
)

router.get(
  '/wills/:willId/status',
  requireAuth,
  validate(willIdParamSchema),
  willController.getVideoStatus,
)

// ─── 비회원 라우트 ─────────────────────────────────────────────────────────────

router.post(
  '/release/:token',
  validate(requestReleaseSchema),
  willController.requestRelease,
)

router.get(
  '/watch/:token',
  validate(watchTokenSchema),
  willController.getWatchUrl,
)

export default router
