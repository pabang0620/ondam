// ==========================================================================
// 온담(ondam) ENUM SSOT - 런타임(JS) 버전
// 백엔드는 빌드 스텝 없는 Node.js ESM이라 enums.ts(TypeScript)를 그대로
// import할 수 없다 (Node는 .ts를 네이티브로 로드하지 못함). 이 파일이
// 백엔드/프론트 런타임 코드가 실제로 import하는 SSOT다.
// enums.ts와 값이 100% 동일해야 한다 - 한쪽만 고치고 끝내지 말 것.
// (2026-08-21 DEV-22 drift 해소 작업에서 신설. 근거: docs/migrations/2026-08-21-schema-drift-fix.README.md)
//
// 사용 규칙:
//   - DB ENUM 값 변경 시 이 파일 + enums.ts + 마이그레이션 파일을 같은 PR에서 함께 수정
//   - Zod 스키마: z.enum(ENUM_CONSTANT) 형태로 import해서 참조, 문자열 배열 하드코딩 금지
// ==========================================================================

// --------------------------------------------------------------------------
// 회원/인증
// --------------------------------------------------------------------------

export const USER_ROLE = ['user', 'admin']

export const CONSENT_TYPE = [
  'privacy',
  'portrait',
  'voice',
  'ai_generation',
  'posthumous_release',
  'terms',
  'marketing',
]

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
]

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
]

export const PHOTO_FILE_KIND = ['raw', 'enhanced']

// --------------------------------------------------------------------------
// AI 유언장 (서비스 2)
// --------------------------------------------------------------------------

export const VOICE_CLONE_STATUS = ['pending', 'processing', 'ready', 'failed']

export const WILL_STATUS = ['draft', 'paid', 'active', 'released', 'revoked']

export const WILL_RELEASE_POLICY = [
  'manual_admin',
  'inactivity_family_vote',
  'immediate',
]

export const WILL_RELEASE_STATUS = ['locked', 'pending_review', 'released']

export const WILL_RELEASE_REQ_STATUS = ['pending', 'approved', 'rejected']

// wills.event_type - enums.ts에 누락되어 있던 것을 이번 작업에서 함께 보완
// (DB: wills.event_type ENUM('death','incapacity','anniversary') NULL)
export const WILL_EVENT_TYPE = ['death', 'incapacity', 'anniversary']

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
]

export const PET_STATUS = ['alive', 'deceased', 'unknown']

export const PET_MEDIA_TYPE = ['photo', 'video']

// --------------------------------------------------------------------------
// 결제/구독
// --------------------------------------------------------------------------

export const PAYMENT_TARGET_TYPE = ['photo_order', 'will_order', 'subscription']

export const PAYMENT_STATUS = ['ready', 'done', 'canceled', 'failed']

export const SUBSCRIPTION_PLAN = ['pet_archive', 'will_premium', 'all']

export const SUBSCRIPTION_STATUS = ['active', 'past_due', 'suspended', 'canceled']

// --------------------------------------------------------------------------
// AI 작업 큐
// --------------------------------------------------------------------------

export const AI_JOB_TYPE = [
  'photo_enhance',
  'voice_clone',
  'video_generate',
  'avatar_stream',
]

export const AI_JOB_STATUS = ['queued', 'running', 'completed', 'failed']

export const AI_JOB_TARGET_TYPE = [
  'photo_order',
  'voice_sample',
  'will',
  'avatar_session',
  'pet',
]

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
  'subscription_renewed',
  'subscription_canceled',
  'pet_memorial_shared',
  'admin_notice',
]

export const NOTIFICATION_TARGET_TYPE = [
  'photo_order',
  'will',
  'will_release_request',
  'payment',
  'subscription',
  'pet',
  'avatar_session',
]

// --------------------------------------------------------------------------
// 공통
// --------------------------------------------------------------------------

export const CHANGED_BY_TYPE = ['user', 'admin', 'system']

export const ADMIN_ROLE = ['super', 'manager', 'reviewer']

export const ACTOR_TYPE = ['user', 'admin', 'system']
