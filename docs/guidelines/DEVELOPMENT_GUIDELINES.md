# 온담 개발 가이드라인 (재발 방지 규약)

> 2026-08-21 전체 코드 감사에서 드러난 결함의 **근본 원인 2가지**(스키마 drift, mock 폴백 은폐)와 반복 패턴을 규약화한 문서다.
> 이 문서는 "다음 개발자가 같은 실수를 반복하지 않게" 하는 것이 목적이다. 새 코드를 쓰기 전에 해당 절을 확인한다.
> 프로젝트 컨벤션(응답 포맷·레이어·보안)의 SSOT는 `.claude/CLAUDE.md`이며, 이 문서는 그 위에 감사 결과로 도출한 실전 규칙을 더한다.

---

## G1. ENUM은 enums.ts가 SSOT다 (drift 1순위 원인)

**문제**: `shared/constants/enums.ts`가 DB 마이그레이션을 따라가지 못하고, Zod 스키마가 enums.ts를 import하지 않고 각자 문자열을 하드코딩해 3중 불일치가 발생했다. 그 결과 가입·사진주문·펫초상화 등이 "항상 실패"했다.

**규칙**:
1. ENUM의 진실은 `enums.ts` 1곳. DB ENUM 정의와 enums.ts는 **항상 동일**해야 한다.
2. Zod 스키마는 문자열 배열을 직접 쓰지 말고 enums.ts 상수를 참조한다:
   ```js
   // 금지
   photoType: z.enum(['funeral','id','job', ...])
   // 권장
   import { PHOTO_TYPE } from '@shared/constants/enums'
   photoType: z.enum(PHOTO_TYPE)
   ```
3. DB에 ENUM 값을 추가/변경하면 **같은 PR에서** enums.ts도 수정한다. 마이그레이션과 상수는 한 커밋에 묶는다.
4. Repository에서 리터럴 ENUM 값을 INSERT/UPDATE에 쓰지 말고 enums 상수를 쓴다 (`'pet'`, `'canceled'`, `'payment_success'` 같은 오타·유령값 방지).

**병합 전 확인**: 아래 G8 스키마-drift 체크를 돌린다.

---

## G2. 프로덕션에 mock 성공 폴백 금지 (은폐 1순위 원인)

**문제**: API 실패 시 catch에서 mock 성공 데이터로 폴백하는 코드가 프론트 40곳에 dev 게이트 없이 있었다. 로그인·결제·사망확인 서류 제출 실패가 전부 "성공"으로 위장돼, G1의 실패들이 화면상 안 보였다.

**규칙**:
1. `catch`에서 성공 상태로 전환(`setAuth`, `setIsSubmitted(true)`, 성공 페이지 이동)하는 코드 **금지**.
2. catch는 사용자에게 에러를 보여주는 것만 한다: `setError(err.response?.data?.message ?? '문제가 발생했어요')`.
3. 개발용 mock이 꼭 필요하면 반드시 `import.meta.env.DEV` 게이트 안에 두고, 프로덕션 빌드에서 제거되게 한다. mock 데이터 필드명은 실제 API 응답과 동일해야 한다(다르면 후속 요청이 또 깨진다).
4. **결제·인증·서류제출·삭제** 등 되돌리기 어려운 액션은 mock 폴백을 어떤 환경에서도 두지 않는다.

**리뷰 체크**: `grep -rn "catch" frontend/src | grep -i mock` 결과가 있으면 반려.

---

## G3. 결제는 서버가 진실이다 (자금 직결)

**문제**: preparePayment가 클라이언트가 보낸 금액·대상을 그대로 신뢰해, 49,000원 상품을 100원에 결제 완료할 수 있었다.

**규칙**:
1. 결제 금액은 **서버가 상품 테이블에서 조회**한다. 클라이언트 `amountKrw`는 신뢰하지 않는다. 클라이언트 값이 서버 조회값과 다르면 400.
2. 결제 대상(`targetId`)의 **소유권을 검증**한다: `target.user_id === req.user.userId`.
3. 결제 관련 스키마에서 가격 필드(`priceKrw`)의 클라이언트 입력을 제거한다. 가격은 서버 상수/테이블에서만 온다.
4. 토스 결제는 프론트에서 SDK requestPayment → successUrl 콜백에서 confirm 하는 **왕복**을 실제 구현한다. `paymentKey`를 하드코딩하지 않는다.
5. confirm은 비관적 락(`SELECT ... FOR UPDATE`)으로 중복 승인을 막는다 (photo/will 도메인의 기존 패턴 준용).

---

## G4. 다중 테이블 쓰기는 트랜잭션으로 (원자성)

**문제**: 구독 생성/정기결제가 여러 `pool.execute`로 흩어져 있어, 결제 성공 후 일부 INSERT 실패 시 "결제 없이 구독 active" 같은 정합성 파손이 가능했다.

**규칙**:
1. 여러 테이블에 쓰는 로직(주문+결제, 유언장+수신인, 구독+로그+결제)은 하나의 트랜잭션으로 묶는다.
2. 참조 패턴(이미 올바르게 구현된 예): `subscriptionRepository.updateSubscriptionStatus`, `willRepository.createWillWithBeneficiaries`. `getConnection() → beginTransaction() → conn.execute ... → commit()/rollback() → finally release()`.
3. Repository가 외부 트랜잭션에 참여해야 하면 `conn`을 인자로 받아 실제로 그 `conn`으로 실행한다 (인자만 받고 무시하면 "트랜잭션 주석이 거짓"이 된다 - 실제 사고 사례).
4. **큐 등록·외부 API 호출은 커밋 이후에** 한다. 트랜잭션 안에서 `queue.add`를 먼저 하면 롤백돼도 잡이 남아 워커가 유령 데이터를 처리한다.

---

## G5. soft delete 규약

**문제**: 워커·관리자 UPDATE 6곳에서 `deleted_at IS NULL` 필터가 빠져, 삭제된 유언장을 공개 처리할 수 있는 경로가 있었다. 또 `users.email` UNIQUE와 soft delete가 충돌해 탈퇴 후 재가입이 500이었다.

**규칙**:
1. `deleted_at` 컬럼이 있는 테이블의 **모든 SELECT·UPDATE**에 `AND deleted_at IS NULL`을 붙인다 (append-only 로그·토큰 테이블 제외).
2. soft delete와 UNIQUE(email, slug 등)가 충돌하는 컬럼은, 삭제 시 값에 접미사를 붙여 UNIQUE 재사용을 푼다:
   ```sql
   UPDATE users SET deleted_at = NOW(),
     email = CONCAT(email, '__deleted__', UNIX_TIMESTAMP())
   WHERE user_id = ? AND deleted_at IS NULL
   ```
   대상: `users.email`, `pets.memorial_slug`, `admin_users.email`.
3. 가입/생성 서비스는 `ER_DUP_ENTRY`를 잡아 409 사용자 메시지로 변환한다 (raw 500 노출 금지).

---

## G6. 비동기 작업(큐·워커) 규약

**문제**: 워커가 NOT NULL 컬럼 누락 INSERT로 항상 실패(photo_files.file_size), 큐 페이로드와 워커 기대 계약 불일치(pet portrait), 알림 큐 잡 타입 불일치로 유가족 알림 0건 등.

**규칙**:
1. 큐에 넣는 잡 데이터의 **필드 계약**을 워커가 기대하는 것과 정확히 맞춘다. 프로듀서와 컨슈머의 키 이름을 한 곳(상수)에서 관리하는 것을 권장.
2. 워커의 INSERT는 대상 테이블의 NOT NULL 컬럼을 전부 채운다 (스키마와 대조).
3. `ai_jobs` 등 추적 레코드 INSERT를 **큐 등록보다 먼저** 성공시킨다. 순서가 뒤바뀌면 DB 없는 고아 잡이 생긴다.
4. 알림 발송은 `notificationWorker`가 기대하는 형태(`{type:'email'|'sms', to, message}`)로 enqueue하고, in-app `notifications` INSERT도 함께 한다. 비회원 수신자는 `user_id`가 null임을 고려한다.
5. `ai_jobs.target_type` / `notifications.notification_type` / `notifications.target_type` 등 ENUM 값은 G1에 따라 상수로 쓴다.

---

## G7. 외부 서비스 제약 준수

1. **AWS S3 presigned URL 최대 7일(604,800초)**. 유언 영상 시청 링크를 90일로 발급하면 실패한다. 7일 이하로 발급하고 만료 시 재발급 흐름을 둔다 (SPEC-05의 90일 열람 정책은 "재발급으로 90일 유지"로 구현).
2. **BullMQ v5 repeatable**은 `repeat: { cron }`이 아니라 `repeat: { pattern }` 또는 `upsertJobScheduler`. 정기결제 크론이 조용히 미등록될 수 있으니 기동 시 스케줄 등록 로그로 검증한다.
3. **토스 customerKey**는 빌링키 발급 시와 결제 시 값이 일치해야 한다. 한 값(userId 권장)으로 통일한다.
4. 환경변수 이름을 하나로 통일한다 (`S3_BUCKET` 하나. `AWS_BUCKET_NAME` 같은 이명 금지). `validateEnv.js`에 필수 목록으로 등록한다.

---

## G8. 병합 전 체크리스트 (CI에 넣을 것 권장)

새 코드를 병합하기 전에 아래를 통과시킨다. 이 감사에서 나온 결함의 대부분은 자동 검출 가능했다.

- [ ] **스키마 drift**: schema-drift-auditor 또는 스크립트로 Zod ENUM ↔ enums.ts ↔ DB ENUM ↔ Repository 리터럴 4축 대조 (G1)
- [ ] **mock 폴백 스캔**: `grep -rn "mock" frontend/src` 중 catch/프로덕션 경로 없음 (G2)
- [ ] **결제 서버검증**: prepare/confirm에 가격 서버조회·소유권 검증 존재 (G3)
- [ ] **트랜잭션**: 다중 테이블 쓰기 함수에 getConnection/commit/rollback 존재 (G4)
- [ ] **soft delete 필터**: 신규 SELECT/UPDATE에 deleted_at 필터 (G5)
- [ ] **NOT NULL 충족**: 신규 INSERT가 대상 테이블 NOT NULL 컬럼 전부 포함 (G6)
- [ ] **rate limit**: 신규 결제·AI·공개토큰 엔드포인트에 limiter 적용 (아래 G9)
- [ ] 빌드 성공 + E2E 핵심 플로우 통과
- [ ] code-reviewer 스킬 재검증

---

## G9. 보안 기본선

1. **rate limit**: 결제·구독·AI 생성·공개 토큰/slug 조회 엔드포인트에 반드시 적용. 현재 subscription·pet portrait·memorial·watch가 누락 상태.
2. **토큰 저장**: accessToken은 메모리, refreshToken은 HttpOnly 쿠키. **관리자 토큰도 동일 패턴**으로 통일 (localStorage 금지).
3. **OAuth**: 카카오 콜백에 `state` 파라미터로 CSRF 방어.
4. **업로드 키 소유권**: 클라이언트가 보낸 S3 키/URL이 `{도메인}/{본인userId}/` 접두사인지 검증 (타인 파일로 AI 처리 방지).
5. **에러 노출**: 500 응답은 프로덕션에서 고정 메시지만. `err.message`(mysql 컬럼명 등)를 클라이언트에 반환 금지, 로그로만.
6. **JWT**: `jwt.verify(..., { algorithms: ['HS256'] })` 명시.
7. 커밋 전 `rules/security.md` 체크리스트 준수.

---

## G10. "구현 완료" 보고를 그대로 믿지 마라 (2026-08-22 추가)

이번 개발 과정에서 **"완료"로 보고받은 항목이 실제로는 코드가 없던 사례**가 여러 건 나왔다. 사람이든 AI든 마찬가지다.

실제 사례:
- **DEV-08 자동 환불**: "실패 시 자동 환불 + 통지 + 로그 3종 구현" 보고를 받았으나, 나중에 확인하니 **토스 환불을 부르는 코드가 어디에도 없었다.** 워커는 주문을 `failed`로 표시만 하고 아무도 그걸 소비하지 않았다.
- **관리자 로그인**: 세션 작업을 하려고 열어보니 응답 shape 불일치로 **원래부터 로그인 자체가 깨져 있었다.** 3차에 걸친 교차검증에서도 안 나왔다.
- **초상화 스타일**: "payload 전송 수정 완료" 보고 후에도 값이 전달되지 않았고, 전달되게 고친 뒤에도 **워커가 그 값을 읽지 않아** 결과는 여전히 같았다.
- **`aiLimiter` 키 전략**: grep만으로 "없을 가능성"을 지적한 것이 후속 태스크로 승격됐는데, 파일을 열어보니 **이미 올바르게 구현돼 있었다**(반대 방향 오류).

### 규칙
1. **완료 판정은 "코드가 있다"가 아니라 "경로가 이어진다"로 한다.** 프로듀서가 값을 보내는 것과 컨슈머가 그 값을 쓰는 것은 별개다. 양쪽을 다 확인하라.
2. **grep 결과만으로 결함을 단정하지 마라.** 파일을 열어 확인한 뒤 보고한다. 반대로 "grep에 안 잡히니 없다"도 금물이다.
3. **작업을 시작할 때 그 기능이 원래 동작하던 것인지 먼저 확인하라.** "고치러 갔더니 처음부터 깨져 있었다"가 반복됐다.
4. 다중 에이전트로 나눠 작업하면 **경계에 결함이 생긴다.** 한쪽이 정규화한 것을 다른 쪽이 전제로 삼고 있으면 조용히 무력화된다(실제 사례: 타임아웃 정규화가 재선점 안전장치를 무력화).
5. 보고서에 "구현했다"고 쓸 때는 **어느 파일 몇 행에서 어느 파일 몇 행으로 값이 흐르는지** 적어라. 그게 없으면 검증자가 같은 확인을 처음부터 다시 해야 한다.

## G11. DB 행을 응답에 그대로 스프레드하지 마라 - 응답 DTO는 화이트리스트로 명시한다 (2026-08 추가)

**문제**: 서비스 레이어가 리포지토리에서 받은 DB 행 객체를 `{ ...row }` 형태로 그대로(또는 `omitId`처럼 알려진 필드 1개만 제거하고) HTTP 응답에 흘려보내는 패턴이 여러 도메인에 있었다. 이 패턴은 테이블에 새 컬럼이 추가되는 순간 그 컬럼도 자동으로 클라이언트에 노출된다 - 실제로 다음이 새고 있었다:

- **`willService.getWill`**: `{ ...omitId(will), beneficiaries }`로 `wills` 행을 스프레드하면서 `result_video_s3_key_encrypted`/`result_video_kms_key_id`(유언 영상의 KMS 암호화 S3 키 참조값 - `.claude/CLAUDE.md`가 KMS 암호화 필수 대상으로 명시한 데이터의 접근 경로)까지 그대로 응답에 실렸다. 영상 재생/다운로드는 이 필드가 아니라 `verifyWatchAccess`가 그때그때 KMS 복호화 후 발급하는 presigned URL로만 나가야 하므로, 이 두 필드는 어떤 경로로도 클라이언트에 노출되면 안 된다.
- **`photoService.getResult` / `petService`의 미디어 조회·등록**: `photo_files`/`pet_media` 행을 스프레드하면서 `s3_key`(내부 버킷 저장 경로 원본)까지 노출됐다. 클라이언트는 `file_url`(presigned/공개 URL)만 있으면 되고, 원본 저장 경로는 필요도 없고 불필요한 내부 구조 정보다.
- **내부 `id`(AUTO_INCREMENT PK)**: `omitId`/`omitIds`(블랙리스트 - `id` 1개만 제거)로 이미 한 차례 수정된 이력이 있다(DEV-33). 블랙리스트 방식은 **그 시점에 알려진 필드만** 막고, 그 이후 추가되는 민감 컬럼은 막지 못한다 - 위 KMS 참조값 유출이 바로 그 사례다.

**규칙**:
1. 서비스 레이어의 `return` 직전(DB 행 → HTTP 응답 변환 지점)에서는 **화이트리스트**로 응답 필드를 명시한다. `backend/src/utils/dto.js`의 `pick(row, fields)` / `pickAll(rows, fields)`를 쓴다 - 명시한 필드만 통과하므로 테이블에 새 컬럼(민감하든 아니든)이 추가돼도 화이트리스트에 넣기 전까지는 자동으로 새지 않는다.
2. `{ ...row }` 형태의 전체 스프레드는 서비스 레이어에서 금지한다. `SELECT *`나 명시적 SELECT로 가져온 행을 컨트롤러/서비스가 가공 없이 그대로 반환하지 않는다.
3. **SELECT 자체는 건드리지 않는다.** 내부 로직(트랜잭션, 재조회, 워커 내부 전달값 등)이 그 필드를 실제로 쓰는 경우가 많다(예: `will.result_video_s3_key_encrypted`는 `issueWatchVideoUrl`이 KMS 복호화에 실제로 쓴다). 필터링은 응답으로 나가는 지점에서만 한다 - SELECT 컬럼을 줄이면 내부 로직이 깨진다.
4. 소유자 본인에게만 의도적으로 노출하는 필드(예: `pets.memorial_access_code`)는 화이트리스트에 넣되, 그 값이 실제로 소유권 검증(`user_id` 일치 확인)을 통과한 경로에서만 반환되는지 반드시 확인하고 주석으로 근거를 남긴다(`petRepository.findPetById` 상단 주석이 이 패턴의 예시).
5. 신규 테이블/컬럼 추가 시, 그 컬럼이 `*_encrypted`/`*_kms_key_id`/`*_hash`/`token`/`s3_key`(원본 경로) 패턴이면 기본값은 "응답에 포함하지 않음"이다 - 필요해지면 그때 화이트리스트에 명시적으로 추가한다.

## 부록: 이 규약이 나온 근거

각 규칙은 2026-08-21 전체 감사 리포트(`docs/review/2026-08-21-full-audit.md`)의 발견에서 도출됐다. 규칙 위반이 실제로 어떤 기능을 어떻게 망가뜨렸는지는 그 리포트의 대응 항목을 참조.
