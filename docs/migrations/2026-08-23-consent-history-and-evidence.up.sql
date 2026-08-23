-- ==========================================================================
-- Migration: 2026-08-23-consent-history-and-evidence (UP)
-- 목적: 동의 검증 게이트 결함 수정 작업 중 발견된 스키마 문제 해소
--
--   user_consents는 (user_id, consent_type) UNIQUE 제약으로 "유형당 최신 1건만
--   유지"하도록 설계돼 있었다. authRepository.upsertConsent가 ON DUPLICATE KEY
--   UPDATE로 기존 행을 그 자리에서 덮어쓰면서 consent_id(UUID)까지 새 값으로
--   교체했다 - 이 때문에:
--     1) 철회 → 재동의 이력이 전혀 남지 않는다(동의는 이력 자체가 법적 증빙인데,
--        "지금 상태"만 남고 "언제 무엇에 동의/철회했는지"의 변천사가 사라진다).
--     2) voice_samples.consent_id가 그 시점에 유효했던 consent_id를 저장해 두는데,
--        나중에 사용자가 같은 유형으로 다시 동의/철회하면 upsertConsent가 그
--        UUID를 다른 값으로 바꿔버려 voice_samples.consent_id가 이제 존재하지
--        않는 UUID를 가리키게 된다("이 음성 클론은 어느 동의에 근거했는가"를
--        사후 추적 불가).
--
-- 해결: UNIQUE(user_id, consent_type) 제거 → append-only(동의 행위마다 새 행
--   INSERT, UPDATE 금지)로 전환. 이제 동의/철회/재동의는 각각 별도 행으로
--   영구 보존되고, 최신 상태는 `ORDER BY agreed_at DESC, id DESC LIMIT 1`로
--   조회한다(이미 존재하는 idx_consents_user (user_id, consent_type, agreed_at
--   DESC) 인덱스가 이 조회를 그대로 커버 - 추가 인덱스 불필요).
--   과거에 발급된 consent_id는 다시는 다른 값으로 바뀌지 않으므로
--   voice_samples.consent_id 참조가 더 이상 끊어지지 않는다.
--
-- 영향: UNIQUE 인덱스 제거 - ALGORITHM=INSTANT 불가(인덱스 제거는 INPLACE),
--   LOCK=NONE으로 온라인 처리 가능(읽기/쓰기 차단 없음). 기존 데이터는
--   그대로 유지되며 삭제되는 행이 없다(제약 완화이므로 무손실).
--
-- 코드 변경 동반(같은 작업 범위, 별도 PR 아님):
--   - authRepository.upsertConsent 제거, saveConsents가 createConsent(append-only,
--     ip_address/user_agent 기록)를 사용하도록 authService.js 변경
--   - findVoiceConsent 등 조회 함수에 `ORDER BY agreed_at DESC, id DESC` 적용
--     (동일 초 내 복수 이력 발생 시 결정적 최신 판정)
--
-- 실행 책임: 이 파일은 문서화 목적의 기록이다. 이번 작업에서는 로컬 개발 DB
-- (ondam, root/1234)에 대해 아래 ALTER를 이미 직접 실행했다(운영 DB 아님,
-- 실사용자 없음 - 소급 적용 판단은 완료 보고서 참고). 운영 배포 시에는
-- 반드시 백업 확인 후 이 파일을 재적용할 것.
-- ==========================================================================

SET time_zone = '+09:00';

ALTER TABLE user_consents
  DROP INDEX uq_consents_user_type,
  ALGORITHM=INPLACE, LOCK=NONE;

-- 테이블 COMMENT 갱신 (append-only로 설계 의도가 바뀌었음을 스키마 자체에 기록)
ALTER TABLE user_consents
  COMMENT='사용자 동의 이력 (append-only - 동의/철회/재동의마다 새 행 INSERT,
UPDATE 금지. 최신 상태는 user_id+consent_type 기준 agreed_at DESC, id DESC
LIMIT 1로 조회. 2026-08-23 이전에는 (user_id,consent_type) UNIQUE로 최신 1건만
유지했으나, 동의 이력 보존·voice_samples.consent_id 참조 안정성을 위해 append-only로
전환)';
