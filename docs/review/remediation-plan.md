# 온담 결함 개선 실행 플랜 (DEV-22~29)

> `docs/review/2026-08-21-full-audit.md`의 발견을 코딩 모델이 바로 착수할 수 있는 태스크로 분해한 것이다.
> 각 태스크는 한 번에 하나씩 코딩 모델에 준다 (해당 항목 전문 + `docs/guidelines/DEVELOPMENT_GUIDELINES.md` + `.claude/CLAUDE.md`).
> 규칙: 완료 후 code-reviewer 재검증, 상태를 `06-dev-backlog.md`에 반영. 전략 판단(가격·정책)은 바꾸지 않는다.

## 실행 순서 (의존성 반영)

```
DEV-22 (스키마·enums 동기화)  ← 뿌리. 먼저.
   ├─ DEV-24 (mock 폴백 제거)  ← 이게 있어야 이후 수정의 실제 동작 검증 가능
   ├─ DEV-23 (결제 서버검증)
   ├─ DEV-25 (토스 결제 왕복)     ← DEV-23 이후
   └─ DEV-26 (결제 크론·retry·알림 ENUM)
DEV-27 (인증·세션 프론트)  ← 병렬 가능
DEV-28 (보안 묶음)         ← 병렬 가능
DEV-29 (나머지 HIGH 로직)  ← DEV-22 이후
```

권장: DEV-22 → DEV-24 → (DEV-23·DEV-25·DEV-26) → (DEV-27·DEV-28·DEV-29). DEV-22가 다수 BLOCKER의 뿌리이므로 반드시 선행.

---

## DEV-22. 스키마·enums.ts 재동기화 (BLOCKER B-4 뿌리)

**상태**: 마이그레이션 파일·enums.ts 수정은 `docs/migrations/2026-08-21-schema-drift-fix.*`로 **이미 생성됨** (db-schema-architect). 남은 것은 (a) 사용자가 백업 후 마이그레이션 실행 (b) 코드측 후속 반영.

- 마이그레이션 실행: **사용자가 직접**. 백업 확인 후 UP 적용, 문제 시 DOWN. 에이전트가 ALTER 실행 금지.
- 코드 후속(코딩 모델):
  1. Zod 스키마(photoRoutes·willRoutes·subscriptionRoutes 등)가 하드코딩 enum 대신 `enums.ts` 상수를 import하도록 교체 (G1)
  2. Repository의 리터럴 ENUM 값(`'pet'`, `'canceled'`→`'refunded'`, `'payment_success'`→`'payment_done'`)을 상수로 교체
  3. soft-delete 시 email/slug 접미사 처리 추가 (G5-2), 가입 서비스 ER_DUP_ENTRY→409 (G5-3)
- 수용 기준: schema-drift 4축 대조 통과, 가입·사진주문(portrait/casual)·펫초상화·추모관조회·구독취소가 실제 성공.

## DEV-23. 결제 금액·소유권 서버 검증 (BLOCKER B-1)

- 대상: `backend/src/domains/payment/paymentService.js` preparePayment
- 작업 (G3):
  1. targetType별 실제 가격을 서버에서 조회(`photo_orders.price_krw` / `wills.price_krw` / `PLANS[plan].price`), 클라이언트 `amountKrw`와 다르면 400
  2. `target.user_id === userId` 소유권 검증 (아니면 403)
  3. `createWillSchema.priceKrw` 등 클라이언트 가격 입력 제거
  4. confirmPayment에 `SELECT ... FOR UPDATE` 락 추가 (경쟁조건, 감사 MEDIUM)
- 수용 기준: 금액 조작(100원) 요청이 400, 타인 targetId가 403, 정상 결제는 통과. 동시 confirm 중복 승인 없음.

## DEV-24. 프론트 mock 폴백 제거/게이트 (BLOCKER B-2)

- 대상: `frontend/src` 전역 (감사 프론트 리뷰 H1·H2·H4·H5·M12 및 40곳)
- 작업 (G2):
  1. 모든 catch의 성공 전환 코드 제거, 에러 표시로 교체
  2. 개발용 mock은 `import.meta.env.DEV` 게이트로 격리, mock 필드명을 실제 API와 일치
  3. **결제·인증·서류제출·삭제 관련 mock 폴백은 완전 제거**
- 우선 대상: `auth/useLogin.js`, `admin/useAdminLogin.js`, `pet/BillingAuthSuccessPage.jsx`·`usePetSubscription.js`, `will/useWillRelease.js`, `useAdminRelease.js`, `usePhotoProcessing.js`·`useWillProcessing.js`
- 수용 기준: `grep -rn "mock" frontend/src`에 프로덕션 경로 성공폴백 0건. 실패 시 사용자에게 에러가 보임.

## DEV-25. 토스 결제 왕복 실구현 (BLOCKER B-3)

- 대상: `frontend/src/pages/photo/photoApi.js`, `will/useWillPayment.js`, `lib/tossPayments.js`
- 작업 (G3-4): 하드코딩 `paymentKey` 제거, SDK requestPayment → successUrl 콜백 페이지에서 confirm 하는 왕복 구현. 금액은 서버 prepare 응답 기준. (구독 빌링 플로우가 이미 왕복 구현돼 있으니 참조)
- 수용 기준: 사진관·유언장 결제가 실제 토스 결제창→승인→상태전환 E2E 성공.

## DEV-26. 결제 크론·retryPayment·알림 ENUM (BLOCKER B-5·B-6, HIGH H-06)

- 작업:
  1. `server.js` 정기결제 스캔을 BullMQ v5 `repeat:{pattern}`/`upsertJobScheduler`로 수정, 기동 시 등록 로그로 검증 (G7-2)
  2. `subscriptionService.js` retryPayment·`billingWorker.js`의 `'payment_success'`→`'payment_done'`, 알림 INSERT를 결제 트랜잭션 밖 비차단으로 (B-6)
  3. 유언 공개 승인(`adminService.js`) 알림을 notificationWorker 계약(`{type:'email'|'sms',to,message}`)으로 enqueue + in-app notifications INSERT (H-06, G6-4)
  4. 구독 다중쓰기 트랜잭션화 (G4), billingWorker FOR UPDATE 범위 교정, pending 고아로그 복구 절차
- 수용 기준: 크론 실제 등록·발화, 재시도 성공 시 200·중복결제 없음, 유가족에게 알림 실제 발송.

## DEV-27. 인증·세션 프론트 결함 (HIGH H-01·H-02·H-04)

- 작업:
  1. `apiClient.js` refresh 인터셉터 제외 목록에 `/auth/refresh` 추가, refresh 실패 리다이렉트는 보호 라우트에서만 → 비회원 공개페이지(watch/release/memorial) 접근 복구 (H-01)
  2. `authStore`에 `isInitializing` 추가, `PrivateRoute`가 초기화 완료를 기다림 (H-02)
  3. 관리자 토큰을 localStorage에서 제거, 쿠키 기반 refresh로 일반 유저와 통일 (H-04, G9-2)
  4. 401 동시다발 single-flight refresh (감사 MEDIUM M1)
- 수용 기준: 비로그인으로 공개 링크 열람 가능, 새로고침해도 세션 유지, 관리자 토큰이 localStorage에 없음.

## DEV-28. 보안 묶음 (HIGH H-03·H-05 + MEDIUM 보안)

- 작업 (G9):
  1. 카카오 OAuth `state` 파라미터 발급·검증 (H-03)
  2. 음성/업로드 S3 키 소유권 접두사 검증 (H-05, G9-4)
  3. subscription·pet-portrait·memorial·watch 라우트 rate limit 추가 (G9-1)
  4. 500 에러 원문 노출 차단 (G9-5), JWT algorithms 명시 (G9-6)
- 수용 기준: security-reviewer 재진단에서 해당 항목 해소.

## DEV-29. 나머지 HIGH 로직 결함 (H-07~H-14)

- H-07 AI 초상화 payload 실제 전송(스타일·미디어ID) / H-08 이벤트영상 필드·eventType enum 수정 / H-09 결제취소 'refunded' / H-10 presigned 7일+재발급(G7-1) / H-11 카카오 email null 처리 / H-12 버킷 env 통일(G7-4) / H-13 펫 부분수정 undefined 필터(G6) / H-14 워커·관리자 UPDATE deleted_at 필터(G5-1)
- 수용 기준: 각 기능 실제 동작, 부분수정이 필드 유실 없음.

---

## MEDIUM/LOW 잔여

BLOCKER·HIGH 처리 후 별도 라운드로 정리. 상세는 감사 리포트 MEDIUM(14)·LOW(8) 목록 참조. 주요: confirm 락·구독 중복가입 차단·감사로그 actor_type·요청자 JOIN 키·refresh 세션패밀리 폐기·AI 응답 202·objectURL/마이크 cleanup·이메일 형식검증.

## 완료 정의 (전체)

1. BLOCKER 6 + HIGH 8 해소, 각 기능 E2E 실제 동작
2. `docs/guidelines/DEVELOPMENT_GUIDELINES.md` G8 체크리스트 통과
3. code-reviewer 스킬 재검증 APPROVED
4. 최종 손테스트 전 Playwright E2E (testing 규칙)
