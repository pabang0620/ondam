/**
 * Pet Service - 비즈니스 로직 전용
 */

import { v4 as uuidv4 } from 'uuid'
import * as petRepository from './petRepository.js'
import { photoQueue } from '../../jobs/queue.js'
import pool from '../../config/db.js'
import { AI_JOB_TARGET_TYPE } from '../../../../shared/constants/enums.js'
// 구독 상태 확인용 - payment 도메인(paymentService.js)과 동일하게 다른 도메인의
// repository를 서비스 레이어에서 읽기 전용으로 참조하는 기존 패턴을 따른다.
// subscriptionRepository.js 자체는 수정하지 않는다(다른 에이전트 작업 범위).
import * as subscriptionRepository from '../subscription/subscriptionRepository.js'

// AI_JOB_TARGET_TYPE 배열에서 조회 - 오타 시 undefined가 되어 INSERT가 즉시
// 실패하므로(NOT NULL) 리터럴 오타가 조용히 DB에 들어가는 것을 방지한다
const TARGET_TYPE_PET = AI_JOB_TARGET_TYPE.find((t) => t === 'pet')

/**
 * [DEV-32, 2026-08-22 오너 확정] AI 초상화 매수 한도
 * - 구독자(pet_archive, active/past_due): 월 3매. 원가(매당 200~600원)가 매달
 *   최대 1,800원으로 통제되어 4,900원 대비 마진 63%+ 확보 (docs/strategy/
 *   09-unit-economics.md). 무제한은 원가 통제 불가.
 * - 비구독자(무료 티어): 평생 1회 체험. 펫 획득 채널이 장묘업체 제휴 쿠폰이라
 *   첫 경험의 감동이 구독 전환을 만든다는 유입 효과를 기대하되, "평생 1회"로
 *   한정해 원가 누수를 계정당 1건으로 상한선을 둔다(무제한 반복 남용 방지).
 */
const MONTHLY_PORTRAIT_LIMIT_SUBSCRIBED = 3
const LIFETIME_PORTRAIT_LIMIT_FREE = 1

/**
 * 다음 달 1일 00:00(KST) - 구독자 초상화 한도 초기화 시점.
 * TZ=Asia/Seoul가 서버 전역에 고정돼 있으므로(server.js) Date 로컬 메서드가
 * 곧 KST 기준이다.
 */
const nextMonthStartKST = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0)
}

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
 * AI 초상화 매수 한도 조회 (구독 여부에 따라 월 3매 또는 평생 1회 체험)
 * petController.getPortraitQuota / requestPortrait 양쪽에서 공유한다.
 */
export const getPortraitQuota = async (userId) => {
  const subscriptions = await subscriptionRepository.findSubscriptionsByUserId(userId)
  const isSubscribed = subscriptions.some(
    (s) => s.plan === 'pet_archive' && (s.sub_status === 'active' || s.sub_status === 'past_due')
  )

  if (isSubscribed) {
    const used = await petRepository.countMonthlyPortraitJobs(userId)
    return {
      isSubscribed: true,
      limit: MONTHLY_PORTRAIT_LIMIT_SUBSCRIBED,
      used,
      remaining: Math.max(0, MONTHLY_PORTRAIT_LIMIT_SUBSCRIBED - used),
      resetsAt: nextMonthStartKST(),
    }
  }

  const used = await petRepository.countAllTimePortraitJobs(userId)
  return {
    isSubscribed: false,
    limit: LIFETIME_PORTRAIT_LIMIT_FREE,
    used,
    remaining: Math.max(0, LIFETIME_PORTRAIT_LIMIT_FREE - used),
    resetsAt: null,
  }
}

/**
 * AI 초상화 요청 (소유자 확인)
 * 1. 펫 소유권 확인
 * 2. 원본 사진 조회 - mediaId 지정 시 해당 사진(소유권/타입 검증), 없으면 최신 photo(하위 호환)
 * 3. 매수 한도 확인 (구독자 월 3매 / 무료 티어 평생 1회) - 초과 시 429
 * 4. ai_jobs 레코드 생성 (큐 등록보다 먼저 - G6-3, 고아 잡 방지)
 * 5. photoQueue에 portrait 작업 추가 (ai_jobs와 동일한 jobId를 BullMQ job id로 고정해
 *    photoWorker의 bullmq_job_id 기반 UPDATE가 정확히 매칭되도록 함). style을 payload에
 *    함께 실어 워커가 읽을 수 있게 한다 - 단, photoWorker.js(다른 에이전트 작업 영역)의
 *    processPetPortrait는 아직 이 필드를 소비하지 않아 실제 생성 결과에는 반영되지
 *    않는다(완료 보고 참조, 워커 반영 필요).
 *
 * [DEV-33] pet_media.portrait_style 컬럼은 DB에 존재하지 않는다(ondam_schema.sql
 * 실측 - docs/PRD.md 기획 문서에만 있던 항목). 존재하지 않는 컬럼에 UPDATE/INSERT를
 * 시도하면 매 요청이 SQL 에러로 즉시 실패하므로, 스키마가 추가되기 전까지는 결과를
 * pet_media에 기록하지 않는다(기존과 동일 - photoWorker.processPetPortrait도 원래
 * pet_media를 건드리지 않고 ai_jobs.result_url에만 기록한다).
 */
export const requestPortrait = async (userId, petId, { style = 'oil', mediaId } = {}) => {
  // 소유권 확인
  await getPet(userId, petId)

  // 원본 사진 조회 - 사용자가 특정 사진을 선택했으면 그 사진을, 아니면 최신 사진을 사용
  let photo
  if (mediaId) {
    const media = await petRepository.findMediaById(mediaId)
    if (!media || media.pet_id !== petId || media.media_type !== 'photo') {
      throw Object.assign(new Error('선택한 사진을 찾을 수 없습니다'), { status: 400 })
    }
    photo = media
  } else {
    photo = await petRepository.findLatestPhoto(petId)
  }
  if (!photo) {
    throw Object.assign(new Error('AI 초상화 생성에 필요한 사진이 없습니다. 먼저 사진을 등록해주세요'), { status: 400 })
  }

  // 매수 한도 확인 - 동시 요청 경합 시 소량 초과가 가능하지만(레이스), 결제
  // 원가에 미치는 영향이 매당 200~600원 수준이라 락 없는 단순 카운트 체크로도
  // 충분하다고 판단했다(20회/시간 aiLimiter가 스팸성 대량 요청은 이미 막는다).
  const quota = await getPortraitQuota(userId)
  if (quota.remaining <= 0) {
    const message = quota.isSubscribed
      ? `이번 달 AI 초상화 생성 횟수(${quota.limit}장)를 모두 사용하셨습니다. 다음 달 1일에 초기화됩니다.`
      : '무료 체험 AI 초상화를 이미 사용하셨습니다. 반려동물 아카이브 구독(월 4,900원)을 시작하면 매달 3장의 AI 초상화를 만들 수 있어요.'
    throw Object.assign(new Error(message), { status: 429 })
  }

  const jobId = uuidv4()

  // ai_jobs 레코드 생성 - 큐 등록보다 먼저 성공시켜 DB 없는 고아 잡을 방지
  await pool.execute(
    `INSERT INTO ai_jobs
       (job_id, user_id, job_type, job_status, target_type, target_id, bullmq_job_id, queue_name, progress, created_at, updated_at)
     VALUES (?, ?, 'photo_enhance', 'queued', ?, ?, ?, 'photo', 0, NOW(), NOW())`,
    [jobId, userId, TARGET_TYPE_PET, petId, jobId]
  )

  // BullMQ 큐에 작업 추가 - photoWorker가 기대하는 필드 계약(petId/userId/photoUrl)에
  // style을 추가했다. jobId를 BullMQ job id로 고정
  await photoQueue.add('portrait', {
    petId,
    userId,
    photoUrl: photo.file_url,
    style,
  }, { jobId })

  return { jobId, status: 'queued', style }
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
