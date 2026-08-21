-- ==========================================================================
-- Migration: 2026-08-21b-memorial-visibility-and-consent (DOWN / 롤백)
-- 순서: UP의 역순 (2 → 1)
-- ⚠️ 이 파일도 실행되지 않는다. 사용자가 직접, 아래 사전 확인 쿼리를 먼저 돌려본 뒤 실행한다.
-- ⚠️ [2] ENUM 값 제거는 안전한 롤백이 원천적으로 불가능하다 - 아래 절차 필수.
-- ==========================================================================

SET time_zone = '+09:00';


-- ==========================================================================
-- [2] user_consents.consent_type ENUM에서 'terms', 'marketing' 제거
-- ⚠️ ENUM 값 제거는 안전한 롤백 불가 - 수동 절차 필요.
--   해당 값을 가진 row가 있는 상태로 MODIFY를 실행하면 그 값들이 ENUM 첫 번째
--   빈 문자열('')로 조용히 변환되는 파괴적 동작이 발생한다 (에러 없이 데이터 손상).
--   특히 'marketing' 동의 이력은 법적 증빙 목적이므로 삭제 시 유의할 것.
--
--   1) 롤백 전 반드시 먼저 확인:
--      SELECT COUNT(*) FROM user_consents WHERE consent_type IN ('terms','marketing');
--
--   2) 위 count가 0이 아니면 롤백 금지, 또는 해당 row들을 백업/이관한 뒤에만 진행할 것.
--
--   3) count가 0임을 확인한 경우에만 아래 실행 (COPY 알고리즘 유발 가능 → 테이블 풀 락,
--      대용량 테이블이면 pt-online-schema-change/gh-ost 권장):
-- ==========================================================================
-- ALTER TABLE user_consents
--   MODIFY COLUMN consent_type
--     ENUM('privacy','portrait','voice','ai_generation','posthumous_release')
--     NOT NULL;


-- ==========================================================================
-- [1] pets.is_public 컬럼 제거
-- ⚠️ 데이터 손실 주의: 이 컬럼에 저장된 공개/비공개 설정 값이 전부 삭제된다.
--   롤백 전 반드시 백업하거나 아래로 공개 상태인 펫이 있는지 확인할 것.
--
--   SELECT COUNT(*) FROM pets WHERE is_public = 1;
--
--   이 count가 0이 아니면, 롤백 후 memorialService 가 다시 memorial_access_code
--   단독 판정으로 돌아가므로 해당 펫들의 공개 페이지 동작이 바뀔 수 있음을 인지할 것.
-- ==========================================================================
ALTER TABLE pets
  DROP COLUMN is_public,
  ALGORITHM=INSTANT;


-- ==========================================================================
-- [0] enums 파일 롤백
-- SQL 롤백과 별개로, shared/constants/enums.js / enums.ts 도 함께 되돌려야
-- SSOT가 유지된다 (CONSENT_TYPE 에서 'terms','marketing' 제거).
-- 이 파일은 SQL 전용이므로 enums 파일 롤백은 수동으로 git revert 하거나 직접 편집할 것.
-- ==========================================================================
