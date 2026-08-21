# 온담 전체 코드 검토 종합 리포트 (2026-08-21)

> 5개 읽기 전용 에이전트 병렬 리뷰 결과를 취합·중복 제거한 것이다. 대상: backend/src 전체, frontend/src 전체, ondam_schema.sql.
> 리뷰 축: ① 보안(security-reviewer) ② 백엔드 로직 ③ 프론트엔드 ④ 스키마 drift ⑤ DB·쿼리.
> 코드는 수정하지 않았다. 각 항목은 담당 태스크로 인계한다.

## 총평

두 개의 지배적 결함 패턴이 시스템 전반에 깔려 있다.

1. **코드 ↔ 스키마 drift (ENUM·NOT NULL·존재하지 않는 컬럼)** - 3개 에이전트가 교차 확인. 가입·사진주문·펫초상화·추모관·구독취소 등 **핵심 기능이 "항상 실패"** 하는 원인. `shared/constants/enums.ts`가 DB 마이그레이션을 따라가지 못하고, Zod가 enums.ts를 import하지 않고 각자 하드코딩한 것이 근원.
2. **프론트 "API 실패 → mock 성공 폴백" 40곳** - dev 게이트 없이 프로덕션에 존재. 위 1번의 실패를 전부 "성공"처럼 보이게 가려서, 실제로는 저장/결제/제출이 안 되는데 화면상 정상으로 보인다. **이 두 결함의 결합이 가장 위험하다** - 결함이 눈에 안 띄게 은폐된다.

추가로 결제 라인(금액 위변조·소유권 미검증·취소 불가·크론 미가동·성공을 실패로 기록)에 결함이 집중돼 있어, **현 상태로는 실결제를 붙이면 안 된다.**

한편 견고하게 구현된 영역도 많다(아래 "정상 확인"). 골격은 잘 잡혀 있고, 결함은 대부분 "배선 미완성 + 스키마 동기화 누락" 성격이다.

## 심각도 집계

| 심각도 | 건수(중복 제거 후) | 성격 |
|---|---|---|
| BLOCKER | 6 | 핵심 기능 항상 실패 or 자금 손실 직결 |
| HIGH | 12 | 특정 기능 불동작·보안 노출 |
| MEDIUM | 14 | 정합성·원자성·rate limit |
| LOW | 8 | 방어심층화·정리 |

---

## BLOCKER (배포 차단 - 즉시)

### B-1. 결제 금액 위변조 + 대상 소유권 미검증 (자금 손실)
- 근거: 보안 #1·#2, 백엔드 H-10 (3중 확인)
- `payment/paymentService.js:24-40` preparePayment가 클라이언트 `amountKrw`를 그대로 신뢰. 실제 상품가(`photo_orders.price_krw`/`wills.price_krw`/`PLANS[plan].price`)와 대조 안 함 → **49,000원 상품을 100원에 결제 완료 가능**. targetId 소유권도 미검증(IDOR).
- 수정: preparePayment에서 targetType별 실제 가격 서버 조회 + `target.user_id === userId` 검증. `createWillSchema.priceKrw` 클라이언트 입력 제거.

### B-2. 프론트 mock 성공 폴백 40곳 (실패 은폐)
- 근거: 프론트 H1·H2·H4·H5·M12, drift SD-01 교차
- 로그인 실패→mock 로그인, 관리자 로그인 실패→mock admin 진입, 빌링키 실패→"구독 성공", **사망확인 서류 제출 실패→"제출 완료"**, 처리 폴링 실패→가짜 완료.
- 수정: mock 폴백 전량 제거 또는 `import.meta.env.DEV` 게이트. catch는 에러 표시만.

### B-3. 토스 결제 왕복 미구현 (사진관·유언장 결제 = 시뮬레이션)
- 근거: 프론트 H3
- `photo/photoApi.js:34-39`, `will/useWillPayment.js:35-40`이 `paymentKey: mock_${Date.now()}` 하드코딩. 토스 SDK requestPayment→successUrl 콜백 confirm 왕복이 없다(구독만 구현됨). 금액도 클라이언트 하드코딩.
- 수정: `lib/tossPayments.js`로 실제 결제 왕복 구현, 금액은 서버 응답 기준.

### B-4. 스키마 drift로 핵심 기능 항상 실패 (묶음)
- 근거: drift SD-01~04, DB CRITICAL, 백엔드 C-1·C-2·C-3, 보안 #3 (4중 확인)
- 다음이 전부 "항상 실패":
  - **회원가입 전면 차단**: 프론트 동의값(`terms/marketing`)이 Zod enum에 없어 422 (SD-01)
  - **추모관 조회 항상 500**: `pets.memorial_access_code` 컬럼이 스키마에 아예 없음 (C-3/보안#3). 컬럼을 NULL 허용으로만 추가하면 접근제어가 영구 우회되는 2차 위험
  - **펫 AI 초상화 항상 실패**: `ai_jobs.target_type='pet'` ENUM에 없음 + 큐 페이로드 계약 불일치 (C-2)
  - **사진 처리 완료 항상 실패**: `photoWorker`가 `photo_files.file_size`(NOT NULL) 누락 INSERT (C-1)
  - **사진 옵션 2종 실패**: `photo_type` 'portrait'/'casual'이 DB ENUM에 없음 (SD-03/H-5)
  - **구독 취소 항상 실패**: NOT NULL 컬럼에 NULL 설정 (C-4)
- 수정: `shared/constants/enums.ts`를 DB와 재동기화 + 필요한 마이그레이션(ai_jobs.target_type·photo_type 확장, pets.memorial_access_code 추가, 빌링키 컬럼 NULL 허용). Zod가 enums.ts를 SSOT로 import하도록 리팩터.

### B-5. 정기결제 크론 미가동 (추정)
- 근거: 백엔드 C-5
- `server.js:176-185` BullMQ v5인데 `repeat: { cron: ... }` 사용 - v5는 `pattern`. 스캔 잡이 조용히 등록 안 됨 → **자동 정기결제가 전혀 안 돎**. node_modules 미설치로 "추정", 실측 필요.
- 수정: `repeat: { pattern: ... }` 또는 `upsertJobScheduler`. 실제 스케줄 등록 로그로 검증.

### B-6. retryPayment - 결제 성공 후 500 응답 (이중결제 유발)
- 근거: 백엔드 H-2, DB CRITICAL
- `subscriptionService.js:342` 실결제 성공·구독 active 커밋 후 알림 INSERT가 `'payment_success'`(ENUM에 없음, 정답 `'payment_done'`)로 throw → 사용자는 "실패"로 인지 → 재클릭 시 이중결제. `billingWorker.js:130`도 동일.
- 수정: `'payment_done'`으로 수정 + 알림 INSERT를 결제 트랜잭션 밖 비차단 처리.

---

## HIGH

| ID | 항목 | 근거 | 위치 |
|---|---|---|---|
| H-01 | 비로그인이 공개페이지 접속 시 /login으로 튕김 (refresh 인터셉터 미제외) - 유가족 열람 링크 자체가 막힘 | 프론트 H6 | `config/apiClient.js:36-56` |
| H-02 | 새로고침 시 세션 복원 대기 없이 로그아웃 처리 | 프론트 H7 | `layouts/PrivateRoute.jsx:5-7` |
| H-03 | 카카오 OAuth `state` 부재 - 로그인 CSRF | 보안 #5 | `auth/kakaoAuthService.js:16` |
| H-04 | 관리자 JWT를 localStorage 저장 - XSS 시 탈취 | 보안 #4, 프론트 H10 | `config/adminApiClient.js:11` |
| H-05 | 음성 S3 키 소유권 미검증 - 타인 음성으로 클론 | 보안 #6 | `will/willService.js:21-66` |
| H-06 | 유언 공개 승인 시 유가족 알림 전무 (큐 잡 계약 불일치) | 백엔드 H-1 | `admin/adminService.js:88` ↔ `notificationWorker.js:95` |
| H-07 | AI 초상화 payload 빈 객체 - 선택 스타일·사진 미전송 | 프론트 H8 | `pet/usePetPortrait.js:62` |
| H-08 | 이벤트 영상 willId를 voiceSampleId로 전송 + eventType enum 불일치 | 프론트 H9, drift SD-02 | `will/useWillEvent.js:56` |
| H-09 | 결제 취소 시 주문 상태 환원 silent 실패 ('canceled' ENUM에 없음) | 백엔드 H-7, DB CRITICAL | `payment/paymentService.js:333` |
| H-10 | 유언 영상 presigned URL 90일 - SigV4 최대 7일 초과로 발급 실패 | 백엔드 H-8 | `will/willService.js:10,383` |
| H-11 | 카카오 가입 - email NOT NULL인데 미제공 시 null INSERT 500 | 백엔드 H-9 | `auth/authRepository.js:172` |
| H-12 | 업로드 버킷 env 이름 불일치 (AWS_BUCKET_NAME vs S3_BUCKET) - 업로드 실패 | 백엔드 H-6 | `common/uploadMiddleware.js:51` |
| H-13 | 펫 부분수정이 나머지 필드를 NULL로 덮어씀 | 백엔드 H-4 | `pet/petRepository.js:95` |
| H-14 | 워커·관리자 UPDATE 6곳 deleted_at 필터 누락 - 삭제된 유언장 공개 처리 가능 | DB HIGH | `admin/adminRepository.js:89,99` 등 |

> HIGH가 14개로 표 번호가 12를 넘는다 - 집계표의 "12"는 보안/기능 노출 계열 대표치이며, 위 표가 실제 전량이다.

## MEDIUM (14건, 요약)

- 결제 confirm 비관적 락 부재(경쟁조건) / 구독 결제 다중쓰기 트랜잭션 누락(B 아님, 자금 정합성) / billingWorker FOR UPDATE 무의미 + 수동재시도 이중결제 race / pending 고아 로그가 결제 영구 차단
- 401 동시다발 refresh single-flight 부재(정상 사용자 로그아웃) / AbortController signal 미전달 stale-response race / 중복제출 가드 dead code
- subscription·pet-portrait·memorial·watch 라우트 rate limit 부재 / 500 에러 원문 노출(mysql 컬럼명 등)
- 관리자 로그인 실패 감사로그 항상 실패(actor_type enum) / 공개요청 목록 요청자 JOIN 키 불일치(항상 NULL) / 연체 구독 둔 채 중복 구독 가능 / wills.price_krw 기본값 3중 불일치
- 상세는 각 원본 리뷰 참조.

## LOW (8건, 요약)

- JWT algorithms 미지정 / refresh 재사용 시 세션패밀리 미폐기 / photo sourceImageUrl 화이트리스트 없음 / AI 큐 응답 202 아님 / deprecated notificationRepository 스텁 / ROUTES 상수 리터럴 / 마이크·objectURL cleanup 누락 / 이메일·전화 형식검증 없음.

---

## 정상 확인된 영역 (골격은 견고)

- **결제 핵심 안전장치**: 토스 웹훅 HMAC 서명+timingSafeEqual, 웹훅 멱등성(payment_key UNIQUE), confirmPayment 멱등성, 빌링키 KMS 암호화 - CLAUDE.md 보안규칙 준수
- **정기결제 멱등성 3중 방어**: UNIQUE(sub,cycle,attempt) + findTodayLog + BullMQ jobId
- **IDOR 방어**: payment 1곳 제외 6개 도메인 18개 메서드 전부 소유권 검증
- **SQL 인젝션**: 전 리포지토리 파라미터 바인딩/화이트리스트, 값 결합 0건
- **인프라**: 타임존 KST 이중설정, utf8mb4 일관, 페이지네이션 상한, 배치 INSERT, FOR UPDATE 락(일부 도메인), Socket.IO JWT 검증, helmet, CORS 단일 origin, bcrypt(12)
- **lipsync 어댑터 인터페이스**: 3종 계약 일치, videoWorker 정합 (벤더 스펙 자체는 미검증 = DEV-01 대상)
- **Zustand 셀렉터·폼 제출 비활성화·어르신 UX 토큰**(48px/16px) 대체로 준수

---

## 수정 우선순위 (권장 순서)

1. **B-4 스키마 재동기화** (enums.ts + 마이그레이션) - 다른 다수 결함의 뿌리. db-schema-architect MIGRATE
2. **B-1 결제 금액·소유권 검증** - 자금 직결. express-engineer
3. **B-2 mock 폴백 제거** - 결함 은폐 해제(이게 있으면 다른 수정의 검증이 불가). react-specialist
4. **B-3 토스 결제 왕복 구현** - react-specialist + express-engineer
5. **B-5·B-6 결제 크론·retryPayment** - express-engineer
6. HIGH H-01·H-02(공개페이지 접근) → H-03~H-14 순
7. MEDIUM 트랜잭션·rate limit 묶음
8. 전량 수정 후 code-reviewer 스킬 재검증 + tdd-guide 재현 테스트

## 인계 태스크 (strategy/06-dev-backlog.md에 DEV-22~ 등재)

- DEV-22: 스키마·enums.ts 재동기화 (B-4) - db-schema-architect
- DEV-23: 결제 금액·소유권 서버 검증 (B-1)
- DEV-24: 프론트 mock 폴백 제거/게이트 (B-2)
- DEV-25: 토스 결제 왕복 실구현 (B-3)
- DEV-26: 결제 크론·retryPayment·알림 ENUM (B-5·B-6·H-06)
- DEV-27: 인증·세션 프론트 결함 (H-01·H-02·H-04)
- DEV-28: 보안 묶음 (H-03 OAuth state·H-05 S3키 소유권·MEDIUM rate limit·500 에러 원문)
- DEV-29: 나머지 HIGH 로직 결함 (H-07~H-14)
