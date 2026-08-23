-- ==========================================================================
-- 온담(ondam) DB 스키마
-- AI 기억사진관 플랫폼
-- Created: 2026-04-19
-- ==========================================================================
-- ENUM SSOT: shared/constants/enums.js / enums.ts 와 동기화 필수 (두 파일 값 100% 동일)
-- DB 연결 초기화 시 반드시 실행:
--   SET time_zone = '+09:00';
-- ==========================================================================

SET NAMES utf8mb4;
SET time_zone = '+09:00';

CREATE DATABASE IF NOT EXISTS ondam
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ondam;

-- ==========================================================================
-- ENUM 목록 (shared/constants/enums.js / enums.ts 동기화 대상 - 두 파일 값 100% 동일)
--
-- USER_ROLE                          : 'user', 'admin'
-- CONSENT_TYPE                       : 'privacy', 'portrait', 'voice', 'ai_generation', 'posthumous_release',
--                                      'terms', 'marketing'
-- PHOTO_ORDER_STATUS                 : 'pending_payment', 'paid', 'processing', 'completed', 'failed', 'refunded'
-- PHOTO_TYPE                         : 'funeral', 'id', 'job', 'enhance', 'colorize', 'restore', 'removebg',
--                                      'portrait', 'casual'
-- PHOTO_FILE_KIND                    : 'raw', 'enhanced'
-- WILL_RELEASE_POLICY                : 'manual_admin', 'inactivity_family_vote', 'immediate'
-- WILL_RELEASE_STATUS                : 'locked', 'pending_review', 'released'
-- WILL_STATUS                        : 'draft', 'paid', 'active', 'released', 'revoked'
-- WILL_EVENT_TYPE                    : 'death', 'incapacity', 'anniversary'
-- PET_SPECIES                        : 'dog', 'cat', 'rabbit', 'bird', 'hamster', 'fish', 'reptile', 'other'
-- PET_MEDIA_TYPE                     : 'photo', 'video'
-- PET_STATUS                         : 'alive', 'deceased', 'unknown'
-- PAYMENT_TARGET_TYPE                : 'photo_order', 'will_order', 'subscription', 'gift_order'
-- PAYMENT_STATUS                     : 'ready', 'done', 'canceled', 'failed'
-- SUBSCRIPTION_PLAN                  : 'pet_archive', 'will_premium', 'all'
-- SUBSCRIPTION_STATUS                : 'active', 'past_due', 'suspended', 'canceled'
-- SUBSCRIPTION_PAYMENT_LOG_STATUS    : 'pending', 'success', 'failed', 'retry_scheduled', 'abandoned'
-- SUBSCRIPTION_PAYMENT_FAIL_CATEGORY : 'card_expired', 'insufficient_funds', 'card_blocked', 'network_error', 'unknown'
-- AI_JOB_TYPE                        : 'photo_enhance', 'voice_clone', 'video_generate', 'avatar_stream'
-- AI_JOB_STATUS                      : 'queued', 'running', 'completed', 'failed'
-- AI_JOB_TARGET_TYPE                 : 'photo_order', 'voice_sample', 'will', 'avatar_session', 'pet'
-- NOTIFICATION_TYPE                  : 'photo_complete', 'voice_clone_complete', 'will_video_ready',
--                                      'will_release_request', 'will_released',
--                                      'payment_done', 'payment_failed', 'payment_pending',
--                                      'subscription_renewed', 'subscription_canceled',
--                                      'pet_memorial_shared', 'admin_notice',
--                                      'gift_link_sent', 'gift_completed', 'gift_declined',
--                                      'ai_processing_refunded'
-- NOTIFICATION_TARGET_TYPE           : 'photo_order', 'will', 'will_release_request', 'payment',
--                                      'subscription', 'pet', 'avatar_session', 'gift_order'
-- WILL_RELEASE_REQ_STATUS            : 'pending', 'approved', 'rejected'
-- CHANGED_BY_TYPE                    : 'user', 'admin', 'system'
-- ACTOR_TYPE                         : 'user', 'admin', 'system', 'anonymous' (audit_logs 전용 - 인증 전 행위 포함)
-- ADMIN_ROLE                         : 'super', 'manager', 'reviewer'
-- GIFT_PRODUCT_TYPE                  : 'photo', 'will' (SPEC-01)
-- GIFT_STATUS                        : 'paid', 'link_sent', 'opened', 'in_progress', 'completed',
--                                      'declined', 'refunded', 'expired' (SPEC-01)
-- ==========================================================================


-- ==========================================================================
-- 회원/인증 도메인
-- ==========================================================================

CREATE TABLE IF NOT EXISTS users (
  id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id              CHAR(36) NOT NULL UNIQUE COMMENT 'UUID - 외부 노출용',

  -- 기본 정보
  email                VARCHAR(320) NOT NULL UNIQUE,
  phone                VARCHAR(20) NULL,
  nickname             VARCHAR(50) NOT NULL,
  profile_image_url    VARCHAR(500) NULL,
  role                 ENUM('user','admin') NOT NULL DEFAULT 'user',

  -- 인증
  password_hash        VARCHAR(255) NULL COMMENT 'social 전용 계정은 NULL 가능',
  kakao_id             BIGINT UNSIGNED UNIQUE NULL COMMENT '카카오 소셜 로그인 ID',
  email_verified_at    DATETIME NULL,
  phone_verified_at    DATETIME NULL,

  -- 잠금/비활성
  is_active            TINYINT(1) NOT NULL DEFAULT 1,
  deactivated_at       DATETIME NULL,

  -- 타임스탬프 + 소프트삭제
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at           DATETIME NULL,

  INDEX idx_users_email         (email),
  INDEX idx_users_phone         (phone),
  INDEX idx_users_role_deleted  (role, deleted_at),
  INDEX idx_users_created       (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='통합 회원 테이블';


-- 동의 이력 (append-only: 철회도 새 row로 기록)
-- updated_at 의도적 제외 - 동의 이력은 불변 레코드
CREATE TABLE IF NOT EXISTS user_consents (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  consent_id   CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  user_id      CHAR(36) NOT NULL COMMENT 'users.user_id 참조',
  consent_type ENUM('privacy','portrait','voice','ai_generation','posthumous_release','terms','marketing') NOT NULL,
  is_agreed    TINYINT(1) NOT NULL COMMENT '1=동의, 0=철회',
  agreed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address   VARCHAR(45) NULL COMMENT 'IPv4/IPv6',
  user_agent   VARCHAR(500) NULL,

  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_consents_user_type (user_id, consent_type),
  INDEX idx_consents_user        (user_id, consent_type, agreed_at DESC),
  INDEX idx_consents_type        (consent_type, is_agreed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='사용자 동의 현황 (user_id + consent_type 당 최신 1건 유지 - ON DUPLICATE KEY UPDATE)';


-- 이메일 인증 토큰 (만료·소멸 후 삭제 대상)
CREATE TABLE IF NOT EXISTS email_verifications (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     CHAR(36) NOT NULL COMMENT 'users.user_id 참조',
  token       CHAR(64) NOT NULL UNIQUE,
  expires_at  DATETIME NOT NULL,
  verified_at DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_email_verif_user    (user_id),
  INDEX idx_email_verif_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='이메일 인증 토큰 - 검증 후 또는 만료 후 물리 삭제 가능';


-- 휴대폰 인증 (OTP)
CREATE TABLE IF NOT EXISTS phone_verifications (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  phone       VARCHAR(20) NOT NULL,
  code        CHAR(6) NOT NULL,
  expires_at  DATETIME NOT NULL,
  verified_at DATETIME NULL,
  attempt_cnt TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_phone_verif_phone   (phone, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='휴대폰 OTP 인증 - 검증 완료 또는 만료 후 삭제 가능';


-- 비밀번호 재설정 토큰
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     CHAR(36) NOT NULL COMMENT 'users.user_id 참조',
  token       CHAR(64) NOT NULL UNIQUE,
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_pwd_reset_user    (user_id),
  INDEX idx_pwd_reset_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='비밀번호 재설정 토큰 - 사용 또는 만료 후 삭제 가능';


-- ==========================================================================
-- AI 사진관 도메인 (서비스 1)
-- ==========================================================================

-- photo_orders.status ENUM SSOT: PHOTO_ORDER_STATUS
-- photo_orders.photo_type ENUM SSOT: PHOTO_TYPE
CREATE TABLE IF NOT EXISTS photo_orders (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id        CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  user_id         CHAR(36) NOT NULL COMMENT 'users.user_id 참조',
  photo_type      ENUM('funeral','id','job','enhance','colorize','restore','removebg','portrait','casual') NOT NULL,
  status          ENUM('pending_payment','paid','processing','completed','failed','refunded')
                  NOT NULL DEFAULT 'pending_payment',

  -- 가격 (결제 시점 스냅샷)
  price_krw       INT UNSIGNED NOT NULL DEFAULT 9900 COMMENT '원화, 결제 시점 스냅샷',

  -- 처리 메타
  source_image_url VARCHAR(500) NULL COMMENT '원본 업로드 S3 URL',
  fail_reason     VARCHAR(500) NULL,
  completed_at    DATETIME NULL,

  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,

  INDEX idx_photo_orders_user           (user_id),
  INDEX idx_photo_orders_status_deleted (status, deleted_at),
  INDEX idx_photo_orders_type           (photo_type),
  INDEX idx_photo_orders_created        (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='AI 사진관 주문';


-- 사진 상태 로그 (append-only)
CREATE TABLE IF NOT EXISTS photo_order_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  log_id      CHAR(36) NOT NULL UNIQUE,
  order_id    CHAR(36) NOT NULL COMMENT 'photo_orders.order_id 참조',
  prev_status ENUM('pending_payment','paid','processing','completed','failed','refunded') NULL,
  next_status ENUM('pending_payment','paid','processing','completed','failed','refunded') NOT NULL,
  changed_by       CHAR(36) NOT NULL,
  changed_by_type  ENUM('user','admin','system') NOT NULL,
  reason           VARCHAR(500) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_photo_order_logs_order (order_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='사진 주문 상태 변경 이력 (append-only)';


-- 보정 결과 파일 (append-only: 재처리 시 기존 row 삭제 없이 신규 INSERT)
-- updated_at 의도적 제외 - 파일 메타데이터는 불변 레코드
CREATE TABLE IF NOT EXISTS photo_files (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  file_id       CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  order_id      CHAR(36) NOT NULL COMMENT 'photo_orders.order_id 참조',
  kind          ENUM('raw','enhanced') NOT NULL,
  variant       VARCHAR(30) NULL COMMENT '세트 결과물 종류(SPEC-08 결정1). 유효값 SSOT는
DB ENUM이 아니라 backend/src/domains/photo/photoResultSet.js의 VARIANT_DEFS
(restore_auto/restore_only/id_crop/suit). NULL = 세트 도입 이전 주문 또는
kind=raw(원본, variant 개념 없음). ENUM이 아닌 VARCHAR인 이유: 세트 구성은
상품 기획 재량이라 항목 추가/변경마다 ENUM ALTER가 필요해지는 것을 피함.',

  file_url      VARCHAR(500) NOT NULL COMMENT 'S3 서명 URL 또는 퍼블릭 URL',
  s3_key        VARCHAR(500) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
  file_size     INT UNSIGNED NOT NULL COMMENT '바이트',
  width         INT UNSIGNED NULL COMMENT '픽셀',
  height        INT UNSIGNED NULL COMMENT '픽셀',

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at    DATETIME NULL,

  INDEX idx_photo_files_order (order_id, kind),
  INDEX idx_photo_files_kind  (kind, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='AI 사진관 결과 파일 (raw/enhanced)';


-- ==========================================================================
-- AI 유언장 도메인 (서비스 2)
-- ==========================================================================

-- 음성 샘플 (민감 데이터: s3_key_encrypted, KMS)
CREATE TABLE IF NOT EXISTS voice_samples (
  id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  voice_sample_id        CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  user_id                CHAR(36) NOT NULL COMMENT 'users.user_id 참조',
  consent_id             CHAR(36) NOT NULL COMMENT 'user_consents.consent_id 참조 (voice 동의)',

  -- KMS 암호화 저장
  s3_key_encrypted       VARBINARY(512) NOT NULL COMMENT 'AES-256/KMS 암호화된 S3 키',
  kms_key_id             VARCHAR(200) NOT NULL COMMENT 'AWS KMS key ARN',

  -- ElevenLabs 연동
  elevenlabs_voice_id    VARCHAR(100) NULL COMMENT 'ElevenLabs clone voice ID',
  clone_status           ENUM('pending','processing','ready','failed') NOT NULL DEFAULT 'pending',

  duration_sec           INT UNSIGNED NULL COMMENT '음성 샘플 길이(초)',
  file_size              INT UNSIGNED NULL COMMENT '바이트',

  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at             DATETIME NULL,

  INDEX idx_voice_samples_user    (user_id),
  INDEX idx_voice_samples_consent (consent_id),
  INDEX idx_voice_samples_status  (clone_status, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='AI 음성 복제 샘플 (민감 데이터 - s3_key KMS 암호화)';


-- 유언장 (민감 데이터: content_text_encrypted, result_video_s3_key_encrypted)
-- wills.release_policy ENUM SSOT: WILL_RELEASE_POLICY
-- wills.release_status ENUM SSOT: WILL_RELEASE_STATUS
-- wills.status         ENUM SSOT: WILL_STATUS
CREATE TABLE IF NOT EXISTS wills (
  id                           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  will_id                      CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  user_id                      CHAR(36) NOT NULL COMMENT 'users.user_id 참조',
  voice_sample_id              CHAR(36) NULL COMMENT 'voice_samples.voice_sample_id 참조',

  -- 유언 내용 (KMS 암호화 저장 - 보안 갭 1 수정 2026-08-23)
  title                        VARCHAR(200) NOT NULL,
  content_text_encrypted       BLOB NULL COMMENT 'content_text_kms_key_id가 NULL이면 평문 UTF-8 바이트(KMS_KEY_ID 미설정 로컬 개발 폴백 또는 전환 이전 레거시). NOT NULL인데 content_text_enc_format이 NULL이면 KMS Encrypt() 직접 호출 방식의 구 암호문(4KB 제한 있음). content_text_enc_format=envelope이면 봉투 암호화(GenerateDataKey+AES-256-GCM, 4KB 제한 없음) 포맷 - utils/kms.js encryptStringEnvelope 참고',
  content_text_kms_key_id      VARCHAR(200) NULL COMMENT 'AWS KMS key ARN. NULL이면 content_text_encrypted가 실제로 암호화되지 않은 값',
  content_text_enc_format      VARCHAR(20) NULL COMMENT 'NULL=구 형식(평문 또는 KMS Encrypt() 직접 호출, kms_key_id로 구분) / envelope=봉투 암호화(GenerateDataKey+AES-256-GCM, 4KB 제한 없음, 2026-08-23 도입)',

  -- 결과 영상 (KMS 암호화)
  result_video_s3_key_encrypted VARBINARY(512) NULL COMMENT 'AES-256/KMS 암호화된 S3 키',
  result_video_kms_key_id       VARCHAR(200) NULL COMMENT 'AWS KMS key ARN',
  result_video_duration_sec     INT UNSIGNED NULL,

  -- 상태
  status                       ENUM('draft','paid','active','released','revoked') NOT NULL DEFAULT 'draft',
  release_policy               ENUM('manual_admin','inactivity_family_vote','immediate') NOT NULL DEFAULT 'manual_admin',
  release_status               ENUM('locked','pending_review','released') NOT NULL DEFAULT 'locked',
  released_at                  DATETIME NULL,

  -- 이벤트 유형 (결제 트리거 조건)
  event_type                   ENUM('death','incapacity','anniversary') NULL,

  -- 가격 스냅샷
  price_krw                    INT UNSIGNED NOT NULL DEFAULT 49000,

  created_at                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                   DATETIME NULL,

  INDEX idx_wills_user                    (user_id),
  INDEX idx_wills_voice_sample            (voice_sample_id),
  INDEX idx_wills_status_deleted          (status, deleted_at),
  INDEX idx_wills_release_status          (release_status, deleted_at),
  INDEX idx_wills_created                 (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='AI 디지털 유언장 (민감 데이터 - result_video S3 키 KMS 암호화)';


-- 유언장 상태 변경 이력 (append-only)
CREATE TABLE IF NOT EXISTS will_status_logs (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  log_id           CHAR(36) NOT NULL UNIQUE,
  will_id          CHAR(36) NOT NULL COMMENT 'wills.will_id 참조',
  prev_status      ENUM('draft','paid','active','released','revoked') NULL,
  next_status      ENUM('draft','paid','active','released','revoked') NOT NULL,
  changed_by       CHAR(36) NOT NULL,
  changed_by_type  ENUM('user','admin','system') NOT NULL,
  reason           VARCHAR(500) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_will_status_logs_will (will_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='유언장 상태 변경 이력 (append-only)';


-- 유가족 등록
CREATE TABLE IF NOT EXISTS will_beneficiaries (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  beneficiary_id  CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  will_id         CHAR(36) NOT NULL COMMENT 'wills.will_id 참조',
  user_id         CHAR(36) NULL COMMENT '가입 회원이면 users.user_id 참조',

  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(320) NOT NULL,
  phone           VARCHAR(20) NULL,
  relationship    VARCHAR(50) NOT NULL COMMENT '예: 배우자, 자녀, 형제',

  invite_token    CHAR(64) NOT NULL UNIQUE COMMENT '초대 링크 토큰. SPEC-05: 초대 수락뿐
아니라 영상 시청 링크(/api/will/watch/:token)에도 재사용됨 - 별도 video_token 컬럼 없음',
  verified_at     DATETIME NULL COMMENT '유가족 본인 인증 완료 시각',

  delivered_at      DATETIME NULL COMMENT '수신인별 전달(발송) 시각(SPEC-05,
12-analytics-plan.md 이벤트#49 delivery_sent). 관리자 승인 시각(will_release_requests.
reviewed_at)도 최초 열람 시각(video_watched_at)도 아니다 - 유가족에게 알림(이메일/SMS)이
실제로 발송된 시각. North Star 리드타임(released_at → delivered_at → video_watched_at)
산출에 필요',
  video_watched_at  DATETIME NULL COMMENT '영상 편지 최초 열람 시각(SPEC-05). NULL이면
미열람 - SPEC-04 미열람 리마인드 배치의 판정 기준',
  watch_count       INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '영상 편지 열람 횟수(SPEC-05).
getWatchUrl 호출 시마다 +1 - 관리자 검수 화면의 열람 현황 표시에도 사용',
  token_expires_at  DATETIME NULL COMMENT 'invite_token(=시청 링크 토큰) 만료
시각(SPEC-05, 90일 정책). NULL = 아직 만료 정책이 적용되지 않음(유언장 미공개 상태 등).
wills.released_at 기준 +90일로 설정, 연장 요청 시 재발급하며 갱신',

  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,

  INDEX idx_will_beneficiaries_will  (will_id),
  INDEX idx_will_beneficiaries_user  (user_id),
  INDEX idx_will_beneficiaries_email (email),
  INDEX idx_will_beneficiaries_expiry_watch (token_expires_at, video_watched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='유가족 등록 - 유언 공개 대상자';


-- 사후 공개 요청 (사망증명 업로드 + 관리자 승인)
-- will_release_requests.req_status ENUM SSOT: WILL_RELEASE_REQ_STATUS
CREATE TABLE IF NOT EXISTS will_release_requests (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_id          CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  will_id             CHAR(36) NOT NULL COMMENT 'wills.will_id 참조',
  requested_by        CHAR(36) NOT NULL COMMENT '요청한 유가족 users.user_id 또는 beneficiary_id',
  beneficiary_id      CHAR(36) NULL COMMENT 'will_beneficiaries.beneficiary_id 참조',

  -- 사망증명 서류
  death_cert_s3_key   VARCHAR(500) NOT NULL COMMENT '사망증명서 S3 키',
  death_cert_url      VARCHAR(500) NOT NULL COMMENT 'S3 서명 URL',

  req_status          ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by         CHAR(36) NULL COMMENT '검토한 admin_users.admin_id',
  reviewed_at         DATETIME NULL,
  reject_reason       VARCHAR(500) NULL,

  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME NULL,

  INDEX idx_will_release_req_will    (will_id),
  INDEX idx_will_release_req_status  (req_status, deleted_at),
  INDEX idx_will_release_req_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='사후 공개 요청 - 사망증명 업로드 + 관리자 승인 워크플로우';


-- ==========================================================================
-- AI 아바타 영상통화 도메인 (서비스 2 확장)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS avatar_sessions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id      CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  will_id         CHAR(36) NOT NULL COMMENT 'wills.will_id 참조',
  user_id         CHAR(36) NOT NULL COMMENT '통화 참여자 users.user_id',

  -- 통화 시간
  started_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at        DATETIME NULL,
  duration_sec    INT UNSIGNED NULL COMMENT '통화 길이(초), ended_at 기록 시 계산',

  -- WebRTC/D-ID 세션 메타
  webrtc_session_id VARCHAR(200) NULL,
  did_session_id    VARCHAR(200) NULL,

  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,

  INDEX idx_avatar_sessions_will    (will_id),
  INDEX idx_avatar_sessions_user    (user_id),
  INDEX idx_avatar_sessions_started (started_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='AI 아바타 영상통화 세션 기록';


-- ==========================================================================
-- 반려동물 아카이브 도메인 (서비스 3)
-- ==========================================================================

-- pets.species ENUM SSOT: PET_SPECIES
-- pets.status  ENUM SSOT: PET_STATUS
CREATE TABLE IF NOT EXISTS pets (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pet_id           CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  user_id          CHAR(36) NOT NULL COMMENT 'users.user_id 참조 (보호자)',
  name             VARCHAR(100) NOT NULL,
  species          ENUM('dog','cat','rabbit','bird','hamster','fish','reptile','other') NOT NULL,
  breed            VARCHAR(100) NULL,
  birth_date       DATE NULL,
  death_date       DATE NULL,

  -- 상태
  pet_status       ENUM('alive','deceased','unknown') NOT NULL DEFAULT 'alive',

  -- 추모 페이지
  memorial_slug    VARCHAR(100) NULL UNIQUE COMMENT '추모 페이지 공개 식별자 (예: lele-2015)',
  memorial_access_code VARCHAR(50) NULL COMMENT '추모관 접근 코드. is_public=0(비공개)일 때
접근 검증에 사용. NULL이면 접근 코드 미발급 - 서비스단에서 비공개로 취급',
  is_public        TINYINT(1) NOT NULL DEFAULT 0 COMMENT '추모 페이지 공개 여부(SPEC-03).
1=공개(코드 없이 접근 가능), 0=비공개(memorial_access_code 검증 필요). 기본값 0(비공개)
고정 - 소유자의 명시적 PATCH(/api/pet/:petId)로만 1로 변경할 것. 사람(고인) 추모
공간에는 이 개념 자체가 없음(항상 비공개, 컬럼 없음) - pets(반려동물)에만 존재.',
  profile_image_url VARCHAR(500) NULL,

  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       DATETIME NULL,

  INDEX idx_pets_user           (user_id),
  INDEX idx_pets_status_deleted (pet_status, deleted_at),
  INDEX idx_pets_created        (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='반려동물 프로필 (구독: pet_archive)';


-- 반려동물 상태 변경 이력 (append-only)
CREATE TABLE IF NOT EXISTS pet_status_logs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  log_id          CHAR(36) NOT NULL UNIQUE,
  pet_id          CHAR(36) NOT NULL COMMENT 'pets.pet_id 참조',
  prev_status     ENUM('alive','deceased','unknown') NULL,
  next_status     ENUM('alive','deceased','unknown') NOT NULL,
  changed_by      CHAR(36) NOT NULL,
  changed_by_type ENUM('user','admin','system') NOT NULL,
  reason          VARCHAR(500) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_pet_status_logs_pet (pet_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='반려동물 상태 변경 이력 (append-only)';


-- 반려동물 사진·동영상 (append-only: 삭제 시 deleted_at 설정)
-- updated_at 의도적 제외 - 미디어 메타데이터는 불변 레코드
CREATE TABLE IF NOT EXISTS pet_media (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  media_id         CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  pet_id           CHAR(36) NOT NULL COMMENT 'pets.pet_id 참조',
  media_type       ENUM('photo','video') NOT NULL,

  file_url         VARCHAR(500) NOT NULL COMMENT 'S3 URL',
  s3_key           VARCHAR(500) NOT NULL,
  thumbnail_s3_key VARCHAR(500) NULL COMMENT '썸네일 (video 필수, photo 선택)',
  thumbnail_url    VARCHAR(500) NULL,

  mime_type        VARCHAR(100) NOT NULL,
  file_size        INT UNSIGNED NOT NULL COMMENT '바이트',
  width            INT UNSIGNED NULL COMMENT '픽셀 (photo/video)',
  height           INT UNSIGNED NULL COMMENT '픽셀 (photo/video)',
  duration_sec     INT UNSIGNED NULL COMMENT '길이(초) - video만',

  taken_at         DATETIME NULL COMMENT '촬영 일시 (EXIF 또는 사용자 입력)',
  sort_order       INT UNSIGNED NOT NULL DEFAULT 0,
  caption          VARCHAR(500) NULL,

  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at       DATETIME NULL,

  INDEX idx_pet_media_pet      (pet_id, sort_order),
  INDEX idx_pet_media_type     (media_type, deleted_at),
  INDEX idx_pet_media_taken    (taken_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='반려동물 사진·동영상 아카이브';


-- ==========================================================================
-- 결제/구독 도메인
-- ==========================================================================

-- payments.target_type ENUM SSOT: PAYMENT_TARGET_TYPE
-- payments.status      ENUM SSOT: PAYMENT_STATUS
CREATE TABLE IF NOT EXISTS payments (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id        CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  user_id           CHAR(36) NOT NULL COMMENT 'users.user_id 참조',

  -- Polymorphic 참조 (VARCHAR 금지 - ENUM 명시)
  target_type       ENUM('photo_order','will_order','subscription','gift_order') NOT NULL,
  target_id         CHAR(36) NOT NULL COMMENT 'photo_orders.order_id / wills.will_id /
subscriptions.subscription_id / gift_orders.gift_id (SPEC-01 - 선물 결제는 결제 시점에
아직 photo_order/will이 생성되지 않았으므로 gift_orders를 대상으로 결제됨)',

  -- 토스페이먼츠
  toss_payment_key  VARCHAR(200) NOT NULL UNIQUE COMMENT '토스 결제 키 (멱등성 보장)',
  toss_order_id     VARCHAR(64) NOT NULL COMMENT '토스 주문 ID',

  amount_krw        INT UNSIGNED NOT NULL COMMENT '결제 금액(원화)',
  status            ENUM('ready','done','canceled','failed') NOT NULL DEFAULT 'ready',

  paid_at           DATETIME NULL,
  canceled_at       DATETIME NULL,
  cancel_reason     VARCHAR(500) NULL,
  fail_reason       VARCHAR(500) NULL,

  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME NULL,

  INDEX idx_payments_user              (user_id),
  INDEX idx_payments_target            (target_type, target_id),
  INDEX idx_payments_status_deleted    (status, deleted_at),
  INDEX idx_payments_created           (created_at DESC),
  INDEX idx_payments_toss_order_id     (toss_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='결제 내역 - 토스페이먼츠 연동';


-- subscriptions.plan   ENUM SSOT: SUBSCRIPTION_PLAN
-- subscriptions.status ENUM SSOT: SUBSCRIPTION_STATUS
CREATE TABLE IF NOT EXISTS subscriptions (
  id                          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subscription_id             CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  user_id                     CHAR(36) NOT NULL COMMENT 'users.user_id 참조',
  plan                        ENUM('pet_archive','will_premium','all') NOT NULL,
  sub_status                  ENUM('active','past_due','suspended','canceled') NOT NULL DEFAULT 'active',

  -- 토스 자동결제 빌링키 (KMS 암호화) - 해지 시 NULL 처리
  toss_billing_key_encrypted  VARBINARY(512) NULL COMMENT 'AES-256/KMS 암호화된 빌링키 - 해지 시 NULL 처리',
  billing_kms_key_id          VARCHAR(200) NULL COMMENT 'AWS KMS key ARN - 해지 시 NULL 처리',

  -- 결제 주기
  price_krw                   INT UNSIGNED NOT NULL DEFAULT 9900,
  next_billing_at             DATETIME NOT NULL,
  last_billed_at              DATETIME NULL,
  canceled_at                 DATETIME NULL,
  cancel_reason               VARCHAR(500) NULL,

  -- 결제 실패 추적
  fail_count                  TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '연속 결제 실패 횟수',
  last_failed_at              DATETIME NULL COMMENT '마지막 결제 실패 시각',
  grace_period_until          DATETIME NULL COMMENT 'past_due 유예 만료 시각 (3일)',
  suspended_at                DATETIME NULL COMMENT '구독 정지 시각',

  created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                  DATETIME NULL,

  INDEX idx_subscriptions_user           (user_id),
  INDEX idx_subscriptions_status_deleted (sub_status, deleted_at),
  INDEX idx_subscriptions_next_billing   (next_billing_at),
  INDEX idx_subscriptions_plan           (plan, sub_status),
  INDEX idx_subscriptions_user_plan_status (user_id, plan, sub_status),
  INDEX idx_subscriptions_grace          (sub_status, grace_period_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='구독 관리 - 토스 자동결제 빌링키 KMS 암호화';


-- 구독 상태 변경 이력 (append-only)
CREATE TABLE IF NOT EXISTS subscription_logs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  log_id          CHAR(36) NOT NULL UNIQUE,
  subscription_id CHAR(36) NOT NULL COMMENT 'subscriptions.subscription_id 참조',
  prev_status     ENUM('active','past_due','suspended','canceled') NULL,
  next_status     ENUM('active','past_due','suspended','canceled') NOT NULL,
  changed_by      CHAR(36) NOT NULL,
  changed_by_type ENUM('user','admin','system') NOT NULL,
  reason          VARCHAR(500) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_subscription_logs_sub (subscription_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='구독 상태 변경 이력 (append-only)';


-- subscription_payment_logs.log_status ENUM SSOT: SUBSCRIPTION_PAYMENT_LOG_STATUS
-- subscription_payment_logs.fail_category ENUM SSOT: SUBSCRIPTION_PAYMENT_FAIL_CATEGORY
CREATE TABLE IF NOT EXISTS subscription_payment_logs (
  id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  log_id                 CHAR(36) NOT NULL UNIQUE COMMENT 'UUID - 외부 노출용',

  subscription_id        CHAR(36) NOT NULL COMMENT 'subscriptions.subscription_id 참조',
  user_id                CHAR(36) NOT NULL COMMENT 'users.user_id 비정규화 (조회 최적화)',

  billing_cycle_date     DATE NOT NULL COMMENT '결제 사이클 기준일 (구독 시작일 기준 매월 동일 일)',
  attempt_no             TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '해당 사이클 내 시도 순서 (1~N)',

  log_status             ENUM('pending','success','failed','retry_scheduled','abandoned') NOT NULL DEFAULT 'pending',
  attempt_type           ENUM('initial','recurring','retry') NOT NULL DEFAULT 'recurring',

  toss_payment_key       VARCHAR(200) NULL UNIQUE COMMENT '성공 시 토스 결제 키',
  toss_order_id          VARCHAR(64) NOT NULL COMMENT '토스 주문 ID',

  amount_krw             INT UNSIGNED NOT NULL,

  attempted_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '결제 요청 전송 시각',
  succeeded_at           DATETIME NULL,
  failed_at              DATETIME NULL,

  fail_code              VARCHAR(50) NULL COMMENT '토스 원본 에러 코드 (예: REJECT_CARD_COMPANY)',
  fail_category          ENUM('card_expired','insufficient_funds','card_blocked','network_error','unknown') NULL,
  fail_reason            VARCHAR(500) NULL COMMENT '사용자 노출 메시지',

  next_retry_at          DATETIME NULL COMMENT 'retry_scheduled 상태일 때만 값 존재',

  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_sub_pay_logs_cycle_attempt (subscription_id, billing_cycle_date, attempt_no),
  UNIQUE KEY uq_sub_pay_logs_toss_order    (toss_order_id),
  INDEX idx_sub_pay_logs_sub_created  (subscription_id, created_at DESC),
  INDEX idx_sub_pay_logs_user_status  (user_id, log_status, created_at DESC),
  INDEX idx_sub_pay_logs_status_retry (log_status, next_retry_at),
  INDEX idx_sub_pay_logs_cycle        (billing_cycle_date, log_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='구독 정기결제 시도 로그 (append-only)';


-- ==========================================================================
-- AI 작업 큐 추적 도메인
-- ==========================================================================

-- ai_jobs.job_type ENUM SSOT: AI_JOB_TYPE
-- ai_jobs.status   ENUM SSOT: AI_JOB_STATUS
CREATE TABLE IF NOT EXISTS ai_jobs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_id          CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  user_id         CHAR(36) NOT NULL COMMENT 'users.user_id 참조',
  job_type        ENUM('photo_enhance','voice_clone','video_generate','avatar_stream') NOT NULL,
  job_status      ENUM('queued','running','completed','failed') NOT NULL DEFAULT 'queued',
  progress        TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0-100',

  -- BullMQ 연동
  bullmq_job_id   VARCHAR(100) NULL COMMENT 'BullMQ 내부 job ID',
  queue_name      VARCHAR(100) NULL,

  -- 대상 엔티티 (job_type에 따라 다름)
  target_type     ENUM('photo_order','voice_sample','will','avatar_session','pet') NOT NULL,
  target_id       CHAR(36) NOT NULL,

  -- 결과/에러
  result_url      VARCHAR(500) NULL COMMENT '결과물 S3 URL (완료 시)',
  error_message   VARCHAR(1000) NULL COMMENT '실패 시 에러 메시지',
  retry_cnt       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  started_at      DATETIME NULL,
  completed_at    DATETIME NULL,

  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,

  INDEX idx_ai_jobs_user_status  (user_id, job_status),
  INDEX idx_ai_jobs_type_status  (job_type, job_status),
  INDEX idx_ai_jobs_target       (target_type, target_id),
  INDEX idx_ai_jobs_created      (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='BullMQ AI 작업 추적 - photo_enhance/voice_clone/video_generate/avatar_stream';


-- ==========================================================================
-- 선물하기 도메인 (SPEC-01) - 자녀 결제 → 부모(무계정) 수행
-- ==========================================================================

-- gift_orders.product_type ENUM SSOT: GIFT_PRODUCT_TYPE
-- gift_orders.status       ENUM SSOT: GIFT_STATUS
CREATE TABLE IF NOT EXISTS gift_orders (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  gift_id             CHAR(36) NOT NULL UNIQUE COMMENT 'UUID - 외부 노출용',

  giver_user_id       CHAR(36) NOT NULL COMMENT '결제한 구매자(자녀) users.user_id 참조',
  product_type        ENUM('photo','will') NOT NULL COMMENT '선물 상품 종류 - photo_orders/wills 생성 대상',
  payment_id          CHAR(36) NULL COMMENT 'payments.payment_id 참조 (결제 준비 단계에서는 NULL 가능)',

  recipient_name      VARCHAR(100) NOT NULL COMMENT '받는 분(수행자) 이름',
  recipient_phone     VARCHAR(20) NOT NULL COMMENT '받는 분 휴대폰 번호 - 평문 저장
(users.phone과 동일 컨벤션). 링크 본인확인(뒤 4자리)에 사용. 향후 암호화 검토 여지 있음
(SPEC-01 4-2 토큰 유출 대응은 토큰 자체 해시 저장으로 이미 처리되나, 저장 데이터
자체의 암호화 필요성은 별도 판단 대상)',

  perform_token_hash  CHAR(64) NOT NULL UNIQUE COMMENT '수행 링크 서명 토큰의 SHA-256 해시.
refresh_tokens.token_hash와 동일 패턴 - 원본 토큰은 DB에 저장하지 않음',
  token_expires_at    DATETIME NOT NULL COMMENT '발급 후 90일 (SPEC-01 4-1). 만료 시
구매자가 마이페이지에서 재발급(기존 토큰 무효화)',

  status              ENUM('paid','link_sent','opened','in_progress','completed',
                       'declined','refunded','expired') NOT NULL DEFAULT 'paid',

  recipient_user_id   CHAR(36) NULL COMMENT '수행자가 기존 회원 계정과 연결한 경우
users.user_id 참조 (SPEC-01 4-3). 연결 시 완료된 콘텐츠(photo_orders/wills)의
소유자가 이 계정이 됨',

  photo_order_id      CHAR(36) NULL COMMENT '연결된 photo_orders.order_id 참조
(product_type=photo일 때만 채워짐). will_id와 동시에 채워지지 않는다 - 한 선물은
photo 또는 will 중 하나로만 이어진다. 수행자가 attach-photo-order 호출 시 기록되며,
이 컬럼이 채워져야 서버가 선물↔콘텐츠 연결을 스스로 알 수 있다(SPEC-01 미해결 공백)',
  will_id             CHAR(36) NULL COMMENT '연결된 wills.will_id 참조
(product_type=will일 때만 채워짐). photo_order_id와 동시에 채워지지 않는다.
수행자가 attach-will 호출 시 기록됨',

  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME NULL,

  INDEX idx_gift_orders_giver           (giver_user_id, created_at DESC),
  INDEX idx_gift_orders_status_deleted  (status, deleted_at),
  INDEX idx_gift_orders_recipient_user  (recipient_user_id),
  INDEX idx_gift_orders_payment         (payment_id),
  INDEX idx_gift_orders_token_expiry    (token_expires_at, status),
  INDEX idx_gift_orders_photo_order     (photo_order_id),
  INDEX idx_gift_orders_will            (will_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='선물하기 주문 (SPEC-01) - 구매자(자녀)가 결제, 무계정 수행자(부모)가
링크로 콘텐츠 제작을 수행';


-- 선물 주문 상태 변경 이력 (append-only)
CREATE TABLE IF NOT EXISTS gift_order_logs (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  log_id           CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',
  gift_id          CHAR(36) NOT NULL COMMENT 'gift_orders.gift_id 참조',
  prev_status      ENUM('paid','link_sent','opened','in_progress','completed',
                    'declined','refunded','expired') NULL,
  next_status      ENUM('paid','link_sent','opened','in_progress','completed',
                    'declined','refunded','expired') NOT NULL,
  changed_by       CHAR(36) NULL COMMENT '무계정 수행자 행위는 CHAR(36) NULL 허용 -
users.user_id/admin_users.admin_id 없는 토큰 기반 행위 포함 (audit_logs.actor_id의
anonymous 패턴과 동일한 이유)',
  changed_by_type  ENUM('user','admin','system') NOT NULL COMMENT '무계정 수행자의
직접 행위(거절 등)는 system으로 기록하고 reason에 "수행자(무계정) 요청"을 남긴다 -
gift_orders는 수행자 계정이 없을 수 있어 changed_by_type에 anonymous를 추가하지
않고 기존 3값을 유지한다(원칙 5 SSOT 최소 확장)',
  reason           VARCHAR(500) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_gift_order_logs_gift (gift_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='선물 주문 상태 변경 이력 (append-only, SPEC-01)';


-- ==========================================================================
-- 알림 도메인 (동시 설계 - 원칙 10)
-- ==========================================================================

-- notifications.notification_type ENUM SSOT: NOTIFICATION_TYPE
CREATE TABLE IF NOT EXISTS notifications (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  notification_id     CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  user_id             CHAR(36) NOT NULL COMMENT 'users.user_id 참조',
  notification_type   ENUM(
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
    'ai_processing_refunded'
  ) NOT NULL COMMENT 'payment_pending=결제 불확정 안내, ai_processing_refunded=AI 처리
실패 자동 환불 통지(기존 payment_failed 오용 대체), gift_*=SPEC-04 선물 이벤트',

  -- Polymorphic: VARCHAR 금지 - ENUM 명시
  target_type         ENUM('photo_order','will','will_release_request','payment','subscription','pet','avatar_session','gift_order') NULL,
  target_id           CHAR(36) NULL,

  title               VARCHAR(200) NOT NULL,
  message             VARCHAR(500) NOT NULL,
  is_read             TINYINT(1) NOT NULL DEFAULT 0,
  read_at             DATETIME NULL,

  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at          DATETIME NULL,

  INDEX idx_notif_user_unread (user_id, is_read, created_at DESC),
  INDEX idx_notif_type        (notification_type),
  INDEX idx_notif_target      (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='사용자 알림';


-- 알림 설정 (카테고리별 ON/OFF)
CREATE TABLE IF NOT EXISTS user_notification_settings (
  id                         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id                    CHAR(36) NOT NULL UNIQUE COMMENT 'users.user_id 참조',

  -- 채널별 마스터 스위치
  push_enabled               TINYINT(1) NOT NULL DEFAULT 1,
  email_enabled              TINYINT(1) NOT NULL DEFAULT 1,
  sms_enabled                TINYINT(1) NOT NULL DEFAULT 0,

  -- 카테고리별 ON/OFF
  notify_photo_complete      TINYINT(1) NOT NULL DEFAULT 1,
  notify_will_events         TINYINT(1) NOT NULL DEFAULT 1,
  notify_payment             TINYINT(1) NOT NULL DEFAULT 1,
  notify_subscription        TINYINT(1) NOT NULL DEFAULT 1,
  notify_pet_memorial        TINYINT(1) NOT NULL DEFAULT 1,
  notify_admin_notice        TINYINT(1) NOT NULL DEFAULT 1,

  created_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='사용자 알림 설정 (채널·카테고리별 ON/OFF)';


-- ==========================================================================
-- 마케팅/분석 도메인
-- ==========================================================================

-- ad_spend.channel 은 의도적으로 ENUM이 아닌 VARCHAR(원칙 5 예외 - 광고 채널은
-- 마케팅팀 재량으로 수시 추가되므로 ENUM ALTER 반복을 피함). 유효값 화이트리스트는
-- 서비스 레이어(관리자 입력 화면)에서 관리.
CREATE TABLE IF NOT EXISTS ad_spend (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ad_spend_id       CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  channel           VARCHAR(50) NOT NULL COMMENT '광고 채널 (예: meta, youtube, community,
partner). 신규 채널 추가 시 ALTER 불필요 - 유효값 화이트리스트는 서비스 레이어에서 관리',
  period_start      DATE NOT NULL COMMENT '집행 기간 시작일(포함)',
  period_end        DATE NOT NULL COMMENT '집행 기간 종료일(포함). CAC 계산 시 이 기간을
일 단위로 안분한다',
  spend_krw         INT UNSIGNED NOT NULL COMMENT '집행 광고비(원화, 기간 전체 합산액)',
  note              VARCHAR(500) NULL COMMENT '캠페인명·집행 메모(관리자 자유 입력)',

  recorded_by       CHAR(36) NOT NULL COMMENT '입력한 admin_users.admin_id (FK 없음, 스키마 전역 방침)',

  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME NULL,

  CONSTRAINT chk_ad_spend_period CHECK (period_end >= period_start),

  INDEX idx_ad_spend_channel_period (channel, period_start, period_end),
  INDEX idx_ad_spend_recorded_by    (recorded_by),
  INDEX idx_ad_spend_deleted        (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='관리자 입력 광고비 - CAC(고객획득비용) 산출용. 채널·기간별 집행 금액
(docs/strategy/12-analytics-plan.md 8-1절 P0)';


-- ==========================================================================
-- 관리자 도메인
-- ==========================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id        CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  email           VARCHAR(320) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  admin_role      ENUM('super','manager','reviewer') NOT NULL DEFAULT 'reviewer',
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at   DATETIME NULL,

  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,

  INDEX idx_admin_users_email          (email),
  INDEX idx_admin_users_role_deleted   (admin_role, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='관리자 계정';


-- ==========================================================================
-- 감사 로그 도메인 (민감 데이터 접근 감사, append-only)
-- JSON 컬럼 사용: 원칙 6 명시 예외 - 감사 로그 특성상 어떤 엔티티든 기록 가능해야 함
-- updated_at 의도적 제외 - 감사 로그는 불변 레코드
-- ==========================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  log_id        CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  actor_id      CHAR(36) NULL COMMENT '행위자 users.user_id 또는 admin_users.admin_id.
anonymous 행위(로그인 실패 등 인증 전)는 NULL',
  actor_type    ENUM('user','admin','system','anonymous') NOT NULL COMMENT
    'anonymous = 인증 전 행위(로그인 실패 등), actor_id NULL',

  -- 감사 대상
  action        VARCHAR(100) NOT NULL COMMENT '예: will.video.view, voice_sample.download, payment.refund',
  target_type   VARCHAR(100) NULL COMMENT '감사 로그 특성상 VARCHAR 허용 (원칙 6 예외)',
  target_id     CHAR(36) NULL,

  ip_address    VARCHAR(45) NULL,
  user_agent    VARCHAR(500) NULL,
  detail        JSON NULL COMMENT '감사 상세 데이터 (원칙 6 예외 - audit_logs)',

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_audit_logs_actor  (actor_id, actor_type, created_at DESC),
  INDEX idx_audit_logs_target (target_type, target_id),
  INDEX idx_audit_logs_action (action, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='민감 데이터 접근 감사 로그 (유언 영상 열람, 음성 샘플 다운로드 등, append-only)';


-- ==========================================================================
-- 인증 - Refresh Token
-- ==========================================================================

-- 주의(2026-08-22, 관리자 세션 교차검증 항목 6): 이 테이블은 일반 사용자뿐 아니라
-- 관리자(admin_users) refresh token도 함께 저장한다. adminRepository.js의
-- saveAdminRefreshToken/findAdminRefreshToken/findActiveAdminRefreshToken/
-- revokeAllAdminRefreshTokens가 user_id 컬럼에 admin_users.admin_id(UUID)를 그대로
-- 넣고 뺀다 - 이 테이블에 FOREIGN KEY가 없어(스키마 전체에 FK 미사용) 오늘은 무결성
-- 위반이 나지 않고, UUID 값 공간이 겹치지 않아 조회도 뒤섞이지 않는다.
-- 다만 이후 "사용자 전체 토큰 일괄 폐기", 탈퇴 정리 배치, `refresh_tokens JOIN users`
-- 같은 쿼리를 추가하면 이 테이블에 섞여 있는 admin 행을 사용자 행으로 오인해 조용히
-- 잘못 처리할 수 있다. 그런 쿼리를 새로 추가할 때는 반드시 대상 UUID가 users 소속인지
-- admin_users 소속인지 먼저 구분할 것 (예: JOIN 대신 존재 여부 서브쿼리로 확인).
-- 상세: docs/review/phase0-followups.md 참고.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash   VARCHAR(64) NOT NULL UNIQUE  COMMENT 'SHA-256 해시 - 원본 JWT 저장 금지',
  user_id      CHAR(36) NOT NULL            COMMENT 'users.user_id 참조. 단 admin_users.admin_id도 이 컬럼에 함께 저장됨(위 주석 참고) - FK 없음, UUID라 값 충돌 없음',
  expires_at   DATETIME NOT NULL,
  revoked_at   DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_rt_user    (user_id),
  INDEX idx_rt_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='JWT Refresh Token 해시 저장 - Rotation 방식 (재사용 시 revoke). user_id 컬럼은 일반 사용자와 관리자(admin_users.admin_id) 토큰을 함께 저장하는 혼용 테이블 - 위 주석 참고';


-- ==========================================================================
-- 마이그레이션 이력 로그 (서술만 - 실행 가능한 ALTER 없음)
--
-- 이 섹션은 "왜 지금 스키마가 이런 모양이 됐는지"를 설명하는 히스토리 기록이다.
-- 아래 각 항목이 원래 별도 ALTER TABLE 문이었던 시절도 있었으나, 그 결과는 전부
-- 위 CREATE TABLE 섹션에 최초 상태로 이미 반영되어 있다. 신규 DB는 이 섹션을
-- 전혀 실행할 필요가 없다 - 위 CREATE TABLE 정의만으로 최종 상태가 완성된다.
-- ==========================================================================

-- [1] (2026-04-19) payments.toss_order_id / subscriptions(user_id,plan,sub_status)
--     누락 인덱스 추가. paymentRepository.findPaymentByOrderId,
--     subscriptionRepository.findActiveSubscription 조회 최적화.
--     → 위 payments/subscriptions 테이블 정의에 이미 포함됨.

-- [2] (2026-04-19) notifications.notification_type ENUM에 'voice_clone_complete',
--     'will_video_ready' 추가 (voiceWorker.js / videoWorker.js INSERT 대응).
--     → 위 notifications 테이블 정의에 이미 포함됨.

-- [3] (2026-04-19) wills 결제→활성화 흐름 도입: status ENUM에 'paid' 추가,
--     will_status_logs 동기화, wills.event_type 컬럼 신설,
--     user_consents (user_id, consent_type) UNIQUE 추가.
--     → 위 wills/will_status_logs/user_consents 테이블 정의에 이미 포함됨.

-- [4] (2026-04-20) photo_orders.photo_type ENUM 확장
--     (enhance/colorize/restore/removebg 추가, 3개→7개).
--     → 위 photo_orders 테이블 정의에 이미 포함됨.

-- [5] (2026-04-20) 구독 정기결제 실패 처리 흐름: subscriptions.sub_status에
--     'suspended' 추가, fail_count/last_failed_at/grace_period_until/
--     suspended_at 컬럼 신설, subscription_logs 동기화.
--     → 위 subscriptions/subscription_logs 테이블 정의에 이미 포함됨.

-- [6] (2026-08-21, migration a: schema-drift-fix) ai_jobs.target_type ENUM에
--     'pet' 추가, photo_orders.photo_type ENUM에 'portrait','casual' 추가
--     (7개→9개), pets.memorial_access_code 컬럼 신설,
--     subscriptions 빌링키 2컬럼 NULL 허용 전환.
--     원본: docs/migrations/2026-08-21-schema-drift-fix.{up,down,README}
--     → 위 ai_jobs/photo_orders/pets/subscriptions 테이블 정의에 이미 포함됨.

-- [7] (2026-08-21, migration b: memorial-visibility-and-consent)
--     pets.is_public 컬럼 신설(DEFAULT 0=비공개 고정, SPEC-03),
--     user_consents.consent_type ENUM에 'terms','marketing' 추가.
--     원본: docs/migrations/2026-08-21b-memorial-visibility-and-consent.{up,down,README}
--     → 위 pets/user_consents 테이블 정의에 이미 포함됨.

-- [8] (2026-08-22, migration c: watch-tracking-and-ad-spend)
--     will_beneficiaries에 delivered_at/video_watched_at/watch_count/
--     token_expires_at 4컬럼 + 만료조회 인덱스 신설(SPEC-05, SPEC-04),
--     ad_spend 테이블 신규(CAC 산출용, 12-analytics-plan.md P0),
--     photo_files.variant 컬럼 신설(SPEC-08 세트 결과물 4종 구분).
--     원본: docs/migrations/2026-08-22-watch-tracking-and-ad-spend.{up,down,README}
--     → 위 will_beneficiaries/ad_spend/photo_files 테이블 정의에 이미 포함됨.
--     ⚠️ migration a/b/c는 실제 운영 DB에는 한 번도 적용되지 않았다(DB 자체가
--     아직 없었음). 이 통합 작업(2026-08-22)으로 세 파일의 UP 내용을 스키마
--     본문에 직접 반영했다 - 각 파일 README 상단에 "신규 DB는 이 마이그레이션을
--     실행하지 말 것" 배너를 추가해 두었다.

-- [9] (2026-08-22, 이번 통합 작업) 신규 반영 3건:
--     1) audit_logs 익명 행위자 지원 - actor_id NULL 허용, actor_type ENUM에
--        'anonymous' 추가 (관리자 로그인 실패 등 인증 전 행위의 감사 기록 유실 해소).
--     2) gift_orders / gift_order_logs 신설 (SPEC-01 선물하기 플로우).
--        payments.target_type / notifications.target_type ENUM에 'gift_order' 추가.
--     3) notifications.notification_type ENUM에 'gift_link_sent', 'gift_completed',
--        'gift_declined'(SPEC-04 선물 이벤트), 'ai_processing_refunded'
--        (AI 실패 자동 환불 통지 - 기존 payment_failed 오용 대체),
--        'payment_pending'(결제 불확정 안내) 추가.
--     → 위 각 테이블 정의에 이미 포함됨. shared/constants/enums.js·enums.ts 동시 반영.

-- [10] (2026-08-22, 마감 공백 처리) gift_orders에 photo_order_id/will_id 컬럼 신설
--      + 조회 인덱스 2개 추가. gift ↔ 콘텐츠(photo_orders/wills) 연결을 attach 시점에
--      영속화하기 위함 - 기존에는 attach-photo-order/attach-will이 소유권만 검증하고
--      연결 자체를 저장하지 않아, 서버가 어떤 콘텐츠가 어느 선물에 속하는지 알 수
--      없었다(AI 처리 실패 시 gift_order 결제를 역추적할 방법이 없어 자동환불이
--      막히는 문제로 이어짐). ENUM 신규 값 없음 - 기존 GIFT_STATUS/notification_type
--      값으로 충분.
