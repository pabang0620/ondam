// ==========================================================================
// 온담(ondam) ENUM SSOT (타입 전용)
// DB 스키마(ondam_schema.sql)와 반드시 동기화 유지
// Created: 2026-04-19
// Last synced with DB: 2026-08-22 (migrations a/b/c integrated into ondam_schema.sql +
// gift domain, audit_logs anonymous actor, notification_type expansion - see
// docs/migrations/ READMEs and ondam_schema.sql migration history log at file end)
//
// 주의(2026-08-21 DEV-22): 백엔드는 빌드 스텝 없는 Node.js ESM이라 이 .ts 파일을
// 런타임에 import할 수 없다. 런타임 SSOT는 같은 디렉토리의 enums.js다.
// 이 파일은 타입 정의·프론트(TS/번들러 환경)용으로 유지한다.
// 값을 바꿀 때는 반드시 enums.js도 함께 수정해 100% 동일하게 유지할 것.
//
// 사용 규칙:
//   - DB ENUM 값 변경 시 이 파일 + enums.js를 함께 수정 → 마이그레이션 파일 생성
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
  'terms',
  'marketing',
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

export const PHOTO_TYPE = [
  'funeral',
  'id',
  'job',
  'enhance',
  'colorize',
  'restore',
  'removebg',
  'portrait',
  'casual',
] as const
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

export const WILL_STATUS = ['draft', 'paid', 'active', 'released', 'revoked'] as const
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

// wills.event_type - 기존에 이 파일에서 누락되어 있던 것을 DEV-22에서 보완
// (DB: wills.event_type ENUM('death','incapacity','anniversary') NULL)
export const WILL_EVENT_TYPE = ['death', 'incapacity', 'anniversary'] as const
export type WillEventType = typeof WILL_EVENT_TYPE[number]

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
  'gift_order',
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
  'suspended',
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
  'pet',
] as const
export type AiJobTargetType = typeof AI_JOB_TARGET_TYPE[number]

// --------------------------------------------------------------------------
// 선물하기 (SPEC-01) - 자녀 결제 → 부모(무계정) 수행
// --------------------------------------------------------------------------

export const GIFT_PRODUCT_TYPE = ['photo', 'will'] as const
export type GiftProductType = typeof GIFT_PRODUCT_TYPE[number]

export const GIFT_STATUS = [
  'paid',
  'link_sent',
  'opened',
  'in_progress',
  'completed',
  'declined',
  'refunded',
  'expired',
] as const
export type GiftStatus = typeof GIFT_STATUS[number]

// --------------------------------------------------------------------------
// 알림
// --------------------------------------------------------------------------

export const NOTIFICATION_TYPE = [
  'photo_complete',
  'voice_clone_complete',
  'will_video_ready',
  'will_release_request',
  'will_released',
  'payment_done',
  'payment_failed',
  'payment_pending',
  'subscription_renewed',
  'subscription_canceled',
  'pet_memorial_shared',
  'admin_notice',
  'gift_link_sent',
  'gift_completed',
  'gift_declined',
  'ai_processing_refunded',
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
  'gift_order',
] as const
export type NotificationTargetType = typeof NOTIFICATION_TARGET_TYPE[number]

// --------------------------------------------------------------------------
// 공통
// --------------------------------------------------------------------------

export const CHANGED_BY_TYPE = ['user', 'admin', 'system'] as const
export type ChangedByType = typeof CHANGED_BY_TYPE[number]

export const ADMIN_ROLE = ['super', 'manager', 'reviewer'] as const
export type AdminRole = typeof ADMIN_ROLE[number]

// audit_logs 전용 - 'anonymous'는 인증 전 행위(로그인 실패 등), actor_id NULL과 짝을 이룸
export const ACTOR_TYPE = ['user', 'admin', 'system', 'anonymous'] as const
export type ActorType = typeof ACTOR_TYPE[number]
