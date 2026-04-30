-- ==========================================================================
-- 온담(ondam) DB 스키마
-- AI 기억사진관 플랫폼
-- Created: 2026-04-19
-- ==========================================================================
-- ENUM SSOT: shared/constants/enums.ts 와 동기화 필수
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
-- ENUM 목록 (shared/constants/enums.ts 동기화 대상)
--
-- USER_ROLE                          : 'user', 'admin'
-- CONSENT_TYPE                       : 'privacy', 'portrait', 'voice', 'ai_generation', 'posthumous_release'
-- PHOTO_ORDER_STATUS                 : 'pending_payment', 'paid', 'processing', 'completed', 'failed', 'refunded'
-- PHOTO_TYPE                         : 'funeral', 'id', 'job', 'enhance', 'colorize', 'restore', 'removebg'
-- PHOTO_FILE_KIND                    : 'raw', 'enhanced'
-- WILL_RELEASE_POLICY                : 'manual_admin', 'inactivity_family_vote', 'immediate'
-- WILL_RELEASE_STATUS                : 'locked', 'pending_review', 'released'
-- WILL_STATUS                        : 'draft', 'active', 'released', 'revoked'
-- PET_SPECIES                        : 'dog', 'cat', 'rabbit', 'bird', 'hamster', 'fish', 'reptile', 'other'
-- PET_MEDIA_TYPE                     : 'photo', 'video'
-- PET_STATUS                         : 'alive', 'deceased', 'unknown'
-- PAYMENT_TARGET_TYPE                : 'photo_order', 'will_order', 'subscription'
-- PAYMENT_STATUS                     : 'ready', 'done', 'canceled', 'failed'
-- SUBSCRIPTION_PLAN                  : 'pet_archive', 'will_premium', 'all'
-- SUBSCRIPTION_STATUS                : 'active', 'past_due', 'suspended', 'canceled'
-- SUBSCRIPTION_PAYMENT_LOG_STATUS    : 'pending', 'success', 'failed', 'retry_scheduled', 'abandoned'
-- SUBSCRIPTION_PAYMENT_FAIL_CATEGORY : 'card_expired', 'insufficient_funds', 'card_blocked', 'network_error', 'unknown'
-- AI_JOB_TYPE                        : 'photo_enhance', 'voice_clone', 'video_generate', 'avatar_stream'
-- AI_JOB_STATUS                      : 'queued', 'running', 'completed', 'failed'
-- NOTIFICATION_TYPE                  : 'photo_complete', 'voice_clone_complete', 'will_video_ready',
--                                      'will_release_request', 'will_released',
--                                      'payment_done', 'payment_failed', 'subscription_renewed',
--                                      'subscription_canceled', 'pet_memorial_shared', 'admin_notice'
-- WILL_RELEASE_REQ_STATUS            : 'pending', 'approved', 'rejected'
-- CHANGED_BY_TYPE                    : 'user', 'admin', 'system'
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
  consent_type ENUM('privacy','portrait','voice','ai_generation','posthumous_release') NOT NULL,
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
  photo_type      ENUM('funeral','id','job','enhance','colorize','restore','removebg') NOT NULL,
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


-- 유언장 (민감 데이터: result_video_s3_key_encrypted)
-- wills.release_policy ENUM SSOT: WILL_RELEASE_POLICY
-- wills.release_status ENUM SSOT: WILL_RELEASE_STATUS
-- wills.status         ENUM SSOT: WILL_STATUS
CREATE TABLE IF NOT EXISTS wills (
  id                           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  will_id                      CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  user_id                      CHAR(36) NOT NULL COMMENT 'users.user_id 참조',
  voice_sample_id              CHAR(36) NULL COMMENT 'voice_samples.voice_sample_id 참조',

  -- 유언 내용 (별도 암호화 저장 권장)
  title                        VARCHAR(200) NOT NULL,
  content_text                 TEXT NULL COMMENT '유언 텍스트 (백엔드 KMS 암호화 처리)',

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

  invite_token    CHAR(64) NOT NULL UNIQUE COMMENT '초대 링크 토큰',
  verified_at     DATETIME NULL COMMENT '유가족 본인 인증 완료 시각',

  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,

  INDEX idx_will_beneficiaries_will  (will_id),
  INDEX idx_will_beneficiaries_user  (user_id),
  INDEX idx_will_beneficiaries_email (email)
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
  target_type       ENUM('photo_order','will_order','subscription') NOT NULL,
  target_id         CHAR(36) NOT NULL COMMENT 'photo_orders.order_id / wills.will_id / subscriptions.subscription_id',

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
  INDEX idx_payments_created           (created_at DESC)
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

  -- 토스 자동결제 빌링키 (KMS 암호화)
  toss_billing_key_encrypted  VARBINARY(512) NOT NULL COMMENT 'AES-256/KMS 암호화된 빌링키',
  billing_kms_key_id          VARCHAR(200) NOT NULL COMMENT 'AWS KMS key ARN',

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
  INDEX idx_subscriptions_plan           (plan, sub_status)
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
  target_type     ENUM('photo_order','voice_sample','will','avatar_session') NOT NULL,
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
    'subscription_renewed',
    'subscription_canceled',
    'pet_memorial_shared',
    'admin_notice'
  ) NOT NULL,

  -- Polymorphic: VARCHAR 금지 - ENUM 명시
  target_type         ENUM('photo_order','will','will_release_request','payment','subscription','pet','avatar_session') NULL,
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

  actor_id      CHAR(36) NOT NULL COMMENT '행위자 users.user_id 또는 admin_users.admin_id',
  actor_type    ENUM('user','admin','system') NOT NULL,

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

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash   VARCHAR(64) NOT NULL UNIQUE  COMMENT 'SHA-256 해시 - 원본 JWT 저장 금지',
  user_id      CHAR(36) NOT NULL            COMMENT 'users.user_id 참조',
  expires_at   DATETIME NOT NULL,
  revoked_at   DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_rt_user    (user_id),
  INDEX idx_rt_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='JWT Refresh Token 해시 저장 - Rotation 방식 (재사용 시 revoke)';


-- ==========================================================================
-- 마이그레이션: 누락 인덱스 추가 (2026-04-19)
-- ==========================================================================

-- [1] payments.toss_order_id
--     paymentRepository.findPaymentByOrderId: WHERE toss_order_id = ?
--     toss_payment_key 는 UNIQUE(인덱스 겸용)이지만 toss_order_id 는 인덱스 없음
ALTER TABLE payments
  ADD INDEX idx_payments_toss_order_id (toss_order_id);

-- [2] subscriptions - user_id + plan + sub_status 복합 인덱스
--     subscriptionRepository.findActiveSubscription:
--       WHERE user_id = ? AND plan = ? AND sub_status = 'active' AND deleted_at IS NULL
--     기존 idx_subscriptions_plan(plan, sub_status) 은 user_id 없어 풀스캔 가능
--     선두 컬럼을 user_id 로 두어 사용자별 조회 + 플랜/상태 필터 최적화
ALTER TABLE subscriptions
  ADD INDEX idx_subscriptions_user_plan_status (user_id, plan, sub_status);

-- ==========================================================================
-- 마이그레이션: notifications.notification_type ENUM 누락값 추가 (2026-04-19)
-- ==========================================================================

-- [3] notifications.notification_type - 'voice_clone_complete', 'will_video_ready' 추가
--     voiceWorker.js: notification_type = 'voice_clone_complete' 사용 중
--     videoWorker.js: notification_type = 'will_video_ready' 사용 중
--     두 값이 ENUM에 없어 INSERT 시 런타임 오류 발생
--     MySQL ENUM 수정은 전체 테이블 재정의를 유발하므로 오프피크 적용 권장
ALTER TABLE notifications
  MODIFY COLUMN notification_type ENUM(
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
    'admin_notice'
  ) NOT NULL;

-- ==========================================================================
-- 마이그레이션: 유언장 결제→활성화 흐름 도입 (2026-04-19)
-- ==========================================================================

-- [4] wills.status ENUM - 'paid' 추가
--     결제 완료 후 프론트엔드가 activateWill 을 명시적으로 호출하기 전까지
--     유언장은 'paid' 상태를 유지한다 (영상 생성 큐는 activateWill 시점에 등록)
ALTER TABLE wills
  MODIFY COLUMN status ENUM('draft','paid','active','released','revoked') NOT NULL DEFAULT 'draft';

-- [5] will_status_logs - prev_status / next_status ENUM 에 'paid' 추가
ALTER TABLE will_status_logs
  MODIFY COLUMN prev_status ENUM('draft','paid','active','released','revoked') NULL,
  MODIFY COLUMN next_status ENUM('draft','paid','active','released','revoked') NOT NULL;

-- [6] wills.event_type - 결제 트리거 조건 (사망/금치산/기념일)
ALTER TABLE wills
  ADD COLUMN event_type ENUM('death','incapacity','anniversary') NULL
    COMMENT '유언장 공개 트리거 이벤트 유형'
    AFTER release_status;

-- [7] user_consents - (user_id, consent_type) UNIQUE KEY
--     upsertConsent 에서 ON DUPLICATE KEY UPDATE 를 사용하기 위한 선결 조건
--     기존 중복 데이터가 있으면 먼저 정리 후 실행
ALTER TABLE user_consents
  ADD UNIQUE KEY uq_consents_user_type (user_id, consent_type);

-- ==========================================================================
-- 마이그레이션: photo_orders.photo_type ENUM 확장 (2026-04-20)
-- ==========================================================================

-- [8] photo_orders.photo_type ENUM 확장 (enhance/colorize/restore/removebg 추가)
--     photoWorker.js 및 Zod 검증이 7개 타입을 지원하나 ENUM은 3개만 선언되어
--     enhance/colorize/restore/removebg 주문 INSERT 시 런타임 오류 발생
--     MySQL ENUM 수정은 전체 테이블 재정의를 유발하므로 오프피크 적용 권장
ALTER TABLE photo_orders
  MODIFY COLUMN photo_type ENUM('funeral','id','job','enhance','colorize','restore','removebg') NOT NULL;

-- ==========================================================================
-- 마이그레이션: 구독 정기결제 실패 처리 흐름 도입 (2026-04-20)
-- ==========================================================================

-- [9] KST 타임존 세팅 (DB 연결 풀 초기화 외 마이그레이션 실행 시 보정)
SET time_zone = '+09:00';

-- [10] subscription_payment_logs 신규 테이블 생성
--      구독 정기결제 시도 이력 추적 (append-only)
--      billing_cycle_date + attempt_no 복합 UNIQUE 로 사이클 내 중복 시도 방지
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

-- [11] subscriptions ENUM 확장 + 결제 실패 추적 컬럼 추가
--      sub_status 에 'suspended' 추가: past_due 유예 만료 후 접근 차단 상태
--      fail_count / last_failed_at / grace_period_until / suspended_at 컬럼 신설
--      MySQL 8.4: NOT NULL + DEFAULT 컬럼 추가는 ALGORITHM=INSTANT 가능 (무락)
--      ENUM MODIFY는 ALGORITHM=COPY 유발 가능 → 오프피크 적용 권장
--      shared/constants/enums.ts 의 SUBSCRIPTION_STATUS 동시 수정 필수
ALTER TABLE subscriptions
  MODIFY COLUMN sub_status ENUM('active','past_due','suspended','canceled') NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS fail_count         TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '연속 결제 실패 횟수'     AFTER cancel_reason,
  ADD COLUMN IF NOT EXISTS last_failed_at     DATETIME NULL                        COMMENT '마지막 결제 실패 시각' AFTER fail_count,
  ADD COLUMN IF NOT EXISTS grace_period_until DATETIME NULL                        COMMENT 'past_due 유예 만료 시각 (3일)' AFTER last_failed_at,
  ADD COLUMN IF NOT EXISTS suspended_at       DATETIME NULL                        COMMENT '구독 정지 시각'         AFTER grace_period_until,
  ADD INDEX idx_subscriptions_grace (sub_status, grace_period_until);

-- [12] subscription_logs ENUM 확장 - 'suspended' 추가
--      prev_status / next_status 모두 subscriptions.sub_status 와 동기
--      shared/constants/enums.ts 의 SUBSCRIPTION_STATUS 와 함께 동기화 완료
ALTER TABLE subscription_logs
  MODIFY COLUMN prev_status ENUM('active','past_due','suspended','canceled') NULL,
  MODIFY COLUMN next_status ENUM('active','past_due','suspended','canceled') NOT NULL;
