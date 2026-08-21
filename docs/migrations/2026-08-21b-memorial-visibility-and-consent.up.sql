-- ==========================================================================
-- Migration: 2026-08-21b-memorial-visibility-and-consent (UP)
-- 목적: Phase 0 결함 수정 중 발견된 스키마 공백 2건 해소
--   1) pets.is_public 컬럼 부재 → 추모관 공개 정책(SPEC-03) 구현 불가
--   2) user_consents.consent_type ENUM에 'terms','marketing' 부재 → 동의 이력 미보존
--
-- ⚠️ 선행 조건: 이 파일은 2026-08-21-schema-drift-fix.up.sql 이 이미 적용된
--   상태를 전제로 한다 (pets.memorial_access_code 컬럼 존재 필요). 순서를
--   지키지 않으면 [1]의 AFTER memorial_access_code 절이 실패한다.
--   자세한 내용은 이 디렉토리의
--   2026-08-21b-memorial-visibility-and-consent.README.md 참조.
--
-- 실행 책임: 이 파일은 생성만 됨. 어떤 DB에도 자동 실행되지 않는다.
-- 반드시 사용자가 백업 확인 후 직접 실행한다.
-- ==========================================================================

-- [0] KST 타임존 세팅 (마이그레이션 실행 세션 보정)
SET time_zone = '+09:00';


-- ==========================================================================
-- [1] pets.is_public 컬럼 추가
-- 영향: NOT NULL DEFAULT 0 컬럼 추가 → ALGORITHM=INSTANT 가능 (MySQL 8.0.12+, 무락)
-- 근거: SPEC-03(2026-08-21 오너 확정) - 사람(고인) 추모 공간은 항상 비공개,
--   반려동물은 소유자가 공개/비공개를 선택할 수 있어야 한다. 그런데 pets 테이블에
--   공개 여부를 나타내는 컬럼이 없어 "공개 선택" 기능 자체를 구현할 수 없었다
--   (현재 임시 구현은 memorial_access_code 존재 여부로만 판단 - memorialService.js 참조).
--
-- ⚠️ DEFAULT 0(비공개)은 반드시 지켜야 한다. 이 마이그레이션 적용 시점에 이미
--   memorial_access_code 를 갖고 있던 기존 펫이라도, is_public 이 기본값으로
--   자동 1(공개)이 되면 소유자 의도와 무관하게 추모 페이지가 즉시 공개 전환되는
--   개인정보/유가족 정보 노출 사고가 된다. 공개 전환은 오직 소유자의 명시적 PATCH
--   액션으로만 이뤄져야 한다 - DEFAULT 를 1로 바꾸지 말 것 (README 참조).
-- ==========================================================================
ALTER TABLE pets
  ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '추모 페이지 공개 여부(SPEC-03). 1=공개(공유 가능), 0=비공개(소유자만).
기본값 0(비공개) 고정 - 마이그레이션/신규 생성 시 기존 행이 임의로 공개 전환되지
않도록 보장하기 위함. 오직 소유자의 명시적 PATCH(/api/pet/:petId)로만 1로 변경할 것.
사람(고인) 추모 공간에는 이 개념 자체가 없음(항상 비공개, 컬럼 없음).'
    AFTER memorial_access_code,
  ALGORITHM=INSTANT;

-- 참고: memorial_slug 는 이미 UNIQUE 제약(pets.memorial_slug VARCHAR(100) NULL UNIQUE)이
-- 걸려 있어 btree 인덱스가 이미 존재한다. slug 조회 성능을 위한 추가 인덱스는
-- 불필요 - 새 UNIQUE 인덱스를 추가하지 않았음 (soft delete 충돌 방지, 기존 방침 유지).


-- ==========================================================================
-- [2] user_consents.consent_type ENUM에 'terms', 'marketing' 추가
-- 영향: ENUM 값을 기존 값들 뒤에 추가 → ALGORITHM=INSTANT 가능 (MySQL 8.0.12+, 무락)
-- 근거: 프론트 회원가입(useJoin.js)이 'terms'(이용약관), 'marketing'(마케팅 수신)
--   동의를 함께 전송하지만 DB ENUM에 없어 authService.register 가 두 값을 저장
--   없이 버리도록 임시 처리되어 있었다(authService.js 71~76행 주석 참조).
--   이용약관·마케팅 수신 동의 이력 미보존은 전자상거래법·정보통신망법 관점에서
--   문제될 수 있음 - 특히 마케팅 수신 동의는 증빙 목적으로 이력이 필요하다.
-- ==========================================================================
ALTER TABLE user_consents
  MODIFY COLUMN consent_type
    ENUM('privacy','portrait','voice','ai_generation','posthumous_release','terms','marketing')
    NOT NULL,
  ALGORITHM=INSTANT;

-- shared/constants/enums.js / enums.ts 의 CONSENT_TYPE 동시 수정 완료
-- (이 마이그레이션과 함께 커밋됨 - 두 파일 값 100% 동일 확인)
