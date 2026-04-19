// ==========================================================================
// 온담(ondam) ENUM SSOT
// DB 스키마(ondam_schema.sql)와 반드시 동기화 유지
// Created: 2026-04-19
//
// 사용 규칙:
//   - DB ENUM 값 변경 시 이 파일을 먼저 수정 → 마이그레이션 파일 생성
//   - Zod 스키마: z.enum(ENUM_CONSTANT) 형태로 import해서 참조
//   - 이 파일에 하드코딩된 문자열을 Zod 내부에서 중복 선언 금지
// ==========================================================================

// --------------------------------------------------------------------------
// 회원/인증
// --------------------------------------------------------------------------

export const USER_ROLE = ['user', 'admin'] as const
export type UserRole = typeof USER_ROLE[number]

export const CONSENT_TYPE = [
  'privacy',
  'portrait',
  'voice',
  'ai_generation',
  'posthumous_release',
] as const
export type ConsentType = typeof CONSENT_TYPE[number]

// --------------------------------------------------------------------------
// AI 사진관 (서비스 1)
// --------------------------------------------------------------------------

export const PHOTO_ORDER_STATUS = [
  'pending_payment',
  'paid',
  'processing',
  'completed',
  'failed',
  'refunded',
] as const
export type PhotoOrderStatus = typeof PHOTO_ORDER_STATUS[number]

export const PHOTO_TYPE = ['funeral', 'id', 'job'] as const
export type PhotoType = typeof PHOTO_TYPE[number]

export const PHOTO_FILE_KIND = ['raw', 'enhanced'] as const
export type PhotoFileKind = typeof PHOTO_FILE_KIND[number]

// --------------------------------------------------------------------------
// AI 유언장 (서비스 2)
// --------------------------------------------------------------------------

export const VOICE_CLONE_STATUS = [
  'pending',
  'processing',
  'ready',
  'failed',
] as const
export type VoiceCloneStatus = typeof VOICE_CLONE_STATUS[number]

export const WILL_STATUS = ['draft', 'active', 'released', 'revoked'] as const
export type WillStatus = typeof WILL_STATUS[number]

export const WILL_RELEASE_POLICY = [
  'manual_admin',
  'inactivity_family_vote',
  'immediate',
] as const
export type WillReleasePolicy = typeof WILL_RELEASE_POLICY[number]

export const WILL_RELEASE_STATUS = [
  'locked',
  'pending_review',
  'released',
] as const
export type WillReleaseStatus = typeof WILL_RELEASE_STATUS[number]

export const WILL_RELEASE_REQ_STATUS = [
  'pending',
  'approved',
  'rejected',
] as const
export type WillReleaseReqStatus = typeof WILL_RELEASE_REQ_STATUS[number]

// --------------------------------------------------------------------------
// 반려동물 아카이브 (서비스 3)
// --------------------------------------------------------------------------

export const PET_SPECIES = [
  'dog',
  'cat',
  'rabbit',
  'bird',
  'hamster',
  'fish',
  'reptile',
  'other',
] as const
export type PetSpecies = typeof PET_SPECIES[number]

export const PET_STATUS = ['alive', 'deceased', 'unknown'] as const
export type PetStatus = typeof PET_STATUS[number]

export const PET_MEDIA_TYPE = ['photo', 'video'] as const
export type PetMediaType = typeof PET_MEDIA_TYPE[number]

// --------------------------------------------------------------------------
// 결제/구독
// --------------------------------------------------------------------------

export const PAYMENT_TARGET_TYPE = [
  'photo_order',
  'will_order',
  'subscription',
] as const
export type PaymentTargetType = typeof PAYMENT_TARGET_TYPE[number]

export const PAYMENT_STATUS = ['ready', 'done', 'canceled', 'failed'] as const
export type PaymentStatus = typeof PAYMENT_STATUS[number]

export const SUBSCRIPTION_PLAN = [
  'pet_archive',
  'will_premium',
  'all',
] as const
export type SubscriptionPlan = typeof SUBSCRIPTION_PLAN[number]

export const SUBSCRIPTION_STATUS = [
  'active',
  'past_due',
  'canceled',
] as const
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[number]

// --------------------------------------------------------------------------
// AI 작업 큐
// --------------------------------------------------------------------------

export const AI_JOB_TYPE = [
  'photo_enhance',
  'voice_clone',
  'video_generate',
  'avatar_stream',
] as const
export type AiJobType = typeof AI_JOB_TYPE[number]

export const AI_JOB_STATUS = [
  'queued',
  'running',
  'completed',
  'failed',
] as const
export type AiJobStatus = typeof AI_JOB_STATUS[number]

export const AI_JOB_TARGET_TYPE = [
  'photo_order',
  'voice_sample',
  'will',
  'avatar_session',
] as const
export type AiJobTargetType = typeof AI_JOB_TARGET_TYPE[number]

// --------------------------------------------------------------------------
// 알림
// --------------------------------------------------------------------------

export const NOTIFICATION_TYPE = [
  'photo_complete',
  'will_release_request',
  'will_released',
  'payment_done',
  'payment_failed',
  'subscription_renewed',
  'subscription_canceled',
  'pet_memorial_shared',
  'admin_notice',
] as const
export type NotificationType = typeof NOTIFICATION_TYPE[number]

export const NOTIFICATION_TARGET_TYPE = [
  'photo_order',
  'will',
  'will_release_request',
  'payment',
  'subscription',
  'pet',
  'avatar_session',
] as const
export type NotificationTargetType = typeof NOTIFICATION_TARGET_TYPE[number]

// --------------------------------------------------------------------------
// 공통
// --------------------------------------------------------------------------

export const CHANGED_BY_TYPE = ['user', 'admin', 'system'] as const
export type ChangedByType = typeof CHANGED_BY_TYPE[number]

export const ADMIN_ROLE = ['super', 'manager', 'reviewer'] as const
export type AdminRole = typeof ADMIN_ROLE[number]

export const ACTOR_TYPE = ['user', 'admin', 'system'] as const
export type ActorType = typeof ACTOR_TYPE[number]
