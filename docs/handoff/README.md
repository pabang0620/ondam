# 코딩 AI 인계 프롬프트 (복사해서 그대로 사용)

> 착수 가능 태스크의 인계 프롬프트다. 각 블록을 통째로 코딩 AI(Codex 등)에 붙여넣으면 된다.
> ~~승인 대기 항목~~ **2026-08-21 오너 확정 완료**: 보관구독 폐지·가격(베이직 단일가 선출시)·추모관 이원화 3건 모두 채택. DEV-11(가격)·DEV-16(추모관)·DEV-17(구독폐지)의 승인 게이트가 풀렸다. 단 실행 우선순위는 Phase 0 결함개선(DEV-22~29)이 먼저다.
>
> **2026-08-21 전체 감사 이후 우선순위 변경**: 배포 차단 결함(BLOCKER 6·HIGH 8)이 발견됐다.
> 신규 기능(DEV-01·05 등)보다 **결함 개선(DEV-22~29)이 먼저**다. 실행 순서·태스크별 상세는
> **`docs/review/remediation-plan.md`**, 재발 방지 규약은 **`docs/guidelines/DEVELOPMENT_GUIDELINES.md`**.
> 각 코딩 태스크에 그 2개 문서를 함께 준다.
>
> - DEV-03(스키마 중복 정리)은 **DEV-22에 흡수·완료됨** (아래 DEV-03 블록은 이력용. 실행하지 말 것).
> - DEV-22 마이그레이션 파일은 `docs/migrations/2026-08-21-schema-drift-fix.*` + `2026-08-21b-*`로 생성됨. **실행은 사용자가 백업 후 직접, a → b 순서.**

---

## 🔴 지금 가장 급한 인계 2건 (아래 옛 프롬프트보다 먼저)

### 1. DEV-25 토스 결제 왕복 구현 - **이것 없이는 어떤 상품도 팔 수 없다**
```
작업 디렉토리: /home/lee/project/ondam
필독: .claude/CLAUDE.md, docs/guidelines/DEVELOPMENT_GUIDELINES.md(G3 결제는 서버가 진실),
      docs/guidelines/TEST_STRATEGY.md(4-1 결제 통합 시나리오)

[현황] 사진관·영상편지 결제가 토스 SDK를 호출하지 않고 `paymentKey: mock_${Date.now()}`를
하드코딩해 confirm을 부른다. 즉 결제가 시뮬레이션이다. 구독(빌링키) 경로만 실제 왕복이 구현돼 있으니
`frontend/src/pages/pet/usePetSubscription.js`와 `lib/tossPayments.js`를 참조 구현으로 삼아라.

[작업]
1. 프론트: prepare 응답(tossOrderId, amountKrw)으로 토스 SDK `requestPayment` 호출 →
   successUrl 콜백 페이지에서 paymentKey/orderId/amount를 받아 confirm 호출.
   failUrl 처리(사용자 취소/실패)도 함께. 대상: photo/will 결제 훅·API
2. 서버 금액은 이미 정본이다(DEV-23 완료). 클라이언트가 금액을 만들어 보내지 마라.
3. `PhotoPaymentPage`의 "테스트 모드 모의결제" 배너 제거
4. `PAYMENT_MOCK` 환경변수 경로는 유지하되 프로덕션에서 켜지지 않게 확인

[수용 기준] 토스 테스트 키로 결제창 → 승인 → confirm → payments.status='done',
주문 상태 전이까지 E2E 성공. 취소/실패 경로도 사용자에게 쉬운 한국어로 안내.
[금지] 서버 결제 로직(paymentService) 재설계. 이미 3차 검증을 거쳤다. 프론트 배선이 과제다.
```

### 2. 비회원 유가족 사망증명서 업로드 경로 - **사후 전달의 시작점이 막혀 있다**
```
작업 디렉토리: /home/lee/project/ondam
필독: docs/specs/SPEC-05-letter-delivery.md, SPEC-01-gift-flow.md(무인증 토큰 설계 참조),
      docs/review/phase0-followups.md B-2

[현황] 유가족이 사망증명서를 올리는 화면이 requireAuth가 걸린 업로드 엔드포인트를 호출한다.
즉 비회원 유가족은 서류를 낼 수 없다. 사후 전달이 이 서비스의 핵심인데 시작점이 막혀 있다.

[작업 - 설계 결정이 포함되므로 먼저 설계를 제안하고 진행하라]
1. 초대 토큰(will_beneficiaries.invite_token) 기반의 무인증 업로드 경로를 설계하라.
   S3 키 스코프를 userId가 아니라 토큰/beneficiary 기준으로 잡아야 한다.
2. 보안 필수: 토큰 검증, 파일 타입·크기 제한, 업로드 횟수 제한, 키 경로 조작 차단,
   KMS 암호화(사망증명서는 민감 데이터)
3. 기존 인증 업로드 경로를 약화시키지 마라. 별도 경로로 분리하라.

[수용 기준] 비회원이 링크로 진입해 서류 업로드 → 관리자 검수 큐에 노출까지 E2E.
[주의] 무인증 경로이므로 구현 후 보안 점검 필수.
```

---

---

## DEV-03: DB 스키마 중복 정리 (가장 작은 건, 먼저 던지기 좋음)

```
작업 디렉토리: /home/lee/project/ondam

[작업] ondam_schema.sql에 subscription_payment_logs 테이블의 CREATE TABLE 정의가
두 곳(약 601행, 914행)에 중복되어 있다. 두 정의를 비교해 정본 1개만 남겨라.

절차:
1. grep -n "CREATE TABLE" ondam_schema.sql 로 중복 위치 확인
2. 두 정의의 컬럼·인덱스 차이를 diff로 비교
3. 차이가 있으면: backend/src/domains/subscription/ 하위 Repository 코드가 실제로
   사용하는 컬럼명을 기준으로 정본 선택 (코드가 진실)
4. 중복 제거 후 스키마 파일 전체를 새 임시 DB에 적용해 에러 없는지 검증
   (mysql로 새 스키마 적용 테스트만. 기존 운영/개발 DB에 ALTER·DROP 절대 금지)

수용 기준:
- grep -c "CREATE TABLE.*subscription_payment_logs" ondam_schema.sql == 1
- 스키마 전체 신규 적용 시 에러 0
- 제거한 쪽과 남긴 쪽의 차이를 커밋 메시지 본문에 기록

금지: 다른 테이블 정의 수정, 스키마 파일 재정렬·재포맷, 운영 DB 접속
```

---

## DEV-05: "유언장" → "마지막 영상 편지" 명칭 전환 (2026-08-21 확정된 결정)

```
작업 디렉토리: /home/lee/project/ondam
사전 필독: .claude/CLAUDE.md (프로젝트 컨벤션)

[배경] "AI 디지털 유언장"은 민법상 유언 효력이 없어 명칭 오인 리스크가 있다.
서비스명을 "마지막 영상 편지"로 변경하기로 확정됐다.

[작업] 사용자에게 노출되는 문자열만 전면 교체한다.
1. frontend/src 전체에서 "유언장"·"디지털 유언장" 노출 문구를 "마지막 영상 편지"
   (문맥상 짧게는 "영상 편지")로 교체: 페이지 타이틀, 버튼, 안내문, 폼 라벨,
   메타 태그, 알림 메시지 문자열
2. backend에서 사용자에게 전달되는 message 문자열(응답 message, 알림 본문)도 교체
3. 구매 플로우 첫 화면과 랜딩 소개 영역에 고지 1줄 추가:
   "이 영상은 마음을 전하는 기록으로, 민법상 유언의 법적 효력은 없습니다."

[절대 금지 - 표시 문자열 외 변경 금지]
- DB 테이블명(wills, will_beneficiaries 등), 컬럼명 변경 금지
- API 경로(/api/will 등), 라우트 경로(/will 등) 변경 금지
- 코드 심볼(변수·함수·파일명 willService 등) 변경 금지
- CSS 클래스명 변경 금지

수용 기준:
- 프론트 렌더링 문자열 grep에서 "유언장" 0건 (위 고지문 내 "유언의" 제외)
- 빌드 성공 + 주요 화면(랜딩, /will 진입, 구매 플로우) 렌더 확인
```

---

## DEV-01: 립싱크 벤더 실검증 (D-ID 우선, 사전 조사 완료됨)

```
작업 디렉토리: /home/lee/project/ondam
사전 필독: docs/strategy/08-lipsync-vendor-comparison.md (공식 스펙 실사 결과),
          .claude/CLAUDE.md, backend/src/services/lipsync/ 현재 코드

[배경] lipsync 어댑터 3종(syncSo.js, museTalk.js, did.js)이 추정 스펙으로 구현돼
있다. 공식 문서 실사 결과 1차 검증 벤더는 D-ID로 정해졌다. 실사에서 확인된
실스펙은 08 문서에 있다 - 그 문서가 정본이며 추측으로 구현하지 않는다.

[작업 1] did.js 어댑터를 실스펙으로 교정:
- 인증: Basic 인증 (Authorization: Basic base64(username:password)). Bearer로
  구현돼 있으면 반드시 교체. 자격증명은 .env (D_ID_API_KEY 형태, 커밋 금지)
- POST /talks: source_url(이미지 presigned URL) + script {type:"audio", audio_url}
- GET /talks/{id} 폴링: 상태값 created/started/done/error/rejected, 결과 result_url
- result_url은 만료되는 외부 S3 URI이므로 즉시 온담 S3로 복사 저장
- 어댑터 공통 인터페이스(다른 어댑터와의 시그니처)는 유지

[작업 2] syncSo.js도 08 문서에 확인된 범위(base URL v2, x-api-key, POST /generate,
model sync-3, 상태값 대문자 5종, outputUrl)로 교정. 미확인 부분(폴링 GET 경로)은
TODO 주석으로 명시 유지 - 추측 구현 금지.

[작업 3] E2E 스모크 테스트 (D-ID Trial 14일 무료로 가능):
- 테스트 이미지 1장 + 한국어 음성 샘플(wav)로 D-ID 직접 호출 → 영상 수신 확인
- videoWorker(BullMQ) 경유 전체 파이프라인으로도 1건: TTS/음성 → 립싱크 → S3 저장
  → ai_jobs 상태 completed 기록
- 한국어 오디오 립싱크 품질을 결과 영상으로 확인 (입모양 동기화 여부 주관 평가 기록)

수용 기준:
- 실제 D-ID API로 생성된 영상이 온담 S3에 저장되고 ai_jobs가 정상 완료 기록
- 한국어 스모크 테스트 결과(품질 평가·처리 시간·과금 크레딧)를
  docs/strategy/08-lipsync-vendor-comparison.md 하단에 "실측 결과" 절로 추기
- .env.example에 필요한 키 항목 추가 (실제 키 커밋 금지)

주의: D-ID 계정·API 키 발급은 사람이 해야 할 수 있다 - 키가 없으면 키 발급이
필요하다고 보고하고 멈출 것 (임의로 다른 벤더 무료 티어로 대체하지 말 것)
```

---

## 인계 시 공통 지침

- 태스크당 커밋 분리. 커밋 메시지는 `<type>: <설명>` 형식, attribution 라인 없음
- 완료 후 `docs/strategy/06-dev-backlog.md`의 해당 태스크 상태를 `DONE(해시)`로 갱신
- 작업 중 기존 기획(PRD·strategy·specs)과 다른 판단에 도달하면 임의 변경하지 말고 충돌 지점을 보고 (SPEC-00 통제 원칙)
