-- ==========================================================================
-- Migration: 2026-08-21-schema-drift-fix (DOWN / 롤백)
-- 순서: UP의 역순 (5 → 4 → 3 → 2 → 1)
-- ⚠️ 이 파일도 실행되지 않는다. 사용자가 직접, 아래 사전 확인 쿼리를 먼저 돌려본 뒤 실행한다.
-- ⚠️ [3][2] ENUM 값 제거는 안전한 롤백이 원천적으로 불가능하다 - 아래 절차 필수.
-- ==========================================================================

SET time_zone = '+09:00';


-- ==========================================================================
-- [5] subscriptions 빌링키 컬럼 NOT NULL로 되돌리기
-- ⚠️ 데이터 손실/실패 주의: UP 적용 이후 해지된 구독은 이 두 컬럼이 NULL로
--   채워져 있을 것이다. NOT NULL로 되돌리기 전 아래로 먼저 확인한다.
--
--   SELECT COUNT(*) FROM subscriptions
--     WHERE toss_billing_key_encrypted IS NULL OR billing_kms_key_id IS NULL;
--
--   위 count가 0이 아니면 이 ALTER는 즉시 실패한다 (NOT NULL 위반).
--   롤백을 강행해야 한다면, 먼저 해당 row들에 대해 더미/만료 표시 값을 채우는
--   백필 DML을 팀과 협의해 별도로 작성할 것 - 이 파일은 그 백필을 포함하지 않는다.
-- ==========================================================================
ALTER TABLE subscriptions
  MODIFY COLUMN toss_billing_key_encrypted VARBINARY(512) NOT NULL COMMENT 'AES-256/KMS 암호화된 빌링키',
  MODIFY COLUMN billing_kms_key_id VARCHAR(200) NOT NULL COMMENT 'AWS KMS key ARN',
  ALGORITHM=INPLACE, LOCK=NONE;


-- ==========================================================================
-- [4] pets.memorial_access_code 컬럼 제거
-- ⚠️ 데이터 손실 주의: 이 컬럼에 저장된 접근 코드 값이 전부 삭제된다.
--   롤백 전 반드시 백업하거나 아래로 값 존재 여부를 확인할 것.
--
--   SELECT COUNT(*) FROM pets WHERE memorial_access_code IS NOT NULL;
-- ==========================================================================
ALTER TABLE pets
  DROP COLUMN memorial_access_code,
  ALGORITHM=INSTANT;


-- ==========================================================================
-- [3] photo_orders.photo_type ENUM에서 'portrait', 'casual' 제거
-- ⚠️ ENUM 값 제거는 안전한 롤백 불가 - 수동 절차 필요.
--   해당 값을 가진 row가 있는 상태로 MODIFY를 실행하면 그 값들이 ENUM 첫 번째
--   빈 문자열('')로 조용히 변환되는 파괴적 동작이 발생한다 (에러 없이 데이터 손상).
--
--   1) 롤백 전 반드시 먼저 확인:
--      SELECT COUNT(*) FROM photo_orders WHERE photo_type IN ('portrait','casual');
--
--   2) 위 count가 0이 아니면 롤백 금지, 또는 해당 row들을 다른 값으로
--      먼저 마이그레이션(UPDATE)한 뒤에만 진행할 것.
--
--   3) count가 0임을 확인한 경우에만 아래 실행 (COPY 알고리즘 유발 → 테이블 풀 락,
--      대용량 테이블이면 pt-online-schema-change/gh-ost 권장):
-- ==========================================================================
-- ALTER TABLE photo_orders
--   MODIFY COLUMN photo_type ENUM('funeral','id','job','enhance','colorize','restore','removebg') NOT NULL;


-- ==========================================================================
-- [2] ai_jobs.target_type ENUM에서 'pet' 제거
-- ⚠️ ENUM 값 제거는 안전한 롤백 불가 - 수동 절차 필요. 동일 원리로 사전 확인 필수.
--
--   1) SELECT COUNT(*) FROM ai_jobs WHERE target_type = 'pet';
--   2) count가 0이 아니면 롤백 금지 또는 해당 row 먼저 정리.
--   3) count 0 확인 후에만 아래 실행 (COPY 알고리즘 유발 가능):
-- ==========================================================================
-- ALTER TABLE ai_jobs
--   MODIFY COLUMN target_type ENUM('photo_order','voice_sample','will','avatar_session') NOT NULL;


-- ==========================================================================
-- [1] enums.ts 롤백
-- SQL 롤백과 별개로, shared/constants/enums.ts 도 함께 되돌려야 SSOT가 유지된다.
-- (PHOTO_TYPE에서 portrait/casual 제거, AI_JOB_TARGET_TYPE에서 pet 제거)
-- 이 파일은 SQL 전용이므로 enums.ts 롤백은 수동으로 git revert 하거나 직접 편집할 것.
-- ==========================================================================
