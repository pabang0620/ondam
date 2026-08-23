-- ==========================================================================
-- Migration: 2026-08-23-consent-history-and-evidence (DOWN / 롤백)
-- ⚠️ 이 파일도 자동 실행되지 않는다. 사용자가 직접, 아래 사전 확인 쿼리를 먼저 돌려본 뒤 실행한다.
-- ⚠️ UNIQUE(user_id, consent_type) 복원은 append-only 전환 이후 유형당 2건 이상
--   쌓인 사용자가 있으면 즉시 실패한다(ADD UNIQUE는 기존 중복을 허용하지 않음).
-- ==========================================================================

SET time_zone = '+09:00';

-- 1) 롤백 전 반드시 먼저 확인 - 유형당 2건 이상(중복) 있는 (user_id, consent_type) 개수
--    SELECT user_id, consent_type, COUNT(*) AS cnt
--    FROM user_consents
--    GROUP BY user_id, consent_type
--    HAVING cnt > 1;
--
-- 2) 위 쿼리 결과가 1건이라도 있으면 이 UNIQUE 복원은 실행 불가능하다.
--    복원하려면 먼저 각 (user_id, consent_type)별로 최신 1건만 남기고 나머지를
--    별도 아카이브 테이블로 옮기거나 삭제해야 하는데, 이는 append-only로 전환한
--    목적(동의 이력 보존 - 법적 증빙) 자체를 훼손하는 파괴적 작업이다.
--    이 롤백은 "이번 마이그레이션 적용 직후, 아직 이력이 쌓이기 전"에만 안전하다.
--
-- 3) 위 확인에서 중복이 0건일 때만 아래 실행:
ALTER TABLE user_consents
  ADD UNIQUE KEY uq_consents_user_type (user_id, consent_type),
  ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE user_consents
  COMMENT='사용자 동의 현황 (user_id + consent_type 당 최신 1건 유지 - ON DUPLICATE KEY UPDATE)';

-- 참고: 코드도 함께 되돌려야 한다 - authService.saveConsents가 다시
-- authRepository.upsertConsent(ON DUPLICATE KEY UPDATE)를 사용하도록 복원할 것.
-- 이 파일은 SQL 전용이므로 코드 롤백은 git revert로 별도 수행할 것.
