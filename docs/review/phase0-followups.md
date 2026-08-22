# Phase 0 이후 후속 태스크 (2026-08-22)

> Phase 0 결함 개선(DEV-22~29 + 3라운드 수정) 과정에서 발견됐으나 범위 밖으로 남긴 항목이다.
> 근거: `2026-08-21-full-audit.md`(1차 감사) + 3차에 걸친 교차검증 리포트.
> 우선순위는 "실사용을 막는가 / 돈이 새는가"를 기준으로 매겼다.

## A. 실환경 검증이 먼저 (코드 수정 전)

Phase 0은 DB·Redis·토스 연동 없이 정적 분석만으로 진행했다. 아래는 **실제로 돌려봐야만 알 수 있는 것**이며, 여기서 나오는 결과가 후속 우선순위를 바꿀 수 있다.

1. **마이그레이션 적용** (사용자, 백업 후): `2026-08-21-schema-drift-fix` → `2026-08-21b-memorial-visibility-and-consent` 순서 엄수
2. **토스 동일 orderId 재전송 거부 여부** - 현재 정기결제 멱등 설계 전체가 "토스가 같은 주문번호를 거부한다"는 가정 위에 있다. 거부 시 실제 에러코드를 확인해 `ALREADY_PROCESSED_ERROR_CODES` 목록과 대조할 것(현재 목록은 추정값)
3. **`GET /v1/payments/orders/{orderId}` 응답 형태** - 상태 문자열이 정확히 `'DONE'`인지, 단일 객체인지 배열인지
4. **웹훅 서명 검증**이 토스 실제 헤더 포맷과 맞는지 (HMAC-hex 가정)
5. 핵심 플로우 E2E: 가입 → 사진 주문 결제 → 처리 → 수령 / 유언 편지 제작 → 결제 / 추모관 열람
6. 동시성: 재시도 버튼 더블클릭, 크론과 수동 재시도 동시 발생 시 결제 1건만 발생하는지
7. BullMQ 스케줄러 등록 로그가 기동 시 실제로 찍히는지

## B. HIGH (실사용·자금 영향)

### B-1. `subscribe()` 첫 구독 결제에 멱등성이 없다
- `subscriptionService.js`의 최초 결제 경로는 pending 선기록이 없고 orderId가 `Date.now()` 기반이라 매번 달라진다. 타임아웃 후 사용자가 재시도하면 **새 orderId로 2회 청구**된다.
- 정기결제 경로는 `reserveBillingAttempt`로 해결했으나 이 경로만 남았다. 같은 구조로 통일할 것.

### B-2. 비회원 유가족이 사망증명서를 업로드할 수 없다
- 유가족 서류 제출 화면이 `requireAuth`가 걸린 업로드 엔드포인트를 호출한다. 즉 **사후 전달의 시작점이 비회원에게 막혀 있다.**
- 초대 토큰(`invite_token`) 기반의 별도 업로드 경로가 필요하다. 사후 전달은 이 서비스의 핵심이므로 우선순위 높음.

### B-3. 관리자 세션이 새로고침·만료로 끊긴다 + 토큰이 localStorage에 있다
- 관리자 인증은 별도 identity 체계(`admin_users`)인데 **refresh 엔드포인트가 없다.** `adminToken`(accessToken 원본)을 localStorage에 저장하는 구조라 XSS 노출 위험도 남는다.
- 백엔드에 관리자 refresh + HttpOnly 쿠키를 만들고 프론트를 일반 사용자와 동일 패턴으로 통일해야 완결된다. Phase 0에서는 무한 루프만 차단했다.

### ~~B-4. `will`/`photo`의 `aiLimiter`가 ip 기준일 가능성~~ → **오탐 (2026-08-22 확인, 조치 불필요)**
- 실제 파일 확인 결과 `willRoutes.js:15`·`photoRoutes.js:15` 둘 다 이미 `keyGenerator: (req) => req.user?.userId ?? req.ip`로 올바르게 구현돼 있었다.
- 앞선 보고가 grep만으로 "없을 가능성"을 지적한 것이었다. **교훈**: 파일을 열지 않은 추정을 후속 태스크로 승격시키지 말 것.

## B-추가. 문서 진단·법무 초안 작성에서 새로 드러난 HIGH (2026-08-22)

### B-5. 이용약관 동의가 "선택"으로 되어 있다
- `frontend/src/pages/auth/useJoin.js:10` - `{ type: 'terms', label: '이용약관 동의', required: false }`. 실측 확인됨.
- 약관을 게시해도 **동의가 선택이면 계약 편입이 다투어질 수 있다.** 개인정보(`privacy`)만 필수로 되어 있다.
- 조치: `terms`를 필수로 변경 + 백엔드 필수 동의 집합(`REQUIRED_CONSENT_TYPES`)에도 반영. 단 **마이그레이션 b 적용 전에는 `terms` 저장이 실패**하므로(현재는 관대 처리로 건너뜀), 마이그레이션 적용 후에 필수화해야 한다. 순서 주의.

### B-6. 수신인별 링크·열람 추적 컬럼이 아예 없다
- `ondam_schema.sql` 실측: `video_token` 0건, `video_watched_at` 0건, `watch_count` 0건. `will_beneficiaries`에 있는 것은 `invite_token` 하나뿐.
- SPEC-05가 이들을 "기존 컬럼"이라 서술했으나 사실이 아니다(SPEC-05에 정정 반영함).
- 영향: **수신인별 개별 링크와 열람 추적이 구현 불가능**하다. 이를 전제로 쓰인 것들이 함께 막힌다 - SPEC-04의 미열람 리마인드, 약관 초안의 90일 링크·열람 기록 조항, SPEC-06 검수 화면의 열람 현황.
- 조치: 스키마 설계 결정(수신인별 토큰으로 나눌지, `invite_token` 하나로 갈지) → 마이그레이션 → DEV-12 선행.

## C. MEDIUM (정합성·운영)

### C-1. 도메인 간 응답 표기 불일치 (같은 결함의 온상)
- `pet` 도메인은 raw 로우(snake_case)를 그대로 반환하고 `memorial`만 camelCase다. 이번 추모관 갤러리 결함이 정확히 이 불일치에서 나왔다.
- 응답 표기 규칙을 정하고 도메인 전반을 통일할 것. 파급이 크므로 별도 계획 필요.

### C-2. 정기결제 스케줄 로직
- `_finalizeFailure`가 `next_billing_at`을 갱신하지 않아, `next_retry_at`과 재시도 간격이 **기록만 되고 실제 스케줄에 반영되지 않는다**(재시도는 일 1회 스캔에만 의존).
- 성공 시 `nextBillingAt`을 "오늘 기준"으로 계산해 재시도로 밀린 사이클마다 **월 청구일이 앞으로 드리프트**한다.

### C-3. `_finalizeSuccess`의 보상 환불이 모든 DB 예외에서 발동
- `payments.toss_payment_key`가 UNIQUE라 `ER_DUP_ENTRY` 같은 경우에도 **정상 결제를 환불**할 수 있다. 예외 종류를 구분할 것.

### C-4. `indeterminate` 결과의 사용자 안내
- `runBilling`이 불확정을 반환할 때 호출부(`billingWorker`, `retryPayment`)가 여전히 "실패"로 취급한다. 이중청구는 서버가 막지만, 사용자에게 "실패"로 보이면 불필요한 재시도를 유발한다.
- `payment_pending` 계열 알림/응답으로 분기할 것.

### C-5. `/auth/consents` 엔드포인트의 ENUM 취약
- 회원가입 경로에는 ENUM 거부 관대 처리를 넣었으나, 별도 동의 저장 엔드포인트는 그대로다. 마이그레이션 미적용 환경에서 실패할 수 있다.

### C-6. 결제 재시도 시 `payments` 레코드 중복 생성
- 실패 후 재클릭하면 `prepare`가 새 레코드를 만든다(주문이 `pending_payment`라 막히지 않음). 기존 `ready` 레코드를 재사용하거나 정리하는 정책 필요.

### C-7. `billingWorker`의 빌링키 null 가드 부재
- `decryptString` 호출 전 null 체크가 없다. 예외 시 pending 로그가 남고 `jobId` 중복 차단 + `attempts:1`로 **당일 재시도가 아예 없다.**

### C-8. 접근 코드 평문 저장
- `pets.memorial_access_code`가 평문이다. 소유자에게 원문을 되돌려주는 현재 요구사항과는 맞지만, 정책 재검토 여지가 있다.

### C-9. `refresh_tokens.user_id`가 일반 사용자·관리자 토큰을 혼용 저장한다
- 근거: 2026-08-22 관리자 세션 교차검증(항목 6). `adminRepository.js`의 `saveAdminRefreshToken`/`findAdminRefreshToken`/`findActiveAdminRefreshToken`/`revokeAllAdminRefreshTokens`가 전용 테이블 없이 `refresh_tokens.user_id`에 `admin_users.admin_id`를 그대로 저장·조회한다.
- FK가 없고(스키마 전체에 FK 미사용) UUID라 값 충돌이 없어 **오늘은 문제가 없다.** 다만 향후 "사용자 전체 토큰 일괄 폐기", 탈퇴 정리 배치, `refresh_tokens JOIN users` 같은 쿼리를 추가하면 이 테이블에 섞인 admin 행을 사용자 행으로 오인해 조용히 잘못 처리할 수 있다.
- 조치: 그런 쿼리를 새로 작성할 때는 대상 UUID가 `users` 소속인지 `admin_users` 소속인지 먼저 구분할 것. 스키마 주석에도 동일 내용을 남겼다(`ondam_schema.sql`의 `refresh_tokens` 테이블).
- 근본 해결(전용 `admin_refresh_tokens` 테이블 분리)은 스키마 변경이 필요해 이번 작업 범위 밖으로 남긴다.

## D. 미완 기능 (Phase 0 범위 밖으로 명시적으로 남김)

### D-1. DEV-25: 토스 결제 왕복 실구현
- 사진관·유언 편지 결제가 여전히 `paymentKey: mock_${Date.now()}`를 보낸다. SDK `requestPayment` → successUrl 콜백 → confirm 왕복이 미구현이다. **실결제는 이것 없이 불가능하다.**
- Phase 0에서 금액·orderId SSOT는 맞춰뒀으므로, 남은 것은 SDK 연동이다.

### D-2. DEV-16: 추모관 공개 선택(`is_public`)
- 마이그레이션 b가 컬럼을 추가하지만 서비스 로직·UI는 미구현. 적용 후 `memorialService` 판정 확장과 `petRoutes`/`PET_UPDATABLE_COLS` 매핑, 프론트 토글이 필요하다.

### D-3. 나머지 감사 MEDIUM/LOW
- `2026-08-21-full-audit.md`의 MEDIUM 14·LOW 8 중 Phase 0에서 다루지 않은 항목들. 실환경 검증 후 재우선순위화 권장.

## 관리 규칙

- 이 문서의 항목을 착수할 때는 `strategy/06-dev-backlog.md`에 DEV 번호로 등재하고 여기서 제거한다.
- 새 항목을 추가할 때는 근거(어느 리뷰의 어느 발견인지)를 함께 적는다.
- 규약은 `guidelines/DEVELOPMENT_GUIDELINES.md`(G1~G9)를 따른다.
