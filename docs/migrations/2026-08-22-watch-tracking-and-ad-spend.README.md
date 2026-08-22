# 2026-08-22 열람 추적 컬럼 + ad_spend(광고비) 테이블 + photo_files.variant 신설

> **[2026-08-22] `ondam_schema.sql`에 통합됨.** 신규 DB는 이 마이그레이션을 실행하지
> 말고 `ondam_schema.sql`만 실행할 것. 이 파일은 이미 존재하는 DB가 있을 경우에만
> 유효(현재 해당 없음 - ondam DB는 아직 생성된 적이 없다).

> **이 디렉토리의 SQL 파일은 어디에도 자동 실행되지 않았다.** 파일 생성만 완료된
> 상태다. 실행은 전적으로 사용자 몫이다 - 반드시 DB 백업을 먼저 확인한 뒤 직접
> 실행할 것. (db-schema-architect는 운영 DB에 대한 ALTER 실행 권한을 갖지 않는다.)

SPEC-05(영상 편지 열람·만료·재발송)가 "기존 컬럼"이라 서술한 열람 추적 컬럼이
실제로는 존재하지 않는 문제, `docs/strategy/12-analytics-plan.md`가 P0로 지정한
`ad_spend`(CAC 산출용 광고비 입력) 테이블 부재 문제, 같은 문서가 P0로 지정한
`will_beneficiaries.delivered_at`(전달 발송 시각, 이벤트#49) 부재 문제, 그리고
사진관 세트 결과물 4종을 구분할 컬럼이 없어 `s3_key` 파일명 파싱으로 우회
중이던 `photo_files.variant` 부재 문제를 이 마이그레이션으로 함께 해소한다.

> **[2026-08-22 추가 반영 1]** 최초 설계 시 `delivered_at`은 범위 밖으로 분류했으나,
> 마이그레이션 a·b·c가 아직 전부 미적용 상태이고 같은 `will_beneficiaries`
> 테이블에 이미 ALTER를 거는 김에 한 ALTER 문으로 합쳐 잠금 횟수를 늘리지 않기
> 위해 이번 c에 포함시켰다(3-1절 참고). 별도 d 마이그레이션으로 미루면 사용자가
> 백업·적용을 한 번 더 거쳐야 하는 비용이 있었다.
>
> **[2026-08-22 추가 반영 2]** 사진관 "주문 1건 = 결과물 4종 세트"(SPEC-08 결정1)
> 구현 중 `photo_files.kind ENUM('raw','enhanced')`만으로는 세트 4종을 구분할
> 수 없어, 구현 에이전트가 s3_key 파일명 접미사에 variant를 인코딩하는 우회를
> 쓰고 "workaround, not a clean fix"로 명시하며 스키마 마이그레이션을 권고했다.
> 마이그레이션 c가 아직 미적용이라 지금 넣으면 적용 횟수가 늘지 않아 이번 c에
> `photo_files.variant` 컬럼을 포함시켰다(3-2절 참고).

---

## 파일 목록

| 파일 | 내용 |
|---|---|
| `2026-08-22-watch-tracking-and-ad-spend.up.sql` | `will_beneficiaries`에 전달·열람 추적·토큰 만료 컬럼 4개(`delivered_at`, `video_watched_at`, `watch_count`, `token_expires_at`)를 **단일 ALTER 문**으로 추가 + 인덱스 + 소급 백필, `ad_spend` 테이블 신규 생성, `photo_files.variant` 컬럼 추가 |
| `2026-08-22-watch-tracking-and-ad-spend.down.sql` | 위 UP의 롤백. 데이터 손실 사전 확인 절차 포함 (자동 실행 안 됨) |
| `2026-08-22-watch-tracking-and-ad-spend.README.md` | 이 파일 |

---

## 1. 적용 순서 (중요) - a → b → c 엄수

**이 저장소에는 현재 미적용 마이그레이션이 이미 2건 있다.** 이 파일(c)까지
포함하면 총 3건이며, 반드시 **날짜순(a → b → c)** 으로 적용해야 한다.

| 순서 | 파일 | 상태 (실측) |
|---|---|---|
| a | `docs/migrations/2026-08-21-schema-drift-fix.up.sql` | **미적용** |
| b | `docs/migrations/2026-08-21b-memorial-visibility-and-consent.up.sql` | **미적용** |
| c | `docs/migrations/2026-08-22-watch-tracking-and-ad-spend.up.sql` (이 파일) | 신규 생성 |

이 파일(c)은 a·b가 건드리는 컬럼(`pets.memorial_access_code`, `pets.is_public`,
`user_consents.consent_type` ENUM)을 직접 참조하지 않으므로 **기술적으로는
독립 실행이 가능**하다. 하지만:
- 이 프로젝트의 마이그레이션 적용 규칙은 날짜순이다. a, b를 건너뛰고 c만
  적용하면 이후 a, b를 적용할 때 "이미 최신인데 옛 마이그레이션을 적용해도
  되는가"라는 혼란이 생긴다.
- a는 `ai_jobs.target_type`, `photo_orders.photo_type` ENUM 확장과
  `subscriptions` 빌링키 NULL 허용 등 이미 코드가 전제하고 있는 컬럼을
  포함한다 - 먼저 적용하지 않으면 다른 기능이 여전히 깨진 상태다.

순서:
1. **DB 전체 백업** (mysqldump 등) - 백업 없이 절대 진행하지 말 것
2. `2026-08-21-schema-drift-fix.up.sql` 적용 (a)
3. `2026-08-21b-memorial-visibility-and-consent.up.sql` 적용 (b)
4. `2026-08-22-watch-tracking-and-ad-spend.up.sql` 적용 (c, 이 파일)
5. 스테이징/개발 DB에서 먼저 실행 → 애플리케이션 동작 확인 후 운영 적용
6. 운영 적용 시 트래픽이 낮은 시간대 권장
7. 실행 후 아래 "검증 쿼리"로 반영 여부 확인
8. 문제 발생 시 각 파일의 `down.sql`을 **적용 역순(c → b → a)**으로 참조 -
   단 데이터 손실 가능 구간은 전부 사전 확인 쿼리를 먼저 돌려본 뒤 진행할 것

---

## 2. 각 변경사항 상세 + ALTER 잠금 주의

### [1] `will_beneficiaries`에 컬럼 4개 추가 (단일 ALTER 문)
- `delivered_at DATETIME NULL`, `video_watched_at DATETIME NULL`,
  `watch_count INT UNSIGNED NOT NULL DEFAULT 0`, `token_expires_at DATETIME NULL`
- 4개 컬럼 모두 **같은 `ALTER TABLE` 문 안에 `ADD COLUMN` 4절로 합쳐 잠금을
  1회만** 건다(추가 지시 반영 - 별도 ALTER로 쪼개면 짧더라도 메타데이터 락이
  N번 걸린다).
- **알고리즘**: `ALGORITHM=INSTANT` (MySQL 8.0.12+/8.4, DEFAULT 있는 컬럼 추가는
  무락)

### [1-1] 인덱스 추가 `idx_will_beneficiaries_expiry_watch (token_expires_at, video_watched_at)`
- **알고리즘**: `ALGORITHM=INPLACE, LOCK=NONE` (온라인 인덱스 빌드, INSTANT
  미지원 - 세컨더리 인덱스 추가는 항상 INPLACE)
- SPEC-04 미열람 리마인드 배치의 스캔 조건(만료 임박 + 미열람)을 지원

### [1-2] 데이터 백필 (DML, DDL 아님)
- 이미 `release_status='released'`인 유언장의 수신인에게
  `wills.released_at + 90일`을 소급 계산해 `token_expires_at`에 채운다.
- `WHERE token_expires_at IS NULL` 가드로 **재실행해도 안전**(idempotent).
- ⚠️ 이 UPDATE만으로는 시청이 막히지 않는다. 만료 검사 로직 자체가 아직
  코드에 없기 때문이다(아래 4절 1번 참고). 하지만 코드 배포 시점에는 이미
  "만료된 것으로 계산된" 기존 수신인이 있을 수 있으므로, 코드 배포 직전에
  반드시 아래 쿼리로 확인할 것:
  ```sql
  SELECT COUNT(*) FROM will_beneficiaries
    WHERE token_expires_at IS NOT NULL AND token_expires_at < NOW()
      AND video_watched_at IS NULL AND deleted_at IS NULL;
  ```
  0이 아니면 만료 검사 코드를 배포하기 전에 해당 수신인에게 연장 안내를
  먼저 보내는 것을 권장한다.
- ⚠️ `delivered_at`은 **의도적으로 백필하지 않는다.** `will_release_requests.reviewed_at`
  을 근사값으로 채워 넣는 방법도 검토했으나, 이는 "실제 발송 시각"이 아니라
  근사값이고 발송이 실패했을 수도 있는 건까지 발송된 것처럼 채우게 된다.
  부정확한 값을 사실처럼 채우는 것이 컬럼을 비워두는 것보다 나쁘다고 판단했다
  (up.sql `[1-2]` 하단 주석 참고). 즉 이 마이그레이션 적용 이전에 이미
  공개된 유언장의 수신인은 `delivered_at`이 계속 `NULL`로 남으며, 이 마이그레이션
  이후 새로 승인되는 건부터만 정확한 값을 갖는다.

### [2] `ad_spend` 테이블 신규 생성
- 신규 테이블이므로 기존 테이블에 대한 락 없음.

### [3] `photo_files`에 `variant VARCHAR(30) NULL` 컬럼 추가
- **알고리즘**: `ALGORITHM=INSTANT` (MySQL 8.0.12+/8.4, NULL 허용 컬럼 추가는 무락)
- `kind` ENUM은 건드리지 않는다 - `raw`/`enhanced` 구분은 그대로 유효하고,
  `variant`는 `enhanced` 행 위에 얹히는 별도 축(세트 내 어떤 변형인지)이다.
- 3-2절에 구조 확인·타입 판단 상세를 정리했다.

### 운영 적용 시 공통 주의
- [1], [1-1], [3]은 무락 수준이지만 DDL은 MySQL에서 **암묵적 COMMIT**을 유발하므로
  트랜잭션 롤백이 불가능하다. 하나씩 실행하고 실행 직후 검증 쿼리로 확인하는
  방식을 권장한다.
- [1-2]는 DML이라 명시적 트랜잭션으로 감싸 실행 가능하다. 대량 UPDATE라면
  실행 전 영향받는 행 수를 먼저 확인할 것:
  ```sql
  SELECT COUNT(*) FROM will_beneficiaries wb
    INNER JOIN wills w ON wb.will_id = w.will_id
    WHERE w.release_status = 'released' AND w.released_at IS NOT NULL
      AND wb.token_expires_at IS NULL AND wb.deleted_at IS NULL;
  ```

---

## 3. `will_beneficiaries` 구조 확인 결과 + `video_token` 신설 여부 판단

**확인 결과: `will_beneficiaries`는 이미 수신인(beneficiary) 1행 = 1명 구조다.**
`beneficiary_id`가 UNIQUE PK 성격의 UUID이고, 초대 발송 대상 1명당 1행이
생성된다(`willRepository.createBeneficiary`/벌크 INSERT 경로 둘 다 확인).

그리고 `invite_token`은 이미 **초대 수락과 영상 시청 링크 양쪽에 재사용되고
있다**:
- `willRepository.findBeneficiaryByToken(token)` - `invite_token`으로 단건 조회
- `willService.requestRelease(token, ...)` - 사후 공개 요청 접수 시 이 토큰으로
  수신인을 특정
- `willService.getWatchUrl(token)` - **영상 시청 URL 발급도 동일하게
  `findBeneficiaryByToken(token)`을 호출**해 수신인을 특정한다
  (`willRoutes.js`의 `GET /api/will/watch/:token` 경로)

즉 SPEC-05가 말하는 "`will_beneficiaries.video_token`"은 **별도 컬럼이 아니라
`invite_token`을 가리키는 것으로 이미 동작하고 있었다.** 코드에 `video_token`
이라는 이름의 컬럼·변수는 어디에도 없다(grep 0건).

**판단: 별도 `video_token` 컬럼을 신설하지 않는다.** 이미 존재하는
`invite_token` 하나로 "초대"와 "시청"을 겸하는 현재 설계를 그대로 유지하고,
열람 추적(`video_watched_at`, `watch_count`)과 만료(`token_expires_at`) 컬럼만
추가한다. 이유:
1. 수신인당 토큰이 이미 1:1로 존재하므로 별도 토큰을 만들 실익이 없다(같은
   개념을 컬럼 2개로 중복 관리하면 오히려 drift 위험이 커진다 - "이중 토큰 중
   어느 쪽이 유효한가"라는 새로운 질문이 생긴다).
2. `getWatchUrl`이 이미 `invite_token` 기반으로 동작 중이므로, `video_token`을
   새로 만들면 기존 초대 이메일에 심어진 링크가 전부 무효가 되고 재발송이
   필요해진다. 컬럼 추가만으로는 이 비용을 정당화할 이유가 없다.
3. SPEC-05가 "기존 컬럼"이라 잘못 서술한 부분은 **컬럼명이 아니라 "추적/만료
   기능 자체가 없다"는 것**이 실제 문제였다. `docs/specs/SPEC-05-letter-delivery.md`
   49~51행에는 이미 이 정정 메모가 반영되어 있다(2026-08-22 정정, 이 마이그레이션과
   별개로 이미 존재).

---

## 3-1. `delivered_at` 컬럼 의미 확정 (추가 지시 반영)

`docs/strategy/12-analytics-plan.md`를 재확인해 `delivered_at`의 정확한 의미를
아래처럼 확정했다. 후보 3개(발송 시각 / 관리자 승인 시각 / 최초 열람 시각) 중
문서가 명시적으로 하나를 지정하고 있어 판단이 애매하지 않았다.

- **문서 근거 (2-8절, 165~171행)**: 이벤트 표에 `release_reviewed`(#48, "관리자
  승인/반려", 소스는 `will_release_requests.reviewed_at`)와 `delivery_sent`(#49,
  "수신인별 전달 발송", "`will_beneficiaries`에 발송 시각 컬럼 없음 →
  `delivered_at` 추가 필요")가 **서로 다른 행으로 분리**되어 있다. 즉 문서 자체가
  "승인"과 "전달(발송)"을 별개 시점으로 정의하고 있으므로 `delivered_at`을
  승인 시각으로 해석하면 안 된다. 그 뒤에 `watch_page_open`(#50, "`/watch/:token`
  진입")이 또 별개 행으로 이어지므로 최초 열람 시각(`video_watched_at`)과도
  분리된 개념이다.
- **확정**: `delivered_at` = **"유가족(수신인)에게 실제로 알림(이메일/SMS)이
  발송된 시각"**. 승인(#48) → 전달(#49) → 열람(#50) 3단계 중 가운데 단계다.
- **코드 근거**: `backend/src/domains/admin/adminService.js`의
  `approveRelease` 함수가 관리자 승인 직후 `beneficiaries` 배열을 순회하며
  수신인별로 `notificationQueue.add('release_approved', ...)`를 호출하는
  루프가 이미 존재한다(이메일·SMS 각각). 이 루프의 위치가 이벤트#49
  "수신인별 전달 발송"의 정의와 정확히 일치한다 - 4절 6번에 구체적인 삽입
  지점을 적었다.
- **판단이 쉬웠던 이유**: `release_reviewed`와 `delivery_sent`가 이미 서로 다른
  테이블(`will_release_requests.reviewed_at` vs `will_beneficiaries.delivered_at`
  신설)을 소스로 명시하고 있어 혼동 여지가 적었다. 다만 508행(P1 목록)의
  "사후 전달 개시 전까지만 완료하면 됨"이라는 짧은 표현만 보면 "전달 기능
  완성 시점"으로 오독할 수 있어 2-8절 표와 대조해 확정했다.

---

## 3-2. `photo_files.variant` 신설 - 구조 확인 + 타입/인덱스 판단 (추가 지시 반영)

### 배경 확인
`backend/src/domains/photo/photoResultSet.js`를 읽어 실제 variant 정의를
확인했다. `VARIANT_DEFS`(이 파일이 SSOT)가 정의하는 4개 키는 다음과 같다:

| key | label | 비고 |
|---|---|---|
| `restore_auto` | 복원본 (자동 컬러화) | 흑백/컬러 여부를 서버에서 판별하지 않고, 프롬프트가 "이미 컬러면 색 유지"를 명시 |
| `restore_only` | 원본 색감 유지본 | 색상 변경 없이 복원만 - `restore_auto`의 오판 대비 안전판 |
| `id_crop` | 증명·영정 규격본 | 3:4 비율, 흰 배경 규격 크롭 |
| `suit` | 정장 합성본 | 유일하게 `photoType`(funeral/id/job)별로 프롬프트가 달라지는 항목 |

`photoResultSet.js` 1~11행 주석이 현재 우회 방식을 스스로 이렇게 설명하고
있다: `kind`는 전부 `'enhanced'`로 저장하고, `s3_key` 파일명 접미사
(`result_<variant>.jpg`)에 variant를 인코딩한 뒤 `parseVariantKey()`로 되돌려
파싱한다. **"workaround, not a clean fix"**라고 직접 명시하며 스키마
마이그레이션을 권고하고 있다. 파일명에 의미를 인코딩하는 방식은 S3 키 규칙이
바뀌거나 파일명이 달라지면 `parseVariantKey`가 조용히 `null`을 반환해(예외를
던지지 않음) 라벨·정렬 정보가 소리 없이 사라지고, SQL로 `WHERE variant = ?`
필터링도 원천적으로 불가능하다.

### 타입 판단: ENUM이 아닌 `VARCHAR(30)`
`ad_spend.channel`에서 이미 같은 판단을 했고(위 up.sql 설계 판단 참고), 이번에도
동일한 결론이며 두 판단 사이에 일관성이 있다:
- 세트 구성(SPEC-08)은 상품 기획 재량 영역이다. `photoResultSet.js` 13~24행
  주석이 "4종 조합을 의미 있게 고른 이유"를 상세히 설명할 정도로 이미 기획
  판단이 깊게 개입돼 있다 - 항목 추가/제거/명칭 변경 가능성이 낮지 않다.
- ENUM으로 하면 세트 구성이 바뀔 때마다 ALTER가 필요하고, 이 프로젝트는
  ENUM drift로 이미 두 차례 마이그레이션(a, b)을 거쳤다(`docs/review/2026-08-21-full-audit.md`).
  같은 패턴을 반복할 이유가 없다.
- 유효값 검증은 DB가 아니라 애플리케이션 레벨(`photoResultSet.js`의
  `VARIANT_DEFS`)이 SSOT로 계속 담당한다 - `ad_spend.channel`이 화이트리스트를
  서비스 레이어에서 관리하는 것과 동일한 구조.

### NULL 허용 + 백필 안 함
- `NULL` 허용. 세트 도입 이전 주문의 결과 파일과 `kind='raw'`(원본) 행에는
  variant 개념 자체가 없다.
- 기존 행 백필은 하지 않는다. 두 가지 경우가 섞여 있기 때문이다:
  1. 세트 도입 이전의 레거시 단일 처리 결과 - variant 개념 자체가 없었으므로
     채울 값이 없다.
  2. 세트 도입 이후, 이 마이그레이션 적용 전까지 우회 방식(파일명 인코딩)으로
     쌓인 데이터 - `parseVariantKey(s3_key)`로 기술적으로는 복원 가능하지만,
     그 백필 로직을 SQL 마이그레이션에 이식하면 "우회 파싱 로직을 한 겹 더
     감추는 것"이 되어 문제의 본질(파일명에 의미를 인코딩하는 설계 자체)을
     해결하지 못한다. 코드가 컬럼 조회로 완전히 교체된 뒤, 필요하다면
     `parseVariantKey`를 재사용하는 일회성 백필 스크립트를 별도로 판단할 것
     (아래 4절 7번).

### 인덱스 판단: 추가하지 않는다
- `photoRepository.findFilesByOrderId`의 실제 쿼리:
  `SELECT * FROM photo_files WHERE order_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`.
  이는 기존 `idx_photo_files_order (order_id, kind)`로 이미 커버된다(선두
  컬럼 `order_id` 일치).
- `photoService.getResult`가 요구하는 "variant 순서 정렬"은 **SQL이 아니라
  애플리케이션 레벨**에서 처리된다 - `filesWithUrls`를 가져온 뒤 JS
  `.sort()`로 `variantOrder` 기준 정렬한다(`photoService.js` 180~187행).
  SQL에 `ORDER BY variant`가 없다.
- 주문 1건당 결과 파일은 최대 5행(raw 1 + 세트 4)뿐이라 인메모리 정렬 비용이
  무의미하고, 현재 어떤 쿼리도 `WHERE variant = ?`를 수행하지 않는다.
- **결론**: 지금은 신규 인덱스가 필요 없다(YAGNI). 추후 관리자 분석 화면에서
  "이번 달 suit 변형 실패율" 같은 **전체 테이블 집계** 쿼리가 생기면 그때
  `(kind, variant, deleted_at)` 복합 인덱스 추가를 검토한다.

---

## 4. 적용 후 필요한 코드 작업 (이 마이그레이션은 스키마만 변경, 코드는 별도)

이 SQL이 적용된 뒤에도 아래 코드 작업이 이뤄지지 않으면 컬럼만 추가되고 기능은
여전히 동작하지 않는다. 별도 구현 에이전트(`ondam-backend-coder` 등)에 위임할 것.

1. **`willService.getWatchUrl`에 열람 기록 + 만료 검사 추가**
   - 현재(`willService.js`): `release_status`와 영상 존재 여부만 확인하고 바로
     presigned URL을 발급한다. `token_expires_at`을 전혀 검사하지 않는다.
   - 추가 필요:
     - 조회 시 `token_expires_at IS NOT NULL AND token_expires_at < NOW()`이면
       403으로 거부(만료 안내 응답).
     - 정상 발급 시 `video_watched_at IS NULL`이면 `NOW()`로 최초 설정,
       `watch_count = watch_count + 1`은 매 호출마다 증가.
     - `willRepository`에 `recordWatch(beneficiaryId)` 같은 UPDATE 함수 신설
       필요 (`video_watched_at = COALESCE(video_watched_at, NOW()), watch_count = watch_count + 1`).

2. **연장 요청(재발급) 엔드포인트 구현**
   - SPEC-05 3절: "90일 내 미열람 만료 → 링크 만료 화면에 '연장 요청' 버튼 →
     요청 시 신규 토큰 재발급(+90일), 무제한 허용, 재발급마다 구토큰 무효화·로그
     기록".
   - `invite_token`을 재사용하는 설계이므로 "재발급"은 `invite_token`을 새
     랜덤값으로 교체하고 `token_expires_at`을 `NOW() + INTERVAL 90 DAY`로
     갱신하는 것을 의미한다. 이메일 재발송 로직도 함께 필요.
   - "구토큰 무효화·로그 기록"은 원칙적으로 append-only 로그가 필요한 영역이다
     (money/계약/심사/회원 상태급은 아니지만 재발급 남용 방지 목적). 재발급
     빈도가 실제로 문제가 될 때 별도 `will_beneficiary_token_logs` 테이블
     추가를 검토할 것(이번 마이그레이션 범위 밖).

3. **SPEC-04 미열람 리마인드 배치 구현**
   - `[1-1]` 인덱스를 활용해 `token_expires_at`이 7일 이내이고
     `video_watched_at IS NULL`인 수신인을 스캔, 리마인드 알림 1회 발송.
   - BullMQ 크론 작업으로 구현할 것 (CLAUDE.md "BullMQ 크론 작업" 컨벤션 참고 -
     `subscription-billing` 큐의 `scan-due`와 유사한 패턴).

4. **`ad_spend` 관리자 입력 화면 + CAC 산출 쿼리**
   - `/admin`에 채널·기간·금액·메모 입력 폼 신설 (`recorded_by`는 로그인한
     `admin_users.admin_id`로 서버에서 채울 것 - 클라이언트 입력값 신뢰 금지).
   - CAC 산출 쿼리는 `docs/strategy/12-analytics-plan.md` 3-5절의 공식을 그대로
     구현:
     ```
     CAC(채널, 기간) = SUM(ad_spend.spend_krw WHERE channel=c AND 기간 겹침 안분)
                     / COUNT(DISTINCT user_id WHERE 기간 내 생애 첫 결제 성공
                             AND first_touch.utm_source가 채널 c)
     ```
     - 기간 겹침 안분(일할 계산)은 애플리케이션 레벨(SQL 또는 서비스 코드)에서
       `spend_krw / DATEDIFF(period_end, period_start) + 1` 형태로 일 단가를
       구한 뒤 조회 기간과 겹치는 일수를 곱하는 방식을 권장.
     - 분모(생애 첫 결제자 + UTM 채널 귀속)는 `12-analytics-plan.md` 8-1절이
       명시한 `first_utm_*` 컬럼(users 또는 신규 `user_attribution`)이 선행
       필요 - 이번 마이그레이션 범위 밖(별도 작업).

5. **SPEC-05 "기존 컬럼" 서술 정정에 맞춘 구현**
   - SPEC-05 25행의 `will_beneficiaries.video_token`은 `invite_token`을
     가리키는 것으로 구현할 것 (3절 판단 참고). 새 컬럼명으로 코드를 작성하지
     말 것.
   - SPEC-05 43행 "다운로드 제공" 기능은 이번 마이그레이션 범위 밖(스키마
     변경 불필요 - presigned URL 발급 로직만 있으면 됨). 별도 작업으로 분리.

6. **`adminService.approveRelease`에 `delivered_at` 기록 추가 (신규)**
   - 삽입 지점: `adminService.js`의 `approveRelease` 함수, 수신인별 알림 발송
     루프 내부 - `notificationQueue.add(...)` 호출들을 감싼 `try` 블록 안,
     정상적으로 큐 등록이 끝난 직후.
   - `willRepository`(또는 `adminRepository`)에 `markBeneficiaryDelivered(beneficiaryId)`
     같은 UPDATE 함수를 신설해 `will_beneficiaries.delivered_at = NOW()`로
     기록할 것. `catch (notifyErr)` 분기(발송 실패)에서는 기록하지 않는다 -
     `delivered_at`은 "발송을 실제로 시도해 큐 등록까지 성공한 시각"이어야
     정확하다(3-1절 정의 참고).
   - 이메일/SMS가 둘 다 있는 수신인은 둘 중 하나만 성공해도 "전달됨"으로
     간주할지, 둘 다 성공해야 할지는 SPEC-05/12-analytics-plan.md에 명시가
     없다 - 구현 시점에 오너 확인 필요(권장: 하나라도 성공하면 기록. "유가족이
     최소 한 채널로는 연락받을 수 있었다"가 리드타임 지표의 취지에 더 가깝다).
   - `beneficiary.user_id`가 없는(비회원) 수신인도 이메일/SMS 발송 대상이므로
     `delivered_at` 기록은 in-app 알림 INSERT 블록이 아니라 이메일/SMS
     발송 블록에 걸어야 한다(현재 코드에서 in-app 블록은 `beneficiary.user_id`
     존재 시에만 실행되어 비회원을 놓친다).

7. **`photoWorker`가 파일 저장 시 `variant` 컬럼을 기록하도록 변경 (신규)**
   - 삽입 지점: `backend/src/jobs/workers/photoWorker.js`의
     `runVariantWithRetry` 함수 - `insertPhotoFile({...})` 호출부(183~189행)에
     `variant: variant.key`를 추가.
   - `insertPhotoFile` 헬퍼(같은 파일 49~56행)와 `photoRepository.savePhotoFile`
     (INSERT 대상 컬럼이 동일한 두 곳)도 함께 `variant` 파라미터를 받아
     INSERT 컬럼 목록에 추가하도록 수정할 것 - 한쪽만 고치면 drift가 생긴다.
   - `raw` 원본을 기록하는 `ensureRawFileRecorded`(worker 내 별도 함수) 경로는
     `variant`를 `NULL`로 둘 것(원본에는 variant 개념이 없음, 3-2절 참고).

8. **`photoService.getResult`의 s3_key 파싱 로직을 컬럼 조회로 교체 (우회 제거)**
   - 현재(`photoService.js` 154~174행): 매 결과 파일마다
     `getVariantMeta(s3Key)`를 호출해 `s3_key` 파일명 접미사를 정규식으로
     파싱한 뒤 `variantKey`/`variantLabel`/`variantOrder`를 복원하고 있다.
   - 변경 필요: `getVariantMeta(s3Key)` 대신 DB에서 이미 읽어온 `file.variant`
     컬럼값을 직접 사용할 것. `photoResultSet.js`의 `VARIANT_META_BY_KEY`에서
     `label`/`order`만 조회하는 형태로 축소(아래 9번과 연결).
   - `parseVariantKey`/`VARIANT_KEY_PATTERN`(파일명 정규식 파싱 자체)은 더 이상
     조회 경로에서 쓰이지 않아야 한다. 완전히 삭제할지, 과거 우회 데이터
     백필용으로 잠시 남겨둘지는 7절의 백필 판단과 함께 결정할 것.

9. **`photoResultSet.getVariantMeta()`가 파일명 대신 컬럼값을 받도록 정리**
   - 현재 시그니처: `getVariantMeta(s3Key)` - 내부에서 `parseVariantKey(s3Key)`를
     먼저 호출해 key를 얻은 뒤 `VARIANT_META_BY_KEY[key]`를 조회한다.
   - 변경 필요: `getVariantMetaByKey(variantKey)` 같은 이름으로 바꾸고
     `s3_key` 파싱 단계를 제거, `VARIANT_META_BY_KEY[variantKey]`를 바로
     조회하도록 단순화. 이 파일이 "접미사 <-> 라벨의 SSOT"라는 기존 주석(9행)도
     "컬럼값 <-> 라벨의 SSOT"로 갱신할 것.
   - `VARIANT_DEFS`/`VARIANT_META_BY_KEY`/`buildResultSet`(세트 생성 시 사용)은
     이번 변경과 무관하므로 그대로 유지.

---

## 5. 실행 경고

이 SQL은 **어떤 DB에도 자동 실행되지 않는다.** 반드시 사용자가 직접, DB 백업을
확인한 뒤 실행할 것. db-schema-architect 에이전트는 운영 DB에 대한 ALTER 실행
권한을 갖지 않는다.

---

## 검증 쿼리 (적용 후 실행 확인용)

```sql
-- 컬럼 추가 확인
SHOW COLUMNS FROM will_beneficiaries LIKE 'delivered_at';
SHOW COLUMNS FROM will_beneficiaries LIKE 'video_watched_at';
SHOW COLUMNS FROM will_beneficiaries LIKE 'watch_count';
SHOW COLUMNS FROM will_beneficiaries LIKE 'token_expires_at';

-- 인덱스 추가 확인
SHOW INDEX FROM will_beneficiaries WHERE Key_name = 'idx_will_beneficiaries_expiry_watch';

-- 백필 반영 건수 확인 (release_status='released'인데 여전히 NULL이면 released_at 자체가 NULL인 경우)
SELECT
  COUNT(*) AS total_released,
  SUM(CASE WHEN wb.token_expires_at IS NOT NULL THEN 1 ELSE 0 END) AS backfilled
FROM will_beneficiaries wb
INNER JOIN wills w ON wb.will_id = w.will_id
WHERE w.release_status = 'released' AND wb.deleted_at IS NULL;

-- ad_spend 테이블 생성 확인
SHOW CREATE TABLE ad_spend;

-- photo_files.variant 컬럼 추가 확인
SHOW COLUMNS FROM photo_files LIKE 'variant';
```

---

## enums 파일 동기화 상태

이 마이그레이션은 **신규 ENUM을 추가하지 않았다.** `ad_spend.channel`과
`photo_files.variant` 둘 다 ENUM이 아닌 VARCHAR로 설계했기 때문에(위 up.sql
설계 판단 참고) `shared/constants/enums.js` / `enums.ts`를 수정할 필요가 없다.
두 파일은 이 작업으로 변경되지 않았다. `photo_files.variant`의 유효값 SSOT는
DB ENUM이 아니라 `backend/src/domains/photo/photoResultSet.js`의
`VARIANT_DEFS`다(3-2절 참고) - 이 파일이 바뀌면 `enums.js`/`enums.ts`가 아니라
이 SSOT 파일만 갱신하면 된다.

`kind` ENUM(`raw`/`enhanced`)은 이번 마이그레이션에서 **건드리지 않았다** -
기존 정의 그대로 유효하다.
