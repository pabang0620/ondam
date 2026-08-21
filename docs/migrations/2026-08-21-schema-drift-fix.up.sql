-- ==========================================================================
-- Migration: 2026-08-21-schema-drift-fix (UP)
-- 목적: 코드↔스키마 drift 4건 해소 (3~4개 에이전트 교차 확인 완료)
--   1) ai_jobs.target_type ENUM에 'pet' 누락 → petService.js INSERT 상시 실패
--   2) photo_orders.photo_type ENUM에 'portrait','casual' 누락 → Zod/워커 전제 불일치
--   3) pets.memorial_access_code 컬럼 자체 없음 → memorialRepository SELECT 상시 500
--   4) subscriptions 빌링키 컬럼 2개 NOT NULL → 해지 시 NULL UPDATE 상시 실패
--
-- 실행 책임: 이 파일은 생성만 됨. 어떤 DB에도 자동 실행되지 않는다.
-- 반드시 사용자가 백업 확인 후 직접 실행한다 (docs/migrations/2026-08-21-schema-drift-fix.README.md 참조)
-- ==========================================================================

-- [1] KST 타임존 세팅 (마이그레이션 실행 세션 보정 - 커넥션 풀 초기화와 별개로 수동 실행 시 필요)
SET time_zone = '+09:00';


-- ==========================================================================
-- [2] ai_jobs.target_type ENUM에 'pet' 추가
-- 영향: ENUM 값을 기존 값들 뒤에 추가 → ALGORITHM=INSTANT 가능 (MySQL 8.4, 무락)
-- 근거: petService.js:186 이 target_type='pet' 으로 INSERT 하지만 ENUM에 없어 상시 실패
-- ==========================================================================
ALTER TABLE ai_jobs
  MODIFY COLUMN target_type ENUM('photo_order','voice_sample','will','avatar_session','pet') NOT NULL,
  ALGORITHM=INSTANT;

-- shared/constants/enums.ts AI_JOB_TARGET_TYPE 동시 수정 완료 (이 마이그레이션과 함께 커밋됨)


-- ==========================================================================
-- [3] photo_orders.photo_type ENUM에 'portrait', 'casual' 추가
-- 영향: ENUM 값을 기존 값들 뒤에 추가 → ALGORITHM=INSTANT 가능 (MySQL 8.4, 무락)
-- 근거: Zod(photoRoutes.js:30)와 워커 프롬프트(photoWorker.js)는 9개 타입을 전제하나
--       DB ENUM은 7개(funeral,id,job,enhance,colorize,restore,removebg)만 정의됨
-- ==========================================================================
ALTER TABLE photo_orders
  MODIFY COLUMN photo_type ENUM('funeral','id','job','enhance','colorize','restore','removebg','portrait','casual') NOT NULL,
  ALGORITHM=INSTANT;

-- shared/constants/enums.ts PHOTO_TYPE 동시 수정 완료 (이 마이그레이션과 함께 커밋됨)

-- ⚠️ 참고: photo_order_logs.prev_status / next_status ENUM은 photo_orders.status(주문 상태:
--   pending_payment/paid/processing/completed/failed/refunded)를 따르는 것이라 photo_type과는
--   무관하다. photo_type ENUM 확장 시 photo_order_logs는 변경 대상 아님 (착오 방지 주석).


-- ==========================================================================
-- [4] pets.memorial_access_code 컬럼 추가
-- 영향: NULL 허용 컬럼 추가 → ALGORITHM=INSTANT 가능 (MySQL 8.4, 무락)
-- 근거: memorialRepository 가 이 컬럼을 SELECT 하는데 컬럼 자체가 없어 상시 500 에러
-- ⚠️ 접근제어 정책 미확정 (SPEC-03 승인 대기): 이 컬럼값이 NULL일 때 추모관을 공개로
--    둘지 비공개로 둘지는 스키마 레벨에서 결정하지 않는다. 컬럼만 추가하고 정책은
--    서비스 레이어(memorialService)에서 SPEC-03 확정 후 구현한다.
--    권장: 정책 확정 전까지는 access_code가 없으면(NULL) 비공개로 취급 - "명시적 허용"
--    원칙(코드가 있어야 노출)을 기본값으로 두는 편이 온담 CLAUDE.md의 "추모관 접근 제한"
--    보안 규칙(유가족 인증 없이 고인 데이터 노출 절대 금지)과 방향이 일치한다.
--    단, 이는 권장 사항이며 SPEC-03 승인 없이 서비스 로직으로 확정하지 말 것.
-- ==========================================================================
ALTER TABLE pets
  ADD COLUMN memorial_access_code VARCHAR(50) NULL
    COMMENT '추모관 접근 코드. NULL 허용 여부의 접근제어 의미(공개/비공개 기본값)는
아직 미확정 - SPEC-03 승인 전까지 서비스단에서 코드 없으면 비공개로 처리 권장'
    AFTER memorial_slug,
  ALGORITHM=INSTANT;


-- ==========================================================================
-- [5] subscriptions 빌링키 컬럼 2개 NULL 허용으로 변경
-- 영향: NOT NULL → NULL 허용은 컬럼 재정의(ALGORITHM=INPLACE, 짧은 메타데이터 락).
--   대용량 테이블에서는 순간 락 발생 가능 - 운영 적용 시 트래픽 낮은 시간대 권장.
-- 근거: cancelSubscription(subscriptionRepository.js:152)이 해지 시 이 두 컬럼을
--   NULL로 UPDATE 하는데 NOT NULL 제약 때문에 상시 실패.
--   CLAUDE.md 보안 규칙: "해지 시 즉시 toss_billing_key_encrypted = NULL 처리" 명시.
-- ==========================================================================
ALTER TABLE subscriptions
  MODIFY COLUMN toss_billing_key_encrypted VARBINARY(512) NULL COMMENT 'AES-256/KMS 암호화된 빌링키 - 해지 시 NULL 처리',
  MODIFY COLUMN billing_kms_key_id VARCHAR(200) NULL COMMENT 'AWS KMS key ARN - 해지 시 NULL 처리',
  ALGORITHM=INPLACE, LOCK=NONE;
