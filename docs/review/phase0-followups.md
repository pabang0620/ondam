# Phase 0 이후 후속 태스크 (2026-08-22 / 2026-08-23)

> **구성**: A~D절은 2026-08-22 정적 감사 기준 원문(수정하지 않음).
> **E~H절은 2026-08-23 실기동 검증 라운드에서 추가**했다(개발 잔여 E / 법무 F / 오너 액션 G /
> 미검증 영역 H). 지금 착수할 것을 찾는다면 E절부터 본다.

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

---

# 2026-08-23 검증 라운드 후속 (E~H절)

> 위 A~D절은 **DB·Redis 없이 정적 분석만 하던 시기**에 작성됐다. 아래 E~H절은
> **처음으로 실기동한 뒤** 남은 것이다. 발견 경위와 수정 내역은
> `review/2026-08-23-verification-record.md`를 본다.
>
> A절("실환경 검증이 먼저")의 1·5·6·7번은 이번 라운드에 수행됐다. 2·3·4번(토스 실제
> 동작)은 벤더 계정이 없어 그대로 남아 있고 H절로 옮겨 적었다.

## E. 개발 잔여

### E-1. 동의 관리 화면 - **`GET /api/auth/consents` 신설이 선행**

- **현황**: 동의 검증 게이트와 append-only 이력은 이번에 만들었으나, **사용자가 자기 동의
  상태를 보고 철회하는 수단이 없다.** 저장 API(`POST /api/auth/consents`)만 있고 조회
  라우트는 존재하지 않는다(실측: `authRoutes.js`에 `router.get('/consents')` 없음,
  백엔드·프론트 전체에 `getConsents`류 식별자 0건).
- **선행 작업**: `GET /api/auth/consents` 신설. 유형별 최신 1건
  (`ORDER BY agreed_at DESC, id DESC LIMIT 1`)을 반환한다. 조회 함수 패턴은 이미
  `authRepository.findConsentByType`에 있다.
- **화면 요구**: 철회 시 파급을 **철회 버튼을 누르기 전에** 사용자에게 경고해야 한다.
  게이트가 실제로 작동하므로 철회는 진행 중인 것들을 실제로 멈춘다:
  - 진행 중인 AI 처리가 워커 단에서 중단된다(`photoWorker`·`videoWorker`가 벤더 호출
    직전에 재확인한다)
  - 중단된 건은 자동 전액 환불 대상이 된다
  - 즉 "동의를 껐더니 결제한 작업이 취소되고 환불됐다"가 정상 동작이다. 사전 경고 없이
    이런 일이 벌어지면 CS 사고가 된다.
- **법무 연동**: 개인정보보호법상 철회 수단 제공이 의무인지에 따라 이 항목이 출시 전
  필수가 될 수 있다(F-1).

### E-2. `voiceWorker`에 동의 재검증이 없다

- **근거**: 2026-08-23 실측. `photoWorker`(portrait·ai_generation)와
  `videoWorker`(voice·portrait·ai_generation)는 벤더 호출 직전에 동의를 재확인하는데,
  `voiceWorker`는 ElevenLabs 음성 등록 API를 호출하면서 재확인하지 않는다. 게이트는
  상류 `willService.uploadVoiceSample`에만 있다.
- **영향**: **큐 대기 중 철회 시나리오가 음성 클론 경로에서만 열려 있다.** 이번 라운드에
  videoWorker에서 재현해 막은 바로 그 시나리오다. E-1의 철회 화면이 생기면 실제로 밟히는
  경로가 된다.
- 조치: `videoWorker`의 재검증 블록과 동일한 패턴을 `voiceWorker`에 추가.

### E-3. `pet` 도메인에 동의 검증이 0건

- **근거**: 2026-08-23 실측. `backend/src/domains/pet/` 전체에 consent 관련 코드가 없다.
- 펫 AI 초상화도 AI 생성물이므로 `ai_generation` 동의 대상인지 판단이 필요하다. 사람
  초상권과 성격이 다를 수 있어(반려동물은 초상권 주체가 아니다) **정책 판단이 코드보다
  먼저다.** 판단 없이 게이트만 붙이면 기존 사용자의 펫 초상화가 전부 막힌다.

### E-4. 선물 수행 경로의 폴링이 실패·환불에서 멈추지 않는다

- **근거**: 2026-08-23 실측. 사진관(`usePhotoProcessing`)과 영상 편지
  (`useWillProcessing`)의 무한 폴링은 고쳤으나, 브라우저로 밟지 않은 선물 수행 경로는
  그대로다.
  - `useGiftPerformPhoto`: `completed`/`failed`만 분기. `refunded`에서 타이머가 안 멈춘다
  - `useGiftPerformWill.pollVideoReady`: 성공 조건(`willStatus === 'active'`)만 있고
    실패 분기가 **아예 없다**
- 증상은 사진관에서 고친 것과 같다 - 스피너가 영원히 돈다. curl로는 정상 응답이다.

### E-5. 표시용 가격 하드코딩 잔존

- 결제 실금액은 서버 정본(`preparePayment` 응답 `amountKrw`)으로 통일됐으나, **화면 표시용
  가격 하드코딩은 남아 있다.**
- 특히 `PetSubscriptionPage`는 `GET /subscriptions/plans`를 호출해 서버 플랜을 받아
  두고도 **로컬 상수를 렌더한다.** 값이 우연히 일치할 뿐이라 서버에서 가격을 바꾸면
  화면만 옛 값으로 남는다.
- 랜딩·상품 소개 화면(`HomeServices`, `HomeHero`, `HomeBottomCta`, `PhotoPage`,
  `WillPage`, `GiftNewPage`, `GiftPaymentPage`)에도 표시용 가격 문자열이 있다.
- 가격은 오너 결정 사항이라 코드 정리 전에 "표시 가격의 정본을 어디에 둘지"를 먼저
  정해야 한다.

### E-6. 알림톡 어댑터 - **벤더 선정 후**

SMS 폴백 구조는 준비돼 있다. 템플릿 심사 리드타임이 최대 병목이다(`strategy/13`).
도메인 확보(G-1)가 선행된다.

### E-7. 계측 이벤트 심기 - **도구 선정 후**

KPI 8개 중 6개는 서버 DB만으로 산출 가능해 급하지 않다(`strategy/12`).

### E-8. `fail_reason` 계열을 응답 직전에 한 번 더 거르기

- **현황**: 벤더 원문이 사용자에게 새지 않도록 **소스 쪽을 안전하게 맞춰 둔 상태**다
  (기록되는 값 자체를 안전한 문구로 만든다). 응답 직전 필터는 없다.
- **왜 남기나**: 새 코드가 벤더 예외를 그대로 `fail_reason`에 적으면 다시 샌다. 소스에서
  막는 방식은 "모든 작성 지점이 규칙을 지킨다"를 전제하는데, 그 전제는 시간이 지나면
  깨진다. 응답 화이트리스트(G11)와 같은 성격의 마지막 방어선이 하나 더 있으면 좋다.
- 지금 새고 있다는 뜻은 아니다. **구조적 보강 항목**이다.

### E-9. 응답 필드 케이스 통일 - **이번 drift의 근본 원인. 지금은 미룬다**

- **현황**: "생성 응답은 camelCase로 수동 구성, 조회 응답은 snake_case 그대로"가 도메인마다
  섞여 있다. 이번 라운드 브라우저 발견 결함의 상당수(`/pet/undefined`,
  `willId=undefined`, `subscriptionId=undefined`, 마이페이지 크래시, 관리자 `Invalid Date`)가
  전부 여기서 나왔다.
- **왜 지금 안 하나**: 지금 통일하면 **정상 작동 중인 화면이 깨진다.** 프론트 전 화면이
  현재 표기에 맞춰 고쳐진 직후라, 표기를 바꾸면 방금 고친 것을 다시 깨뜨린다.
- 별도 스코프로 계획을 세워 한 번에 한다. 그때까지 **신규 코드는 camelCase 원칙**만
  적용한다(기존 C-1 · `PLANNING-INDEX` 4절 7번과 같은 항목).

### E-10. `authService`에 이름이 같고 값이 다른 상수가 2개 있다

- **근거**: 2026-08-23 실측. `authService.js`에
  `REQUIRED_ACCOUNT_CONSENT_TYPES = ['privacy','terms']`(export)와, 별도 스코프의
  `REQUIRED_CONSENT_TYPES` **두 개**가 있다. 하나는 위 export를 감싼 Set이고, 다른 하나는
  `saveConsents`용으로 `['privacy','portrait','voice','ai_generation','posthumous_release']`
  (terms·marketing 제외)다.
- 지금은 각자 올바르게 동작한다. 다만 **같은 이름이 파일 안에서 다른 값을 갖는 구조**라
  다음 수정자가 잘못된 쪽을 고칠 위험이 있다. 이름을 구분하는 정도의 정리 항목이다.

## F. 법무 검토 추가 항목 (4건)

> 아래 4건은 `docs/legal/README.md` 3-5절에 정식 항목(N-01~N-04)으로 등재했다.
> 여기서는 개발 일정에 미치는 영향만 적는다.

| # | 항목 | 개발 영향 |
|---|---|---|
| **N-01** | **개인정보보호법상 동의 철회 수단 제공이 의무인지.** 현재 화면이 없다 | **의무라면 E-1이 출시 전 필수가 된다.** 이 답에 따라 E-1의 우선순위가 바뀐다 |
| N-02 | AI 생성 사진(영정·증명)에 "생성 결과물은 법적 문서가 아니다"류 고지가 필요한지. 현재 고지는 영상 편지 계열 화면에만 있다 | 필요하면 사진관 경로에 `LegalNotice` 삽입 |
| N-03 | 이번에 새로 생긴 법적 고지 7개 접점이 약관 제13조와 정합한지. 문구는 제13조를 쉬운 말로 옮긴 것이고 화면에 조문 번호는 표시하지 않는다 | 문구 수정 시 `LegalNotice` 공용 컴포넌트 1곳만 고치면 된다 |
| N-04 | 동의 이력을 append-only로 전환했으나 **보존 기간·삭제 요구 대응 정책이 없다.** 이력은 무한히 쌓이고, 탈퇴·삭제 요구가 들어왔을 때 증빙 보존과 삭제 의무가 충돌한다 | 정책이 정해져야 파기 배치를 설계할 수 있다 |

## G. 오너 액션 (코드로 해결 불가)

### G-1. 도메인 확보 - **최대 병목**

토스 웹훅 URL, 카카오 OAuth Redirect URI, 알림톡 링크가 **전부 도메인을 요구한다.**
없으면 벤더 심사 신청서 자체를 쓸 수 없다. 이것 하나가 아래 G-2 대부분의 선행 조건이다.

### G-2. 벤더 계정

| 벤더 | 용도 | 비고 |
|---|---|---|
| 토스페이먼츠 | 결제 전체 | **상점 심사** 필요 |
| D-ID | 립싱크 (1차 확정, `strategy/08`) | |
| Gemini | AI 사진 처리 | 코드 실사용 벤더 |
| ElevenLabs | 음성 클론·TTS | |
| 알림톡 | 알림 | **채널 개설 + 템플릿 심사**. 리드타임 최장 |
| AWS | S3 · KMS | |

### G-3. 법무 초안 3종 변호사 검토 발주

`docs/legal/`의 이용약관·개인정보처리방침·환불규정 초안. 검토 요청서는
`docs/legal/README.md`가 그대로 쓸 수 있게 정리돼 있다(기존 47건 + N-01~N-04).

## H. 미검증 영역 (벤더 키 부재로 이번에 확인 불가)

**"정상"이 아니라 "한 번도 실행되지 않았다"로 읽어야 한다.** 이번 라운드에 **환불 경로가
한 번도 실행된 적이 없었다는 사실**(`PAYMENT_MOCK`이 환불 경로에 없어 환불 전량 실패)이
실행 검증에서 드러났다. 아래 목록에 같은 성격의 미실행 경로가 남아 있다고 보는 편이 안전하다.

| 영역 | 무엇이 미확인인가 |
|---|---|
| 실제 AI 처리 결과 | Gemini·ElevenLabs·립싱크 벤더의 실제 응답과 결과물 품질. 어댑터 스펙 자체가 미검증(DEV-01) |
| 실결제 | 토스 SDK 왕복, `confirm` 응답 형태, 동일 orderId 재전송 거부 여부와 실제 에러코드 (`ALREADY_PROCESSED_ERROR_CODES` 목록은 여전히 **추정값**) |
| 실환불 | 토스 환불 API 실호출. 부분 환불·환불 실패 시 동작 |
| 알림 실제 도달 | SMS·알림톡이 실제 단말에 도착하는지 |
| 구독 빌링 전체 | 빌링키 발급 → 첫 결제 → 정기 청구 → 실패·재시도 → 해지 전 구간 |
| 카카오 OAuth | Redirect URI가 도메인을 요구해 시도 자체가 불가 |
| 결제 웹훅 | 서명 검증이 토스 실제 헤더 포맷과 맞는지 (HMAC-hex는 **가정**) |
| S3 실제 저장 | 업로드·presigned URL 발급·만료 |
| KMS 실제 암호화 | 봉투 암호화는 **로컬 폴백 경로로만** 왕복 검증했다. 실제 KMS API 왕복은 미확인 |

---

# 2026-09-30 상용화 품질 라운드 후속 (I절)

> 근거: `review/2026-09-30-commercial-readiness-round.md`. 위 절의 상태 변경도 여기 적는다
> (원문은 고치지 않는다).

## 기존 항목 상태 변경

- **E-4 해소**: 선물 사진·영상 폴링이 failed/refunded/알 수 없는 상태에서 멈춘다. 연속 조회 실패도 상한을 두고 멈춘다.
- **C-6 확인**: `preparePayment`가 기존 ready 결제를 재사용한다(이미 반영돼 있었음).

## I. 이번 라운드 잔여

### I-1. 검증 공백 - **다음 착수 1순위**
- 로컬 DB·Redis로 이번 변경 경로 API 스모크: 결제 confirm 재호출·셀프 환불 거부, 탈퇴 409, refresh 회전, 카카오 콜백 redirect(코드 경로만), 영상 열람 복호화(로컬 KMS 폴백).
- 자동 테스트 부재: `backend/tests/`가 없고 `server.js`가 import 즉시 listen해 supertest로 app만 가져올 수 없다. app/listen 분리가 선행이다. frontend에는 lint·test 스크립트가 없다.
- 이번 diff(`ad1219c..f864e40`) 행동 중심 코드 리뷰가 중단됐다. 특히 `middleware/auth.js`의 `req.baseUrl` 기반 관리자 토큰 허용, `toKmsCipherBuffer`의 base64 오판 가능성, refresh 실패 분기를 다시 본다.

### I-2. 백엔드
- 사후공개 승인 시 `token_expires_at`을 설정하는 곳이 없다 → 새 열람 링크가 만료되지 않는다(정책은 released_at + 90일).
- `videoWorker`의 AI_MOCK 경로가 실제 KMS `encryptString`을 호출해 KMS_KEY_ID가 비면 로컬에서 실패한다.
- 워커 프로세스에서 `getIo()`가 null이라 사진·음성·영상 진행률 소켓 이벤트가 전부 유실된다. redis adapter/emitter가 필요하다(신규 의존성 → 결정 필요). 프론트는 폴링으로 동작하므로 기능은 유지된다.
- 구독 결제 경로 사용자 이메일 조회 3곳(`subscriptionService.js:196·577`, `billingWorker.js:140`)에 `deleted_at IS NULL`이 없다. 탈퇴는 활성 구독이 있으면 막히므로(D6) 실영향은 낮다.
- 비밀번호 상한 72는 글자 수 기준이다. 한글이 섞이면 72바이트를 넘어 bcrypt 절단이 남는다.
- 탈퇴 시 구독 확인과 soft delete가 한 트랜잭션이 아니다.
- 사진 주문은 큐 투입 시점에 processing이 되어 SPEC-02 "대기열 = 착수 전"을 구분할 수 없다. 셀프 환불에서 processing을 뺐다 → SPEC-02 문구 또는 상태 설계 정합 필요.
- 선물 완료 전이를 워커로 옮기기(D4) - 지금은 화면 폴링 성공 시에만 completed가 된다.
- `kms.js`·`s3.js` 오류 분류가 `err.message` 문자열에 의존한다(G12).

### I-3. 프론트
- 구독 해지 문구(D3): 실제로는 즉시 혜택이 끝나는데 "기간 끝까지 이용"으로 안내한다.
- 카카오 신규 가입 필수 동의 미수집(D5) - 흐름 설계 필요.
- 사진 결과 다운로드는 presigned URL에 `ResponseContentDisposition: attachment`를 붙여야 근본 해결된다(지금은 안내 문구로 완화).
- 미사용 코드: `HomeLatestCarousel.jsx/.css`, `assets/images/home-latest/*.jpg` 5개, `assets/logo*.svg` 3개. 디자인 작업 의도 확인 후 정리.
- 푸터 약관·개인정보처리방침·고객센터는 페이지가 없어 텍스트로 바꿨다. 법무 초안 확정 후 페이지 필요.

---

## 관리 규칙

- 이 문서의 항목을 착수할 때는 `strategy/06-dev-backlog.md`에 DEV 번호로 등재하고 여기서 제거한다.
- 새 항목을 추가할 때는 근거(어느 리뷰의 어느 발견인지)를 함께 적는다.
- 규약은 `guidelines/DEVELOPMENT_GUIDELINES.md`(G1~G9)를 따른다.
