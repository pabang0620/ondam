# 2026-08-21 스키마 drift 해소 마이그레이션

> **이 디렉토리의 SQL 파일은 어디에도 자동 실행되지 않았다.** 파일 생성만 완료된 상태다.
> 실행은 전적으로 사용자 몫이다 - 반드시 DB 백업을 먼저 확인한 뒤 직접 실행할 것.
> (db-schema-architect는 운영 DB에 대한 ALTER 실행 권한을 갖지 않는다.)

전체 코드 감사(3~4개 에이전트 교차 확인)에서 확정된 코드↔스키마 drift 4건을 해소한다.

---

## 파일 목록

| 파일 | 내용 |
|---|---|
| `2026-08-21-schema-drift-fix.up.sql` | ai_jobs/photo_orders ENUM 확장, pets 컬럼 추가, subscriptions NULL 허용 전환 |
| `2026-08-21-schema-drift-fix.down.sql` | 위 UP의 롤백. ENUM 값 제거 2건은 수동 사전확인 절차 포함 (자동 실행 안 됨) |
| `2026-08-21-schema-drift-fix.README.md` | 이 파일 |

---

## 적용 순서

1. **DB 전체 백업** (mysqldump 등) - 백업 없이 절대 진행하지 말 것
2. `up.sql` 을 스테이징/개발 DB에서 먼저 실행 → 애플리케이션 동작 확인
3. 운영 DB 적용 시 **트래픽이 낮은 시간대**를 권장한다 (아래 "락 주의사항" 참조)
4. 실행 후 아래 "검증 쿼리"로 실제 반영 여부 확인
5. 문제 발생 시 `down.sql` 참조 - 단, ENUM 값 제거 2건은 자동 실행되지 않게 주석 처리되어
   있으므로 사전 확인 쿼리를 먼저 돌려본 뒤 수동으로 주석을 해제할 것

---

## 각 변경사항 상세 + ALTER 잠금 주의

### [2] `ai_jobs.target_type` ENUM에 `'pet'` 추가
- **알고리즘**: `ALGORITHM=INSTANT` (MySQL 8.4, 기존 값 뒤에 추가라 무락)
- petService.js:186 이 `target_type='pet'` 으로 INSERT 하지만 ENUM에 없어 상시 실패하던 버그 해소

### [3] `photo_orders.photo_type` ENUM에 `'portrait'`, `'casual'` 추가
- **알고리즘**: `ALGORITHM=INSTANT` (MySQL 8.4, 기존 값 뒤에 추가라 무락)
- Zod(photoRoutes.js:30)와 워커 프롬프트(photoWorker.js)가 전제하는 9개 타입과
  DB ENUM(기존 7개)의 불일치 해소
- `photo_order_logs.prev_status/next_status` ENUM은 **주문 상태**(pending_payment 등)를
  추적하는 것이라 `photo_type`과는 무관함 - 착오로 함께 건드리지 않았음을 확인

### [4] `pets.memorial_access_code VARCHAR(50) NULL` 컬럼 추가
- **알고리즘**: `ALGORITHM=INSTANT` (NULL 허용 컬럼 추가, 무락)
- memorialRepository의 SELECT가 존재하지 않는 컬럼을 참조해 상시 500 나던 버그 해소
- **접근제어 정책은 이 마이그레이션에 포함되지 않았다.** 컬럼 COMMENT에 명시했듯,
  이 값이 NULL일 때 추모관을 공개/비공개 중 어느 쪽 기본값으로 할지는 **SPEC-03 승인
  대기 중**이다. 정책을 스키마 제약(예: DEFAULT 값, CHECK)으로 못박지 않았다 -
  서비스 레이어에서 SPEC-03 확정 후 구현할 것.
- 권장(승인 전 임시 가이드): 코드 없으면(NULL) 비공개로 처리 - CLAUDE.md의 "추모관
  접근 제한" 보안 규칙과 방향이 맞다. 단 이건 권장일 뿐 확정 아님.

### [5] `subscriptions.toss_billing_key_encrypted`, `billing_kms_key_id` NULL 허용
- **알고리즘**: `ALGORITHM=INPLACE, LOCK=NONE` (컬럼 재정의, 짧은 메타데이터 락 가능)
- cancelSubscription(subscriptionRepository.js:152)이 해지 시 이 두 컬럼을 NULL로
  UPDATE 하는데 NOT NULL 제약으로 상시 실패하던 버그 해소
- CLAUDE.md 보안 규칙 "해지 시 즉시 toss_billing_key_encrypted = NULL 처리"와 스키마를
  일치시킴

### 운영 적용 시 공통 주의
- 위 4건 모두 대용량 테이블 기준으로도 락 영향은 낮음(INSTANT/INPLACE LOCK=NONE)이나,
  DDL은 MySQL에서 **암묵적 COMMIT**을 유발하므로 트랜잭션 롤백이 불가능하다.
  하나씩 실행하고 실행 직후 검증 쿼리로 확인하는 방식을 권장한다.
- ENUM `MODIFY COLUMN`은 MySQL 버전/추가 위치에 따라 `ALGORITHM=COPY`(테이블 풀 락)로
  강제될 수 있다. `up.sql`의 [2],[3]은 값을 **끝에 추가**하는 형태라 8.4에서
  INSTANT가 기대되지만, 실행 전 `ALGORITHM=INSTANT` 절이 에러 없이 받아들여지는지
  스테이징에서 먼저 확인할 것. 거부되면 즉시 중단하고 오프피크 시간대로 미룰 것.

---

## 검증 쿼리 (적용 후 실행 확인용)

```sql
-- ENUM 값 반영 확인
SHOW COLUMNS FROM ai_jobs LIKE 'target_type';
SHOW COLUMNS FROM photo_orders LIKE 'photo_type';

-- 컬럼 추가 확인
SHOW COLUMNS FROM pets LIKE 'memorial_access_code';

-- NULL 허용 전환 확인
SHOW COLUMNS FROM subscriptions LIKE 'toss_billing_key_encrypted';
SHOW COLUMNS FROM subscriptions LIKE 'billing_kms_key_id';
```

---

## enums.ts 동기화 상태

`shared/constants/enums.ts`는 이 마이그레이션과 함께 **이미 Edit로 직접 수정 완료**했다
(DB ENUM 정의를 SSOT로 삼아 대조 후 확장). 별도 후속 작업 불필요.

| 상수 | 변경 전 | 변경 후 (DB와 일치) |
|---|---|---|
| `PHOTO_TYPE` | 3개 (funeral,id,job) | 9개 (funeral,id,job,enhance,colorize,restore,removebg,portrait,casual) |
| `WILL_STATUS` | 4개 | 5개 (`paid` 추가, draft/paid/active/released/revoked 순) |
| `SUBSCRIPTION_STATUS` | 3개 | 4개 (`suspended` 추가, active/past_due/suspended/canceled 순) |
| `NOTIFICATION_TYPE` | 9개 | 11개 (`voice_clone_complete`, `will_video_ready` 추가) |
| `AI_JOB_TARGET_TYPE` | 4개 | 5개 (`pet` 추가) |

주의: WILL_STATUS·SUBSCRIPTION_STATUS·NOTIFICATION_TYPE 3개는 **DB 스키마
(`ondam_schema.sql`)에는 이미 반영되어 있었고** enums.ts 쪽만 뒤처져 있던 drift였다.
이번 작업은 이 3개에 대해서는 SQL 마이그레이션을 만들지 않았다(DB는 이미 정본과
일치) - enums.ts만 DB에 맞춰 갱신했다.

---

## 항목 7: 코드 수정이 필요한 사항 (SQL 마이그레이션 대상 아님)

MySQL 8은 조건부 UNIQUE(partial unique index)를 지원하지 않는다. 아래 3개 컬럼은
소프트 삭제(탈퇴/삭제) 후 같은 값으로 재가입/재생성 시 `UNIQUE` 제약과 충돌해
`ER_DUP_ENTRY` 500 에러를 유발할 수 있다. **스키마 변경이 아니라 애플리케이션
로직(Service 계층) 수정 사항**이므로 이 마이그레이션 SQL에는 포함하지 않았다.

| 테이블.컬럼 | 현재 제약 | 문제 |
|---|---|---|
| `users.email` | `UNIQUE` | 탈퇴(soft delete) 후 동일 이메일로 재가입 시 충돌 |
| `pets.memorial_slug` | `UNIQUE` | 반려동물 소프트 삭제 후 동일 slug 재사용 시 충돌 |
| `admin_users.email` | `UNIQUE` | 관리자 소프트 삭제 후 동일 이메일 재사용 시 충돌 |

**권장 패턴** (탈퇴/삭제 처리 시점의 Service 로직에 적용):

```sql
UPDATE users
SET deleted_at = NOW(),
    email = CONCAT(email, '__deleted__', UNIX_TIMESTAMP())
WHERE user_id = ?;
```

- 소프트 삭제와 동시에 UNIQUE 컬럼 값에 접미사를 붙여 원래 값을 "해제"한다.
- 원본 값 복구가 필요하면(예: 관리자 복구 기능) 접미사 패턴(`__deleted__<timestamp>`)을
  파싱해 원복하는 로직을 별도로 둘 것.
- `pets.memorial_slug`, `admin_users.email`도 동일 패턴을 적용할 것.
- 이 항목은 **코드 수정 필요 사항으로 별도 기록**만 하고, 이번 마이그레이션에서는
  스키마도 코드도 건드리지 않았다. 실제 수정은 별도 작업(express-engineer 위임)으로
  진행할 것.

---

## 이번 작업에서 다루지 않은 것 (참고)

- `ondam_schema.sql`의 `subscription_payment_logs` 중복 CREATE TABLE 정의(601행/914행)는
  스냅샷 파일 정리이므로 UP/DOWN 없이 직접 편집으로 정리했다(601행 상단 CREATE TABLE
  섹션을 정본으로 유지, 914행 이력 섹션 내 중복 CREATE는 서술 주석으로 대체).
  이 변경은 파일 정리이며 실제 DB에는 영향 없음(원래도 `IF NOT EXISTS`라 두 번째
  CREATE는 no-op였음).
