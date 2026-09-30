import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import * as willController from './willController.js'
import { WILL_RELEASE_POLICY, WILL_EVENT_TYPE } from '../../../../shared/constants/enums.js'
import { multerErrorHandler } from '../common/uploadMiddleware.js'

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

// 사후 공개 요청 라우트(업로드 + 제출) 전용 - 무인증 경로라 IP+토큰 조합으로 남용 방지 (G9-1)
const releaseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 10,                   // 토큰 하나당 시간당 최대 10회(업로드 재시도 포함)
  keyGenerator: (req) => `${req.ip}:${req.params.token ?? ''}`,
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// [보안 수정] /watch/:token에 rate limiter가 없던 문제(G9-1) 대응. 정보 조회(GET)와
// 본인 확인(POST verify) 둘 다 여기로 묶는다 - IP+토큰 조합 기준이라 다른 유가족의
// 정상 접근을 막지 않으면서, 한 토큰에 대한 무차별 대입성 트래픽만 제한한다.
// 오입력 5회 잠금(Redis, willService)이 1차 방어선이고, 이 limiter는 그 카운터
// 자체를 소진시키려는 자동화 트래픽을 걸러내는 2차 방어선이다.
const watchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 30,                   // 페이지 새로고침 + 본인 확인 재시도 여유분 포함
  keyGenerator: (req) => `${req.ip}:${req.params.token ?? ''}`,
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ─── 스키마 ───────────────────────────────────────────────────────────────────

const uploadVoiceSampleSchema = z.object({
  body: z.object({
    s3Key: z.string().min(1, 'S3 키를 입력하세요'),
    durationSec: z.coerce.number().min(10, '음성은 10초 이상 녹음해 주세요').max(300, '음성 녹음은 5분 이하여야 합니다').optional(),
    fileSize: z.coerce.number().positive().max(30 * 1024 * 1024, '음성 파일은 30MB 이하여야 합니다').optional(),
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
    contentText: z.string().trim().min(1, '편지 내용을 입력하세요').max(5000, '편지 내용은 5000자 이하여야 합니다'),
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

const verifyWatchAccessSchema = z.object({
  params: z.object({
    token: z.string().length(64, '유효하지 않은 토큰입니다'),
  }),
  body: z.object({
    phoneLast4: z.string().regex(/^\d{4}$/, '휴대폰 번호 뒤 4자리(숫자 4개)를 입력하세요'),
  }),
})

const releaseTokenParamSchema = z.object({
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

// 사망증명서 업로드 - 초대 토큰으로 인증(계정 불필요). 토큰 검증 → S3(KMS 암호화) 업로드
// 순서: releaseLimiter(남용 방지) → validate(토큰 형식) → attachReleaseContext(토큰 실재 확인 +
// will/beneficiary 스코프 확정, req.releaseContext 주입) → 컨트롤러(그 스코프로만 S3 키 생성)
router.post(
  '/release/:token/upload',
  releaseLimiter,
  validate(releaseTokenParamSchema),
  willController.attachReleaseContext,
  willController.uploadReleaseDocument,
)

router.post(
  '/release/:token',
  releaseLimiter,
  validate(requestReleaseSchema),
  willController.requestRelease,
)

// [보안 수정] 진입 시에는 최소 정보만(영상 URL 없음). 본인 확인 통과 후에만
// verify 라우트가 영상 URL을 내려준다.
router.get(
  '/watch/:token',
  watchLimiter,
  validate(watchTokenSchema),
  willController.getWatchInfo,
)

router.post(
  '/watch/:token/verify',
  watchLimiter,
  validate(verifyWatchAccessSchema),
  willController.verifyWatchAccess,
)

// [SPEC-05 3절] 만료된 링크 재발급 - watchLimiter 재사용(같은 남용 방지 목적)
router.post(
  '/watch/:token/extend',
  watchLimiter,
  validate(watchTokenSchema),
  willController.requestWatchLinkExtension,
)

// multer 에러(파일 크기 초과·허용되지 않는 형식 등)를 400으로 정규화
router.use(multerErrorHandler)

export default router
