-- ==========================================================================
-- Migration: 2026-08-22-watch-tracking-and-ad-spend (UP)
-- 목적: 스키마 공백 3건 해소
--   1) will_beneficiaries 열람 추적·전달 컬럼 부재 → SPEC-05(영상 편지 열람 추적),
--      SPEC-04(미열람 리마인드), 관리자 검수 화면의 열람 현황, 12-analytics-plan.md
--      이벤트#49(delivery_sent)·North Star 리드타임 산출이 전부 구현 불가
--   2) ad_spend 테이블 부재 → CAC(고객획득비용) 산출이 원천적으로 불가
--      (docs/strategy/12-analytics-plan.md 8-1절 P0 지정)
--   3) photo_files에 세트 결과물 4종을 구분할 컬럼 부재 → 구현 에이전트가
--      s3_key 파일명 접미사(result_<variant>.jpg)를 파싱하는 우회로 임시 처리
--      (photoResultSet.js 1~11행에 "workaround, not a clean fix"로 명시,
--      스키마 마이그레이션 권고) → 컬럼 신설로 해소
--
-- [1]에 delivered_at을, [3]에 photo_files.variant를 함께 포함한 이유
-- (조정 반영, 2026-08-22):
--   마이그레이션 a·b·c가 아직 전부 미적용 상태이고, 스키마 변경이 필요한 항목이
--   나올 때마다 별도 d, e 마이그레이션으로 미루면 사용자가 그때마다 백업·적용을
--   추가로 거쳐야 한다. 같은 테이블(will_beneficiaries)에는 ALTER를 1회로
--   합치고, 이번 c 전체를 아직 적용 전인 지금 시점에 필요 항목을 모아 처리한다.
--
-- ⚠️ 적용 순서 엄수: a → b → c (이 파일이 c)
--   a) docs/migrations/2026-08-21-schema-drift-fix.up.sql                       (미적용 상태로 확인됨)
--   b) docs/migrations/2026-08-21b-memorial-visibility-and-consent.up.sql       (미적용 상태로 확인됨)
--   c) docs/migrations/2026-08-22-watch-tracking-and-ad-spend.up.sql (이 파일)
--   이 파일은 a, b가 건드리는 컬럼(memorial_access_code, is_public,
--   consent_type ENUM 등)을 직접 참조하지 않으므로 기술적 선행 의존은 없지만,
--   프로젝트 마이그레이션 순번 규칙(날짜순 적용)과 README 안내를 따라 반드시
--   a → b → c 순서로 적용할 것. 자세한 내용은 이 디렉토리의
--   2026-08-22-watch-tracking-and-ad-spend.README.md 참조.
--
-- 실행 책임: 이 파일은 생성만 됨. 어떤 DB에도 자동 실행되지 않는다.
-- 반드시 사용자가 백업 확인 후 직접 실행한다.
-- ==========================================================================

-- [0] KST 타임존 세팅 (마이그레이션 실행 세션 보정 - 커넥션 풀 초기화와 별개로 수동 실행 시 필요)
SET time_zone = '+09:00';


-- ==========================================================================
-- [1] will_beneficiaries 전달·열람 추적 + 토큰 만료 컬럼 추가 (컬럼 4개, ALTER 1문)
-- 영향: NULL 허용 컬럼 3개 + DEFAULT 있는 NOT NULL 컬럼 1개 추가 → 전부 같은
--   ALTER 문에 합쳐 ALGORITHM=INSTANT 가능 (MySQL 8.0.12+/8.4, 무락, 잠금 1회).
--
-- 근거 및 구조 확인 결과:
--   SPEC-05(영상 편지 열람·만료·재발송)는 video_token/video_watched_at/watch_count가
--   "기존 컬럼"이라고 서술했으나 ondam_schema.sql 실측 결과 셋 다 존재하지 않는다.
--   존재하는 것은 invite_token(초대 링크 토큰) 뿐이다.
--
--   백엔드 코드(willRepository.findBeneficiaryByToken, willService.getWatchUrl)를
--   확인한 결과 will_beneficiaries는 **이미 수신인(beneficiary) 1행 = 1명** 구조이고,
--   invite_token은 초대 수락뿐 아니라 영상 시청 링크(/api/will/watch/:token →
--   getWatchUrl(token) → findBeneficiaryByToken(token))에도 **그대로 재사용되고
--   있다.** 즉 수신인별 개별 토큰은 이미 존재한다.
--
--   → 판단: 별도 video_token 컬럼을 신설하지 않는다. invite_token 하나로
--     "초대"와 "시청"을 겸하는 기존 설계를 유지하고, 열람 추적·만료 컬럼만
--     will_beneficiaries에 추가한다. SPEC-05의 "video_token" 표현은 이 리네이밍
--     없이 invite_token을 가리키는 것으로 재해석해야 한다 (README 3절 참고).
--
--   getWatchUrl()은 현재 release_status만 검사하고 토큰 만료를 전혀 검사하지
--   않는다 - token_expires_at이 없으면 SPEC-05가 요구하는 "90일 후 만료" 자체를
--   구현할 방법이 없었다.
--
--   delivered_at 의미 확정 (12-analytics-plan.md 재확인, README 3-1절 참고):
--   - 문서 165~171행(2-8절, 이벤트#49 `delivery_sent`)이 정의를 명시한다:
--     "수신인별 전달 발송" / "`will_beneficiaries`에 발송 시각 컬럼 없음 →
--     `delivered_at` 추가 필요". 즉 **관리자 승인 시각도 아니고(그건
--     will_release_requests.reviewed_at), 최초 열람 시각도 아니다(그건
--     video_watched_at) - "유가족에게 알림(이메일/SMS)이 실제로 발송된 시각"이다.**
--   - 코드 근거: adminService.approveRelease가 관리자 승인 직후 수신인별로
--     루프를 돌며 notificationQueue.add(이메일/SMS)를 호출하는 지점이 이미
--     존재한다(수신인당 1회). 이 루프 안에서 delivered_at을 기록하는 것이
--     이벤트#49의 정의와 정확히 일치한다 (README 4절 6번, 후속 코드 작업).
--   - 508행(P1 목록)의 "사후 전달 개시 전까지만 완료하면 됨"이라는 표현도
--     "발송 기능 자체가 가동되기 전까지 컬럼만 준비돼 있으면 된다"는 뜻이라
--     이 해석과 상충하지 않는다.
-- ==========================================================================
ALTER TABLE will_beneficiaries
  ADD COLUMN delivered_at DATETIME NULL
    COMMENT '수신인별 전달(발송) 시각(SPEC-05, 12-analytics-plan.md 이벤트#49
delivery_sent). 관리자 승인 시각(will_release_requests.reviewed_at)도 최초 열람
시각(video_watched_at)도 아니다 - 유가족에게 알림(이메일/SMS)이 실제로 발송된
시각. adminService.approveRelease의 수신인별 알림 발송 루프에서 기록할 것(README
4절). North Star 리드타임(released_at → delivered_at → video_watched_at) 산출에
필요.'
    AFTER verified_at,
  ADD COLUMN video_watched_at DATETIME NULL
    COMMENT '영상 편지 최초 열람 시각(SPEC-05). NULL이면 미열람 - SPEC-04 미열람
리마인드 배치의 판정 기준.'
    AFTER delivered_at,
  ADD COLUMN watch_count INT UNSIGNED NOT NULL DEFAULT 0
    COMMENT '영상 편지 열람 횟수(SPEC-05). getWatchUrl 호출 시마다 +1 증가시킬 것 -
관리자 검수 화면의 열람 현황 표시에도 사용.'
    AFTER video_watched_at,
  ADD COLUMN token_expires_at DATETIME NULL
    COMMENT 'invite_token(=시청 링크 토큰) 만료 시각(SPEC-05, 90일 정책). NULL =
아직 만료 정책이 적용되지 않음(유언장 미공개 상태 등). wills.released_at 기준
+90일로 설정하고, 연장 요청 시 재발급하며 갱신할 것. 만료 검사는 getWatchUrl에서
반드시 수행해야 한다(현재 미검사 - 후속 코드 작업 필요, README 4절 참고).'
    AFTER watch_count,
  ALGORITHM=INSTANT;


-- ==========================================================================
-- [1-1] 만료 임박/미열람 조회용 인덱스 추가
-- 영향: 세컨더리 인덱스 추가 - ALGORITHM=INSTANT 미지원, INPLACE+LOCK=NONE으로
--   온라인 처리(읽기/쓰기 차단 없음, 백그라운드 인덱스 빌드).
-- 근거: SPEC-04 미열람 리마인드 배치가 "만료 7일 전 + 미열람" 조건으로 스캔해야
--   하는데 인덱스가 없으면 will_beneficiaries 풀스캔이 된다.
-- ==========================================================================
ALTER TABLE will_beneficiaries
  ADD INDEX idx_will_beneficiaries_expiry_watch (token_expires_at, video_watched_at),
  ALGORITHM=INPLACE, LOCK=NONE;


-- ==========================================================================
-- [1-2] 데이터 백필 - 이미 공개된 유언장의 수신인에게 만료일 소급 부여
-- 영향: DML(UPDATE) - DDL이 아니므로 암묵적 COMMIT 없음, 트랜잭션 내 실행 가능.
--   JOIN 대상 행에만 행 단위 락이 걸리며 테이블 전체를 막지 않는다.
--   WHERE 절에 token_expires_at IS NULL 가드가 있어 **재실행해도 안전(idempotent)**.
--
-- 근거: token_expires_at을 전부 NULL로 둔 채 서비스 코드만 배포하면, 이미
--   release_status='released' 상태로 오래 전에 공개된 유언장의 수신인은 "만료일이
--   없다"는 상태로 남아 정책이 소급 적용되지 않는다(신규 공개 건만 만료가 걸리는
--   불공평/누락 상태). SPEC-05 정책(released_at + 90일)을 기존 공개 건에도 동일하게
--   적용하기 위해 이 시점에 한 번 소급 계산한다.
--
-- 주의: 이 UPDATE로 인해 이미 공개된 지 90일이 지난 유언장의 수신인은 즉시
--   "만료된" 상태가 될 수 있다. 하지만 코드가 아직 배포되지 않아 만료 검사 로직
--   자체가 없으므로 이 마이그레이션 단독 적용으로는 시청이 막히지 않는다.
--   README 4절의 "적용 후 필요한 코드 작업"(getWatchUrl 만료 검사 추가)을 배포할
--   때 이미 만료된 것으로 계산된 기존 수신인이 있는지 반드시 먼저 확인할 것:
--     SELECT COUNT(*) FROM will_beneficiaries
--       WHERE token_expires_at IS NOT NULL AND token_expires_at < NOW()
--         AND video_watched_at IS NULL AND deleted_at IS NULL;
--   0이 아니면 코드 배포 전 해당 수신인에게 연장 안내를 먼저 보내는 것을 권장.
-- ==========================================================================
UPDATE will_beneficiaries wb
  INNER JOIN wills w ON wb.will_id = w.will_id
SET wb.token_expires_at = DATE_ADD(w.released_at, INTERVAL 90 DAY)
WHERE w.release_status = 'released'
  AND w.released_at IS NOT NULL
  AND wb.token_expires_at IS NULL
  AND wb.deleted_at IS NULL;

-- 참고: delivered_at은 의도적으로 백필하지 않는다. will_release_requests.reviewed_at을
-- 대리값으로 채워 넣는 방법도 검토했으나(승인 직후 동기적으로 알림 발송 루프가
-- 돌아가므로 시간상 근접), 이는 "실제 발송 시각"이 아니라 "근사값"이며 발송이
-- 실패했을 수도 있는 건(notifyErr catch 분기 참고, adminService.approveRelease)까지
-- 마치 발송된 것처럼 채우게 된다. 리드타임 지표에 부정확한 값을 사실처럼 채워
-- 넣는 것이 컬럼을 비워두는 것보다 나쁘다고 판단해 백필하지 않았고, 이 컬럼은
-- 이 마이그레이션 이후 새로 승인되는 건부터만 정확한 값을 갖는다.


-- ==========================================================================
-- [2] ad_spend 테이블 신규 생성
-- 영향: 신규 테이블 생성 - 기존 테이블 락 없음.
--
-- 근거: docs/strategy/12-analytics-plan.md 2-10절, 8-1절(P0) -
--   "이 테이블이 없으면 CAC는 영원히 산출 불가". 09-unit-economics.md의 BEP
--   판정식(CAC < CM_photo 등)도 CAC 실측값을 전제로 한다.
--
-- 설계 판단:
--   1) channel을 ENUM이 아닌 VARCHAR(50)로 설계했다. 이 프로젝트는 이미 ENUM
--      확장 마이그레이션을 2건(a, b) 거쳤고 광고 채널은 마케팅팀 재량으로
--      수시로 늘어난다(현재 문서상 meta/youtube/community/partner 4종이 확인되나
--      네이버/카카오/틱톡 등 추가 가능성이 높음). 채널 하나 늘 때마다 ALTER가
--      필요한 ENUM은 이 프로젝트가 겪은 ENUM drift 패턴(2026-08-21-schema-drift-fix,
--      2026-08-21b)을 반복할 위험이 있어 VARCHAR를 선택했다. 오탈자 방지는
--      서비스 레이어(관리자 입력 화면의 select/autocomplete + 화이트리스트 검증)에서
--      담당한다.
--   2) (channel, period_start, period_end) UNIQUE는 걸지 않는다. 12-analytics-plan.md가
--      "기간이 걸친 광고비는 일할 안분한다"고 명시하는데, 이는 관리자가 같은
--      채널에 대해 서로 다른(때로는 겹치는) 기간의 집행 내역을 여러 건 입력할 수
--      있다는 뜻이다(예: 월 단위 대략 입력 후 특정 주간 캠페인을 별도 행으로 추가
--      입력). CAC 계산은 여러 행을 SUM하는 것을 전제로 하므로 UNIQUE로 막으면
--      정상적인 입력 시나리오가 깨진다.
--   3) 금액은 이 프로젝트 기존 컨벤션(payments.amount_krw, subscription_plans.price_krw
--      등)을 따라 DECIMAL이 아닌 INT UNSIGNED + `_krw` 접미사로 통일했다. 원화는
--      소수점 단위가 없어 이 프로젝트 전역에서 이미 INT UNSIGNED로 일관 사용 중이다.
--   4) FK를 사용하지 않는다(스키마 전체 방침 - FOREIGN KEY 0건). recorded_by는
--      admin_users.admin_id(UUID)를 애플리케이션 레벨에서 참조한다.
--   5) 상태 머신이 아니므로(원칙 4의 "상태 머신 엔티티" 해당 없음 - 단순 관리자
--      수기 입력 레코드) 별도 ad_spend_logs 테이블은 만들지 않는다. 수정 이력이
--      필요해지면 그때 별도 로그 테이블을 추가한다(현재 요구사항 범위 밖).
--   6) period_end >= period_start를 CHECK 제약으로 강제한다. 이 프로젝트
--      스키마 전체에 CHECK 제약 선례는 없으나(관리자 수기 입력이라 오탈자
--      리스크가 상대적으로 높고, 신규 테이블이라 기존 데이터와 충돌 여지가
--      없어) 이 테이블에 한해 도입했다. 문제가 되면 이 CHECK만 별도 마이그레이션
--      으로 제거 가능.
-- ==========================================================================
CREATE TABLE IF NOT EXISTS ad_spend (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ad_spend_id       CHAR(36) NOT NULL UNIQUE COMMENT 'UUID',

  channel           VARCHAR(50) NOT NULL
    COMMENT '광고 채널 (예: meta, youtube, community, partner). ENUM이 아닌
VARCHAR - 신규 채널 추가 시 ALTER 불필요(위 설계 판단 1 참고). 유효값 화이트리스트는
서비스 레이어에서 관리.',
  period_start      DATE NOT NULL COMMENT '집행 기간 시작일(포함)',
  period_end        DATE NOT NULL COMMENT '집행 기간 종료일(포함). period_start와
같으면 단일 일자 집행. CAC 계산 시 이 기간을 일 단위로 안분한다(12-analytics-plan.md 3-5절).',
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
-- [3] photo_files.variant 컬럼 추가 (세트 결과물 4종 구분)
-- 영향: NULL 허용 컬럼 1개 추가 → ALGORITHM=INSTANT 가능 (MySQL 8.0.12+/8.4, 무락)
--
-- 근거: `backend/src/domains/photo/photoResultSet.js`(1~11행)를 읽어 확인한 결과,
--   사진관 "주문 1건 = 결과물 4종 세트"(SPEC-08 결정1)가 이미 구현됐는데
--   `photo_files.kind`가 `ENUM('raw','enhanced')` 2개뿐이라 세트 내 4종을 구분할
--   컬럼이 없었다. 구현 에이전트는 스키마 변경이 금지된 상태에서 전 세트 항목을
--   `kind='enhanced'`로 저장하고, variant를 `s3_key` 파일명 접미사
--   (`result_<variant>.jpg`)에 인코딩한 뒤 `photoResultSet.parseVariantKey`로
--   되돌려 파싱하는 우회를 썼다. 그 파일 자체가 "workaround, not a clean fix"로
--   명시하며 스키마 마이그레이션을 권고하고 있다.
--   파일명에 의미를 인코딩하는 방식은 S3 키 규칙이 바뀌거나 파일명이 달라지면
--   조용히 깨지고(파싱 실패해도 예외를 던지지 않고 null을 반환하므로 라벨/정렬
--   정보가 조용히 사라진다), SQL로 특정 variant만 필터링하는 것도 불가능하다.
--
-- 실제 variant 키 확인 (photoResultSet.js VARIANT_DEFS, 이 파일이 SSOT):
--   restore_auto(복원본, 자동 컬러화) / restore_only(원본 색감 유지본) /
--   id_crop(증명·영정 규격본) / suit(정장 합성본)
--
-- 설계 판단:
--   1) ENUM이 아닌 VARCHAR(30)로 설계했다. `ad_spend.channel`에서 이미 같은
--      판단을 했고(README 참고), 일관성을 위해 동일 원칙을 적용한다. 세트
--      구성(SPEC-08)은 상품 기획에 따라 바뀔 여지가 크다 - 이미 photoResultSet.js
--      주석(13~24행)이 "4종 조합을 의미 있게 고른 이유"를 상세히 설명할 정도로
--      기획 판단이 개입된 영역이라, 항목이 추가/변경될 때마다 ENUM ALTER가
--      필요해지는 것을 피한다(2026-08-21-schema-drift-fix, 2026-08-21b에서 겪은
--      ENUM drift 패턴 반복 방지). 유효값 검증은 `photoResultSet.js`의
--      `VARIANT_DEFS`(애플리케이션 레벨 SSOT)가 계속 담당한다.
--   2) NULL 허용. 세트 도입 이전에 생성된 기존 주문의 결과 파일과, `kind='raw'`
--      (원본) 행에는 variant 개념 자체가 없다 - 이 두 경우는 계속 NULL로 둔다.
--   3) 기존 행 백필은 하지 않는다. 세트 도입 이전 주문(`kind='enhanced'`인
--      레거시 단일 처리 결과)은 애초에 "세트의 일부"가 아니므로 되돌려 채울
--      variant 값 자체가 없다 - 억지로 채우면 존재하지 않았던 의미를 사후에
--      부여하는 것이 된다. 세트 도입 이후 파일명에 이미 인코딩된 행(마이그레이션
--      적용 시점까지 쌓인 우회 방식 데이터)에 한해서는 `parseVariantKey(s3_key)`
--      결과로 채우는 것이 기술적으로 가능하지만, 이 마이그레이션(SQL 파일)
--      단계에서 자동 실행하지 않는다 - 파일명 파싱 로직 자체가 우회이므로 SQL
--      마이그레이션에 파싱 정규식을 이식하면 같은 문제를 한 겹 더 감추는 것이다.
--      코드 배포 시점에 `photoService`/일회성 스크립트에서 `parseVariantKey`를
--      재사용해 백필할지는 후속 코드 작업으로 별도 판단할 것(README 4절 참고).
--   4) 인덱스는 추가하지 않는다. `photoRepository.findFilesByOrderId`가
--      `WHERE order_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`로
--      조회하며 이는 기존 `idx_photo_files_order (order_id, kind)`로 이미
--      커버된다. variant별 정렬(`photoService.getResult`의 `sortedFiles`)은
--      SQL이 아니라 애플리케이션 레벨(JS `.sort()`)에서 처리되고, 주문 1건당
--      결과 파일은 최대 5행(raw 1 + 세트 4)뿐이라 인메모리 정렬 비용이 무의미
--      하다. 현재 어떤 쿼리도 `WHERE variant = ?`나 `ORDER BY variant`를 SQL
--      레벨에서 수행하지 않는다. 추후 관리자 분석 화면에서 "이번 달 suit
--      변형 실패율" 같은 전체 테이블 집계 쿼리가 필요해지면 그때
--      `(kind, variant, deleted_at)` 복합 인덱스 추가를 검토한다(현재는 YAGNI).
-- ==========================================================================
ALTER TABLE photo_files
  ADD COLUMN variant VARCHAR(30) NULL
    COMMENT '세트 결과물 종류(SPEC-08 결정1). photoResultSet.js VARIANT_DEFS가
정의 SSOT: restore_auto(복원본,자동 컬러화)/restore_only(원본 색감 유지본)/
id_crop(증명·영정 규격본)/suit(정장 합성본). NULL = 세트 도입 이전 주문 또는
kind=raw(원본, variant 개념 없음). kind ENUM(raw/enhanced)은 그대로 유지 -
variant는 그 위에 얹히는 별도 축(세트 내 어떤 변형인지). ENUM 대신 VARCHAR로
설계한 이유는 ad_spend.channel과 동일(README 참고) - 세트 구성이 상품 기획에
따라 자주 바뀔 수 있어 ENUM 확장 ALTER를 피함.'
    AFTER kind,
  ALGORITHM=INSTANT;
