/**
 * Pet Controller - 요청 파싱 + 응답 전담
 */

import * as petService from './petService.js'
import { created, success, paginated } from '../../utils/response.js'

// ---------------------------------------------------------------------------
// 펫
// ---------------------------------------------------------------------------

/**
 * POST /api/pet
 */
export const createPet = async (req, res, next) => {
  try {
    const { name, species, breed, birthDate, deathDate } = req.body
    const pet = await petService.createPet(req.user.userId, {
      name,
      species,
      breed,
      birthDate,
      deathDate,
    })
    return created(res, pet, '반려동물이 등록되었습니다')
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/pet
 */
export const getPets = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const { pets, meta } = await petService.getPets(req.user.userId, { page, limit })
    return paginated(res, pets, meta, '반려동물 목록')
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/pet/:petId
 */
export const getPet = async (req, res, next) => {
  try {
    const pet = await petService.getPetDetail(req.user.userId, req.params.petId)
    return success(res, pet)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/pet/:petId/memorial-code
 * [FIX D17] 추모관 접근 코드 전용 조회 - 일반 펫 CRUD 응답에서는 더 이상 내려주지
 * 않고, 소유자가 코드를 다시 확인하고 싶을 때 이 경로로만 조회한다.
 */
export const getMemorialAccessCode = async (req, res, next) => {
  try {
    const result = await petService.getMemorialAccessCode(req.user.userId, req.params.petId)
    return success(res, result)
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/pet/:petId
 */
export const updatePet = async (req, res, next) => {
  try {
    const {
      name, breed, birthDate, deathDate, profileImageUrl,
      memorialSlug, memorialAccessCode, isPublic,
    } = req.body
    const pet = await petService.updatePet(req.user.userId, req.params.petId, {
      name,
      breed,
      birthDate,
      deathDate,
      profileImageUrl,
      memorialSlug,
      memorialAccessCode,
      isPublic,
    })
    return success(res, pet, '반려동물 정보가 수정되었습니다')
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/pet/:petId/status
 */
export const updatePetStatus = async (req, res, next) => {
  try {
    const { nextStatus, reason } = req.body
    const pet = await petService.updatePetStatus(req.user.userId, req.params.petId, {
      nextStatus,
      reason,
    })
    return success(res, pet, '반려동물 상태가 변경되었습니다')
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/pet/:petId
 */
export const deletePet = async (req, res, next) => {
  try {
    await petService.deletePet(req.user.userId, req.params.petId)
    return success(res, null, '반려동물이 삭제되었습니다')
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// AI 초상화
// ---------------------------------------------------------------------------

/**
 * GET /api/pet/:petId/portrait/status
 */
export const getPortraitStatus = async (req, res, next) => {
  try {
    const { petId } = req.params
    const { userId } = req.user
    const result = await petService.getPortraitStatus(petId, userId)
    return success(res, result)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/pet/:petId/portrait/quota
 * 남은 AI 초상화 매수 조회 (구독자 월 3매 / 무료 티어 평생 1회 체험)
 */
export const getPortraitQuota = async (req, res, next) => {
  try {
    const quota = await petService.getPortraitQuota(req.user.userId)
    return success(res, quota)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/pet/:petId/portrait
 */
export const requestPortrait = async (req, res, next) => {
  try {
    const { style, mediaId } = req.body
    const result = await petService.requestPortrait(req.user.userId, req.params.petId, { style, mediaId })
    return success(res, result, 'AI 초상화 생성을 시작합니다')
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// 미디어
// ---------------------------------------------------------------------------

/**
 * POST /api/pet/:petId/media
 */
export const addMedia = async (req, res, next) => {
  try {
    const {
      mediaType,
      fileUrl,
      s3Key,
      thumbnailS3Key,
      thumbnailUrl,
      mimeType,
      fileSize,
      width,
      height,
      durationSec,
      takenAt,
      sortOrder,
      caption,
    } = req.body
    const media = await petService.addMedia(req.user.userId, req.params.petId, {
      mediaType,
      fileUrl,
      s3Key,
      thumbnailS3Key,
      thumbnailUrl,
      mimeType,
      fileSize,
      width,
      height,
      durationSec,
      takenAt,
      sortOrder,
      caption,
    })
    return created(res, media, '미디어가 추가되었습니다')
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/pet/:petId/media
 */
export const getMedia = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const { media, meta } = await petService.getMedia(req.user.userId, req.params.petId, {
      page,
      limit,
    })
    return paginated(res, media, meta, '미디어 목록')
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/pet/:petId/media/:mediaId
 */
export const deleteMedia = async (req, res, next) => {
  try {
    await petService.deleteMedia(req.user.userId, req.params.mediaId)
    return success(res, null, '미디어가 삭제되었습니다')
  } catch (err) {
    next(err)
  }
}
