-- ==========================================================================
-- Migration: 2026-08-22-watch-tracking-and-ad-spend (DOWN / 롤백)
-- 순서: UP의 역순 (3 → 2 → 1-2/1-1/1)
-- ⚠️ 이 파일도 실행되지 않는다. 사용자가 직접, 아래 사전 확인 쿼리를 먼저 돌려본
--   뒤 실행한다.
-- ⚠️ 세 변경 모두 데이터 손실 가능성이 있다 - 아래 확인 절차 필수.
-- ==========================================================================

SET time_zone = '+09:00';


-- ==========================================================================
-- [3] photo_files.variant 컬럼 제거
-- ⚠️ 데이터 손실 주의: 세트 결과물의 종류 구분이 사라진다. 이 컬럼이 이미
--   코드에서 사용되고 있었다면(photoWorker가 기록, photoService가 조회) 롤백
--   즉시 세트 4종을 구분할 방법이 다시 없어진다 - s3_key 파일명 파싱 우회로
--   되돌아가야 하는데, 코드가 이미 컬럼 조회로 교체됐다면(README 4절 참고)
--   그 우회 코드 자체가 삭제되어 있을 수 있어 애플리케이션이 깨질 수 있다.
--
--   1) 롤백 전 반드시 먼저 확인:
--      SELECT COUNT(*) FROM photo_files WHERE variant IS NOT NULL;
--
--   2) 위 count가 0이 아니면, 이 컬럼에 이미 데이터가 쌓여 있다는 뜻이다.
--      롤백 전에 코드가 여전히 s3_key 파싱 우회(photoResultSet.parseVariantKey)를
--      쓰고 있는지, 아니면 이 컬럼 조회로 이미 교체됐는지부터 확인할 것. 교체된
--      상태라면 이 DOWN을 적용하기 전에 코드를 먼저 되돌리거나 배포를 중단해야
--      한다. 필요하면 먼저 백업할 것:
--      CREATE TABLE photo_files_variant_backup_20260822 AS
--        SELECT file_id, order_id, kind, s3_key, variant FROM photo_files;
--
--   3) 확인/백업 후에만 아래 실행 (컬럼 1개 DROP, ALGORITHM=INSTANT 가능 -
--      MySQL 8.0.29+/8.4. 이전 버전이면 ALGORITHM 절을 빼고 INPLACE로 폴백할 것):
-- ==========================================================================
ALTER TABLE photo_files
  DROP COLUMN variant,
  ALGORITHM=INSTANT;


-- ==========================================================================
-- [2] ad_spend 테이블 삭제
-- ⚠️ 데이터 손실 주의: 관리자가 입력한 광고비 이력이 전부 삭제된다. CAC 재계산이
--   영구히 불가능해진다(과거 데이터 소급 재입력 불가 - 12-analytics-plan.md와
--   동일한 문제).
--
--   1) 롤백 전 반드시 먼저 확인:
--      SELECT COUNT(*) FROM ad_spend;
--
--   2) 위 count가 0이 아니면 롤백 금지, 또는 아래로 백업 후에만 진행할 것:
--      CREATE TABLE ad_spend_backup_20260822 AS SELECT * FROM ad_spend;
--
--   3) 백업 확인 후에만 아래 실행:
-- ==========================================================================
DROP TABLE IF EXISTS ad_spend;


-- ==========================================================================
-- [1-1] will_beneficiaries 인덱스 제거
-- 영향: 세컨더리 인덱스 제거 - ALGORITHM=INPLACE, LOCK=NONE (무중단)
-- ==========================================================================
ALTER TABLE will_beneficiaries
  DROP INDEX idx_will_beneficiaries_expiry_watch,
  ALGORITHM=INPLACE, LOCK=NONE;


-- ==========================================================================
-- [1] will_beneficiaries 전달·열람 추적 + 토큰 만료 컬럼 제거 (컬럼 4개, ALTER 1문)
-- ⚠️ 데이터 손실 주의: 전달(발송) 시각·열람 시각·열람 횟수·토큰 만료 시각이
--   전부 삭제된다. 특히 [1-2] 백필로 계산된 token_expires_at, 그리고 서비스
--   코드가 이미 배포되어 있었다면 delivered_at/video_watched_at/watch_count에
--   실제 전달·열람 기록이 쌓여 있을 수 있다.
--
--   1) 롤백 전 반드시 먼저 확인:
--      SELECT COUNT(*) FROM will_beneficiaries WHERE delivered_at IS NOT NULL;
--      SELECT COUNT(*) FROM will_beneficiaries WHERE video_watched_at IS NOT NULL;
--      SELECT COUNT(*) FROM will_beneficiaries WHERE watch_count > 0;
--
--   2) 위 count 중 하나라도 0이 아니면, 실제 전달·열람 기록이 존재한다는
--      뜻이다. 롤백 시 이 이력이 전부 사라지며 SPEC-04 미열람 리마인드·관리자
--      검수 화면의 열람 현황·12-analytics-plan.md의 North Star 리드타임
--      (released_at → delivered_at → video_watched_at) 산출이 다시 판정
--      불가능 상태로 되돌아간다. 필요하면 먼저 백업할 것:
--      CREATE TABLE will_beneficiaries_watch_backup_20260822 AS
--        SELECT beneficiary_id, will_id, delivered_at, video_watched_at,
--               watch_count, token_expires_at
--        FROM will_beneficiaries;
--
--   3) 확인/백업 후에만 아래 실행 (컬럼 4개 DROP, ALGORITHM=INSTANT 가능 -
--      MySQL 8.0.29+/8.4에서 컬럼 삭제도 INSTANT 지원. 이전 버전이면
--      ALGORITHM 절을 빼고 INPLACE로 폴백할 것):
-- ==========================================================================
ALTER TABLE will_beneficiaries
  DROP COLUMN token_expires_at,
  DROP COLUMN watch_count,
  DROP COLUMN video_watched_at,
  DROP COLUMN delivered_at,
  ALGORITHM=INSTANT;


-- ==========================================================================
-- [0] enums 파일 롤백
-- 이 마이그레이션은 신규 ENUM을 추가하지 않았다(ad_spend.channel은 의도적으로
-- VARCHAR - up.sql 설계 판단 1 참고). shared/constants/enums.js / enums.ts 는
-- 이 마이그레이션으로 수정되지 않았으므로 롤백 시에도 손댈 것이 없다.
-- ==========================================================================
