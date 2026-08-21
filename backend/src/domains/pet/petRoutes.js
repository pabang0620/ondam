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
    mimeType: z.string().optional().nullable(),
    fileSize: z.number().int().positive().optional().nullable(),
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

// ---------------------------------------------------------------------------
// 라우트
// ---------------------------------------------------------------------------

router.use(requireAuth)

router.post('/', validate(createPetSchema), petController.createPet)
router.get('/', validate(paginationQuery), petController.getPets)
router.get('/:petId', validate(petIdParam), petController.getPet)
router.put('/:petId', validate(updatePetSchema), petController.updatePet)
router.patch('/:petId/status', validate(updateStatusSchema), petController.updatePetStatus)
router.delete('/:petId', validate(petIdParam), petController.deletePet)

router.get('/:petId/portrait/status', validate(petIdParam), petController.getPortraitStatus)
router.post('/:petId/portrait', aiLimiter, validate(petIdParam), petController.requestPortrait)

router.post('/:petId/media', validate(addMediaSchema), petController.addMedia)
router.get('/:petId/media', validate(getMediaSchema), petController.getMedia)
router.delete('/:petId/media/:mediaId', validate(mediaIdParam), petController.deleteMedia)

export default router
