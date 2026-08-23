/**
 * Pet Routes
 * Base: /api/pet
 */

import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { validate } from '../../middleware/validate.js'
import { requireAuth } from '../../middleware/auth.js'
import * as petController from './petController.js'
import { PET_SPECIES, PET_STATUS, PET_MEDIA_TYPE } from '../../../../shared/constants/enums.js'

const router = Router()

// AI 처리 비용 방지 - will/photo 도메인과 동일 패턴(G9-1). 초상화 생성은 실제
// AI 비용이 발생하는 엔드포인트라 반드시 필요하다.
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 20,                   // 시간당 최대 20회
  keyGenerator: (req) => req.user?.userId ?? req.ip,
  message: { success: false, message: 'AI 초상화 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ---------------------------------------------------------------------------
// Zod 스키마
// ---------------------------------------------------------------------------

const speciesEnum = z.enum(
  PET_SPECIES,
  { errorMap: () => ({ message: '유효하지 않은 동물 종류입니다' }) }
)

const petStatusEnum = z.enum(
  PET_STATUS,
  { errorMap: () => ({ message: '유효하지 않은 상태입니다' }) }
)

const paginationQuery = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
})

const petIdParam = z.object({
  params: z.object({
    petId: z.string().uuid('유효하지 않은 petId입니다'),
  }),
})

const createPetSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, '이름을 입력해주세요').max(50, '이름은 50자 이하여야 합니다'),
    species: speciesEnum,
    breed: z.string().trim().max(100).optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다').optional().nullable(),
    deathDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다').optional().nullable(),
  }),
})

const updatePetSchema = z.object({
  params: z.object({
    petId: z.string().uuid('유효하지 않은 petId입니다'),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(50).optional(),
    breed: z.string().trim().max(100).optional().nullable(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    deathDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    profileImageUrl: z.string().url().optional().nullable(),
    memorialSlug: z
      .string()
      .min(3, '슬러그는 3자 이상이어야 합니다')
      .max(100)
      .regex(/^[a-z0-9-]+$/, '슬러그는 소문자, 숫자, 하이픈만 사용 가능합니다')
      .optional()
      .nullable(),
    // 추모관 접근 코드 (SPEC-03) - 설정 시에만 펫 추모 페이지 열람 가능,
    // 미설정(NULL)이면 기본 비공개
    memorialAccessCode: z
      .string()
      .min(6, '접근 코드는 6자 이상이어야 합니다')
      .max(50)
      .optional()
      .nullable(),
    // 추모 페이지 공개 여부 (SPEC-03, DEV-16) - true면 접근 코드 없이 공개.
    // 기본값(생략 시)은 DB DEFAULT 0(비공개) 그대로 유지 - 안전 기본값.
    isPublic: z.boolean().optional(),
  }),
})

const updateStatusSchema = z.object({
  params: z.object({
    petId: z.string().uuid('유효하지 않은 petId입니다'),
  }),
  body: z.object({
    nextStatus: petStatusEnum,
    reason: z.string().max(500).optional().nullable(),
  }),
})

const mediaTypeEnum = z.enum(
  PET_MEDIA_TYPE,
  { errorMap: () => ({ message: '유효하지 않은 미디어 타입입니다' }) }
)

// [FIX D6, 2026-08-23] mimeType/fileSize는 pet_media 테이블에서 NOT NULL인데
// 여기서는 .optional().nullable()이라 zod는 통과시키고 그대로 DB까지 내려가
// `Column 'mime_type' cannot be null` 원본 mysql2 에러가 500으로 사용자에게
// 노출됐다(raw MySQL 에러 유출 - 서버 오류 메시지 원칙 위반이기도 하다).
// 두 값 다 POST /api/uploads/photo 응답(req.file.mimetype, req.file.size)에
// 항상 실려 있어 클라이언트가 못 보낼 이유가 없다(uploadRoutes.js 확인) -
// 프론트가 그동안 이 두 필드를 응답에서 꺼내 쓰지 않고 버리고 있었을 뿐이다
// (usePetDetail.js도 함께 수정, D6 지시의 "클라이언트가 실제로 보낼 수 있는지"
// 확인 결과). 그래서 (a) 서버가 기본값을 채우는 대신 (b) zod를 필수로 바꿔
// 프론트 누락을 400으로 막는 쪽을 택한다 - 기본값을 채우면 실제로 값이 있는데도
// 조용히 버려지는 프론트 버그를 영구히 가려버린다.
const addMediaSchema = z.object({
  params: z.object({
    petId: z.string().uuid('유효하지 않은 petId입니다'),
  }),
  body: z.object({
    mediaType: mediaTypeEnum,
    fileUrl: z.string().url('유효한 URL이어야 합니다'),
    s3Key: z.string().min(1, 'S3 키를 입력해주세요'),
    thumbnailS3Key: z.string().optional().nullable(),
    thumbnailUrl: z.string().url().optional().nullable(),
    mimeType: z.string().min(1, 'mimeType을 입력해주세요'),
    fileSize: z.number().int().positive('fileSize는 1 이상이어야 합니다'),
    width: z.number().int().positive().optional().nullable(),
    height: z.number().int().positive().optional().nullable(),
    durationSec: z.number().positive().optional().nullable(),
    takenAt: z.string().datetime({ offset: true }).optional().nullable(),
    sortOrder: z.number().int().min(0).optional().default(0),
    caption: z.string().max(500).optional().nullable(),
  }),
})

const mediaIdParam = z.object({
  params: z.object({
    petId: z.string().uuid('유효하지 않은 petId입니다'),
    mediaId: z.string().uuid('유효하지 않은 mediaId입니다'),
  }),
})

const getMediaSchema = z.object({
  params: z.object({
    petId: z.string().uuid('유효하지 않은 petId입니다'),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
})

/**
 * [DEV-33, 2026-08-22] AI 초상화 스타일 - `pet_media.portrait_style` DB 컬럼은
 * 존재하지 않는다(ondam_schema.sql 실측, docs/PRD.md 기획 문서에만 있던 항목).
 * 그래서 여기서는 실제 DB ENUM을 참조할 수 없고, 프론트에 이미 나가 있는
 * usePetPortrait.js의 STYLES 키(oil/watercolor/illustration)를 유일한 기존
 * 소스로 삼아 그대로 맞춘다. 이 프로젝트가 ENUM drift로 크게 고생한 이력이
 * 있어(2026-08-21 schema-drift-fix) 실제로 존재하지 않는 DB 컬럼값을 임의로
 * 만들어내지 않는다 - 컬럼이 생기기 전까지 이 값은 큐 페이로드로만 전달된다.
 */
const PORTRAIT_STYLES = ['oil', 'watercolor', 'illustration']

const requestPortraitSchema = z.object({
  params: z.object({
    petId: z.string().uuid('유효하지 않은 petId입니다'),
  }),
  body: z.object({
    style: z.enum(PORTRAIT_STYLES, {
      errorMap: () => ({ message: '스타일은 oil, watercolor, illustration 중 하나여야 합니다' }),
    }).optional().default('oil'),
    // 어떤 원본 사진으로 만들지 - 생략 시 서비스가 최신 사진으로 대체(하위 호환)
    mediaId: z.string().uuid('유효하지 않은 mediaId입니다').optional(),
  }).optional().default({}),
})

// ---------------------------------------------------------------------------
// 라우트
// ---------------------------------------------------------------------------

router.use(requireAuth)

router.post('/', validate(createPetSchema), petController.createPet)
router.get('/', validate(paginationQuery), petController.getPets)
router.get('/:petId', validate(petIdParam), petController.getPet)
router.get('/:petId/memorial-code', validate(petIdParam), petController.getMemorialAccessCode)
router.put('/:petId', validate(updatePetSchema), petController.updatePet)
router.patch('/:petId/status', validate(updateStatusSchema), petController.updatePetStatus)
router.delete('/:petId', validate(petIdParam), petController.deletePet)

router.get('/:petId/portrait/status', validate(petIdParam), petController.getPortraitStatus)
router.get('/:petId/portrait/quota', validate(petIdParam), petController.getPortraitQuota)
router.post('/:petId/portrait', aiLimiter, validate(requestPortraitSchema), petController.requestPortrait)

router.post('/:petId/media', validate(addMediaSchema), petController.addMedia)
router.get('/:petId/media', validate(getMediaSchema), petController.getMedia)
router.delete('/:petId/media/:mediaId', validate(mediaIdParam), petController.deleteMedia)

export default router
