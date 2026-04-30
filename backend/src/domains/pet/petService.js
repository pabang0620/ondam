/**
 * Pet Service - 비즈니스 로직 전용
 */

import { v4 as uuidv4 } from 'uuid'
import * as petRepository from './petRepository.js'
import { photoQueue } from '../../jobs/queue.js'
import pool from '../../config/db.js'

// ---------------------------------------------------------------------------
// 펫
// ---------------------------------------------------------------------------

/**
 * 펫 생성
 */
export const createPet = async (userId, { name, species, breed, birthDate, deathDate }) => {
  const petId = uuidv4()
  return petRepository.createPet({
    petId,
    userId,
    name,
    species,
    breed,
    birthDate,
    deathDate,
    petStatus: 'alive',
  })
}

/**
 * 펫 목록 조회 (소유자 전용)
 */
export const getPets = async (userId, { page, limit }) => {
  const offset = (page - 1) * limit
  const { pets, total } = await petRepository.findPetsByUserId(userId, { limit, offset })
  return {
    pets,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

/**
 * 단일 펫 조회 (소유자 확인)
 */
export const getPet = async (userId, petId) => {
  const pet = await petRepository.findPetById(petId)
  if (!pet) {
    throw Object.assign(new Error('반려동물을 찾을 수 없습니다'), { status: 404 })
  }
  if (pet.user_id !== userId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  return pet
}

/**
 * 펫 정보 수정 (소유자 확인)
 * memorial_slug 변경 시 중복 확인 포함
 */
export const updatePet = async (userId, petId, updates) => {
  const pet = await getPet(userId, petId)

  if (updates.memorialSlug && updates.memorialSlug !== pet.memorial_slug) {
    const existing = await petRepository.findPetBySlug(updates.memorialSlug)
    if (existing) {
      throw Object.assign(new Error('이미 사용 중인 추모 슬러그입니다'), { status: 409 })
    }
  }

  return petRepository.updatePet(petId, updates)
}

/**
 * 펫 상태 변경 (소유자 확인)
 */
export const updatePetStatus = async (userId, petId, { nextStatus, reason }) => {
  const pet = await getPet(userId, petId)

  return petRepository.updatePetStatus(petId, {
    prevStatus: pet.pet_status,
    nextStatus,
    changedBy: userId,
    changedByType: 'user',
    reason,
  })
}

/**
 * 펫 삭제 (소유자 확인)
 */
export const deletePet = async (userId, petId) => {
  await getPet(userId, petId)
  await petRepository.softDeletePet(petId)
}

// ---------------------------------------------------------------------------
// 미디어
// ---------------------------------------------------------------------------

/**
 * 미디어 추가 (소유자 확인)
 */
export const addMedia = async (userId, petId, {
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
}) => {
  await getPet(userId, petId)

  const mediaId = uuidv4()
  return petRepository.createMedia({
    mediaId,
    petId,
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
}

/**
 * 미디어 목록 조회 (소유자 확인)
 */
export const getMedia = async (userId, petId, { page, limit }) => {
  await getPet(userId, petId)

  const offset = (page - 1) * limit
  const { media, total } = await petRepository.findMediaByPetId(petId, { limit, offset })
  return {
    media,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

/**
 * AI 초상화 요청 (소유자 확인)
 * 1. 펫 소유권 확인
 * 2. 대표 사진(최신 photo) 조회
 * 3. photoQueue에 portrait 작업 추가
 * 4. ai_jobs 레코드 생성
 */
export const requestPortrait = async (userId, petId) => {
  // 소유권 확인
  await getPet(userId, petId)

  // 대표 사진 조회
  const photo = await petRepository.findLatestPhoto(petId)
  if (!photo) {
    throw Object.assign(new Error('AI 초상화 생성에 필요한 사진이 없습니다. 먼저 사진을 등록해주세요'), { status: 400 })
  }

  const jobId = uuidv4()

  // BullMQ 큐에 작업 추가
  const bullJob = await photoQueue.add('portrait', {
    type: 'portrait',
    petId,
    userId,
    photoUrl: photo.file_url,
  })

  // ai_jobs 레코드 생성
  await pool.execute(
    `INSERT INTO ai_jobs
       (job_id, user_id, job_type, job_status, target_type, target_id, bullmq_job_id, queue_name, progress, created_at, updated_at)
     VALUES (?, ?, 'photo_enhance', 'queued', 'pet', ?, ?, 'photo', 0, NOW(), NOW())`,
    [jobId, userId, petId, String(bullJob.id)]
  )

  return { jobId, status: 'queued' }
}

/**
 * AI 초상화 상태 조회 (소유자 확인)
 */
export const getPortraitStatus = async (petId, userId) => {
  const pet = await petRepository.findPetById(petId)
  if (!pet || pet.user_id !== userId) {
    throw Object.assign(new Error('반려동물을 찾을 수 없습니다'), { status: 404 })
  }
  const job = await petRepository.findLatestAiJob(petId)
  if (!job) return { status: 'none' }

  const result = { status: job.job_status, progress: job.progress }

  if (job.job_status === 'completed' && job.result_url) {
    result.portraitUrl = job.result_url
  }

  return result
}

/**
 * 미디어 삭제 (소유자 확인)
 * media → pet → user 소유권 확인
 */
export const deleteMedia = async (userId, mediaId) => {
  const media = await petRepository.findMediaById(mediaId)
  if (!media) {
    throw Object.assign(new Error('미디어를 찾을 수 없습니다'), { status: 404 })
  }

  // 펫 소유권 확인
  await getPet(userId, media.pet_id)

  await petRepository.softDeleteMedia(mediaId)
}
