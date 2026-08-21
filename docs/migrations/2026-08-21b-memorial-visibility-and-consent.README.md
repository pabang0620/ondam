# 2026-08-21b 추모관 공개정책 + 동의 이력 스키마 공백 해소

> **이 디렉토리의 SQL 파일은 어디에도 자동 실행되지 않았다.** 파일 생성만 완료된 상태다.
> 실행은 전적으로 사용자 몫이다 - 반드시 DB 백업을 먼저 확인한 뒤 직접 실행할 것.
> (db-schema-architect는 운영 DB에 대한 ALTER 실행 권한을 갖지 않는다.)

Phase 0 결함 수정 작업 중 구현 에이전트가 코드만으로는 해결할 수 없는 스키마 공백
2건을 발견했다. 둘 다 이 마이그레이션으로 해소한다.

---

## 파일 목록

| 파일 | 내용 |
|---|---|
| `2026-08-21b-memorial-visibility-and-consent.up.sql` | `pets.is_public` 컬럼 추가, `user_consents.consent_type` ENUM 확장 |
| `2026-08-21b-memorial-visibility-and-consent.down.sql` | 위 UP의 롤백. ENUM 값 제거는 수동 사전확인 절차 포함 (자동 실행 안 됨) |
| `2026-08-21b-memorial-visibility-and-consent.README.md` | 이 파일 |

---

## 1. 적용 순서 (중요)

**이 마이그레이션은 반드시 기존 `2026-08-21-schema-drift-fix` 적용 후에 적용해야 한다.**

이유: `up.sql`의 `[1] pets.is_public` 추가가 `AFTER memorial_access_code` 절을 쓰는데,
`memorial_access_code` 컬럼 자체가 `2026-08-21-schema-drift-fix.up.sql`에서 신규
추가되는 컬럼이다. 그 마이그레이션이 먼저 적용되어 있지 않으면 `AFTER` 절 대상
컬럼이 없어 이 ALTER는 즉시 에러로 실패한다.

순서:
1. **DB 전체 백업** (mysqldump 등) - 백업 없이 절대 진행하지 말 것
2. `docs/migrations/2026-08-21-schema-drift-fix.up.sql` 적용 (아직 적용 전이라면 먼저)
3. `docs/migrations/2026-08-21b-memorial-visibility-and-consent.up.sql` 적용
4. 스테이징/개발 DB에서 먼저 실행 → 애플리케이션 동작 확인 후 운영 적용
5. 운영 적용 시 트래픽이 낮은 시간대 권장
6. 실행 후 아래 "검증 쿼리"로 반영 여부 확인
7. 문제 발생 시 이 파일의 `down.sql` 참조 - 단, ENUM 값 제거는 자동 실행되지
   않게 주석 처리되어 있으므로 사전 확인 쿼리를 먼저 돌려본 뒤 수동으로 주석을
   해제할 것

---

## 2. 각 변경사항 상세 + ALTER 잠금 주의

### [1] `pets.is_public TINYINT(1) NOT NULL DEFAULT 0` 컬럼 추가
- **알고리즘**: `ALGORITHM=INSTANT` (MySQL 8.0.12+에서 DEFAULT 값이 있는 컬럼 추가는
  INSTANT 지원, 8.4에서도 동일하게 무락으로 처리됨)
- SPEC-03(오너 확정, `docs/specs/SPEC-03-memorial-access.md`) - 사람(고인) 추모
  공간은 항상 비공개, 반려동물은 소유자가 공개/비공개를 선택할 수 있어야 한다.
  그런데 `pets` 테이블에 공개 여부 컬럼이 없어 "공개 선택" UI/로직 자체를 구현할
  방법이 없었다 (기존 임시 구현은 `memorial_access_code` 존재 여부만으로 판단).

### [2] `user_consents.consent_type` ENUM에 `'terms'`, `'marketing'` 추가
- **알고리즘**: `ALGORITHM=INSTANT` (MySQL 8.0.12+, 기존 값 뒤에 추가라 무락)
- ENUM `MODIFY COLUMN`은 MySQL 버전/추가 위치에 따라 `ALGORITHM=COPY`(테이블 풀 락)로
  강제될 수 있다. 이 UP은 값을 **끝에 추가**하는 형태라 8.4에서 INSTANT가 기대되지만,
  실행 전 `ALGORITHM=INSTANT` 절이 에러 없이 받아들여지는지 스테이징에서 먼저
  확인할 것. 거부되면 즉시 중단하고 오프피크 시간대로 미룰 것.
- 프론트 회원가입은 `terms`/`privacy`/`marketing` 3종을 보내는데, DB ENUM에
  `terms`/`marketing`이 없어 `authService.register`가 이 둘을 저장 없이 버리도록
  임시 처리되어 있었다. 이용약관 동의 이력과 마케팅 수신 동의 이력을 남기지
  않는 것은 전자상거래법·정보통신망법 관점에서 문제가 될 수 있다(특히 마케팅
  수신 동의는 증빙이 필요).

### 운영 적용 시 공통 주의
- 위 2건 모두 대용량 테이블 기준으로도 락 영향은 낮음(INSTANT)이나, DDL은 MySQL에서
  **암묵적 COMMIT**을 유발하므로 트랜잭션 롤백이 불가능하다. 하나씩 실행하고 실행
  직후 검증 쿼리로 확인하는 방식을 권장한다.

---

## 3. `is_public` 기본값이 0(비공개)이어야 하는 이유

`is_public`의 `DEFAULT`는 **반드시 0(비공개)**이어야 하며, 이를 1(공개)로 바꾸는
것은 절대 허용되지 않는다.

- 이 컬럼은 마이그레이션 시점에 이미 존재하던 모든 기존 펫 행에도 그대로 적용된다.
  만약 `DEFAULT 1`이었다면, 마이그레이션이 실행되는 순간 기존에 등록된 모든
  반려동물 추모 페이지가 소유자의 의도·확인 없이 일괄 공개로 전환된다. 이는
  개인정보/유가족 정보(사망일, 사진, 이름 등)가 소유자가 인지하지 못한 채
  인터넷에 노출되는 사고로 직결된다.
- SPEC-03도 "비공개 기본, 소유자가 공개 전환 가능"으로 명시하고 있다 - 기본값을
  1로 바꾸는 것은 이 확정 정책을 정면으로 위반한다.
- 온담 CLAUDE.md의 보안 규칙("유가족 인증 없이 고인 데이터 노출 절대 금지")과도
  방향이 일치한다. 사람(고인) 추모 공간은 애초에 공개 개념 자체가 없고(항상
  비공개), 반려동물만 예외적으로 공개를 허용하는 것이므로, 그 예외조차 기본값은
  안전한 쪽(비공개)이어야 한다.
- 공개 전환은 오직 소유자의 명시적 PATCH 액션(`PUT /api/pet/:petId` 등)으로만
  이뤄져야 하며, 스키마 기본값·마이그레이션·백필 스크립트로 일괄 전환하는 것은
  어떤 경우에도 금지한다.

---

## 4. 적용 후 필요한 코드 작업 (이 마이그레이션은 스키마만 변경, 코드는 별도)

이 SQL이 적용된 뒤에도 아래 코드 작업이 이뤄지지 않으면 컬럼만 추가되고 기능은
여전히 동작하지 않는다. 별도 구현 에이전트(예: `ondam-backend-coder`)에 위임할 것.

1. **`memorialService.getMemorialPage` 판정 로직 확장**
   - 현재: `memorial_access_code` 존재 여부만으로 공개/비공개를 판정 (`memorialService.js:26~51`).
   - 변경 필요: `pet.is_public`이 `true`면 접근 코드 없이 바로 공개(단, `pet_status`가
     `alive`가 아닌 조건은 유지), `false`면 기존처럼 `memorial_access_code` 검증
     경로를 타도록 분기를 추가해야 한다.
   - SPEC-03 4절 수용 기준 "펫 페이지 공개/비공개 전환이 즉시 반영되고 비공개
     시 slug 접근이 404가 아닌 안내 화면"도 함께 검토할 것(이 마이그레이션
     범위 밖, 별도 프론트 작업 필요).

2. **`petRepository.PET_UPDATABLE_COLS` / `petRoutes.updatePetSchema`에 매핑 추가**
   - `petRepository.js`의 `PET_UPDATABLE_COLS`에 `isPublic: 'is_public'` 추가.
   - `petRoutes.js`의 `updatePetSchema.body`에 `isPublic: z.boolean().optional()`
     (또는 프로젝트 컨벤션에 맞는 boolean 스키마) 추가.
   - `memorialRepository.findPetBySlug`의 SELECT 컬럼 목록에도 `is_public`을
     포함시켜야 `memorialService`에서 판정에 쓸 수 있다.

3. **`authService.register`의 필터 제거**
   - 현재 `authService.js:71~76`에서 `persistableConsents = consents.filter((c) =>
     CONSENT_TYPE.includes(c.type))`로 `terms`/`marketing`을 걸러 버리고 있다.
   - ENUM 확장 및 `CONSENT_TYPE` 상수 갱신(이번 작업에서 완료) 이후에는 이 필터가
     `terms`/`marketing`도 통과시키게 되므로, 관련 주석(71~75행)을 제거하고
     "ENUM에 없어서 버린다"는 임시 처리 코멘트를 정리할 것. 필터 자체(안전망으로
     `CONSENT_TYPE`에 없는 미지 값 방어)는 유지해도 무방하나, 임시방편이라는
     설명은 더 이상 사실이 아니므로 갱신 필요.

---

## 5. 실행 경고

이 SQL은 **어떤 DB에도 자동 실행되지 않는다.** 반드시 사용자가 직접, DB 백업을
확인한 뒤 실행할 것. db-schema-architect 에이전트는 운영 DB에 대한 ALTER 실행
권한을 갖지 않는다.

---

## 검증 쿼리 (적용 후 실행 확인용)

```sql
-- 컬럼 추가 확인
SHOW COLUMNS FROM pets LIKE 'is_public';

-- 기본값이 실제로 0(비공개)인지, 기존 행이 전부 비공개로 남아있는지 확인
SELECT is_public, COUNT(*) FROM pets GROUP BY is_public;

-- ENUM 값 반영 확인
SHOW COLUMNS FROM user_consents LIKE 'consent_type';
```

---

## enums 파일 동기화 상태

`shared/constants/enums.js`(런타임 SSOT)와 `shared/constants/enums.ts`(타입용)의
`CONSENT_TYPE`을 이 마이그레이션과 함께 **이미 Edit로 직접 수정 완료**했다
(DB ENUM 정의를 SSOT로 삼아 대조 후 확장, 두 파일 값 100% 동일 확인). 별도
후속 작업 불필요.

| 상수 | 변경 전 | 변경 후 (DB와 일치) |
|---|---|---|
| `CONSENT_TYPE` | 5개 (privacy,portrait,voice,ai_generation,posthumous_release) | 7개 (`terms`, `marketing` 추가) |
