# ondam 프로젝트 코드맵

마지막 업데이트: 2026-04-20

---

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (React + Vite)                                          │
│ ├─ pages/auth         (로그인/회원가입)                          │
│ ├─ pages/home         (홈페이지)                                 │
│ ├─ pages/photo        (AI 사진 처리)                            │
│ ├─ pages/will         (AI 유언장)                               │
│ ├─ pages/pet          (반려동물 아카이브, 구독)                 │
│ ├─ pages/memorial     (추모관)                                  │
│ └─ pages/admin        (관리자)                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                   axios + apiClient
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ Backend (Node.js + Express)                                      │
│ ├─ routes/:domain                                                │
│ ├─ controllers/:domain                                           │
│ ├─ services/:domain                                              │
│ └─ repositories/:domain                                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌───────────────┼───────────────┐
        │               │               │
   ┌────▼────┐   ┌────▼────┐   ┌────▼─────────┐
   │ MySQL   │   │ Redis   │   │ AWS S3/KMS   │
   │ DB      │   │ (Cache) │   │ (암호화)     │
   └─────────┘   └────┬────┘   └──────────────┘
                      │
              ┌───────▼────────┐
              │ BullMQ Queue   │
              ├─ billingQueue  │
              ├─ photoQueue    │
              └─ willQueue     │
```

---

## 주요 도메인

### 1. Authentication (auth)
**경로**: `/backend/src/domains/auth/`
**진입점**: `authRoutes.js`

| 모듈 | 설명 |
|------|------|
| `authRoutes.js` | JWT 기반 로그인, 회원가입, 토큰 갱신 |
| `authController.js` | 요청 검증 후 서비스 호출 |
| `authService.js` | 비밀번호 해싱, JWT 토큰 생성/검증 |
| `authRepository.js` | users 테이블 CRUD |

**외부 의존성**: JWT (`jsonwebtoken`), bcrypt

---

### 2. Subscription (구독 + 정기결제)
**경로**: `/backend/src/domains/subscription/`
**진입점**: `subscriptionRoutes.js`

#### 엔드포인트
```
GET    /api/subscriptions/plans
POST   /api/subscriptions/billing-auth      (권장)
GET    /api/subscriptions
POST   /api/subscriptions                   (deprecated)
DELETE /api/subscriptions/:id
POST   /api/subscriptions/:id/retry-payment
GET    /api/subscriptions/:id/payment-logs
```

#### 모듈 구성

| 모듈 | 책임 |
|------|------|
| `subscriptionRoutes.js` | 라우트 정의, Zod 검증 스키마 |
| `subscriptionController.js` | HTTP 요청/응답 처리 |
| `subscriptionService.js` | 구독 생성, 취소, 상태 관리 핵심 로직 |
| `subscriptionRepository.js` | subscriptions 테이블 CRUD |
| `subscriptionPaymentLogRepository.js` | subscription_payment_logs 테이블 CRUD |
| `subscriptionBillingService.js` | 결제 실행 로직 (KMS 복호화, 토스 호출) |
| `subscriptionTossClient.js` | 토스페이먼츠 API 클라이언트 |

#### 데이터 흐름

**구독 시작 (POST /api/subscriptions/billing-auth)**
```
1. authKey + customerKey 검증
2. 토스 API: authKey → billingKey 교환
3. billingKey → KMS 암호화
4. 즉시 첫 결제 실행 (토스 API)
5. 결제 성공 → subscriptions INSERT
6. 결제 로그 기록 → subscription_payment_logs INSERT
7. 응답: { subscriptionId, status, nextBillingAt }
```

**자동 정기결제 (BullMQ)**
```
1. 매일 03:00 KST — billingWorker scan-due 작업 실행
2. 결제 대상 조회: sub_status='active' AND next_billing_at ≤ 오늘
3. 각 구독별 execute-billing job 큐 등록
4. 워커: billingKey KMS 복호화 → 토스 결제 실행
5. 결과 → subscription_payment_logs 기록
6. 성공: status='completed', next_billing_at 갱신
7. 실패: status='pending', fail_count ++, past_due/suspended 전환
```

**결제 재시도 (POST /api/subscriptions/:id/retry-payment)**
```
1. 현재 상태 확인: past_due or suspended
2. billingKey 복호화
3. 토스 결제 실행
4. 결과 → logs 기록
5. 성공 → sub_status='active', fail_count=0
```

#### 상태 머신
```
active
  ├─ (매일 결제 성공) → active
  ├─ (결제 1회 실패) → past_due (3일 유예)
  │  └─ (3일 내 성공) → active
  │  └─ (3일 내 2번 더 실패) → suspended
  └─ (사용자 취소) → canceled

past_due
  ├─ (수동 retry-payment 성공) → active
  └─ (자동 재시도 실패) → suspended

suspended
  ├─ (수동 retry-payment 성공) → active
  └─ (취소) → canceled

canceled (소프트 삭제 적용)
```

#### 중요 알고리즘
- **멱등성**: 같은 날 같은 구독에 대해 결제 1회만 실행 (jobId = `billing_{subscriptionId}_{YYYYMMDD}`)
- **KMS 암호화**: billingKey는 절대 평문 저장/로깅 금지
- **시간대**: 모든 날짜 연산은 KST (Asia/Seoul)

#### 외부 의존성
- 토스페이먼츠 빌링 API (`axios`)
- AWS KMS (`aws-sdk`)
- BullMQ (`bullmq`)

---

### 3. Photo (AI 사진 처리)
**경로**: `/backend/src/domains/photo/`

| 모듈 | 설명 |
|------|------|
| `photoRoutes.js` | 파일 업로드, 작업 조회 |
| `photoController.js` | HTTP 핸들러 |
| `photoService.js` | 작업 생성, 상태 추적 |
| `photoRepository.js` | photos, jobs 테이블 CRUD |

**BullMQ 큐**: photoQueue
- `enhance` (화질 개선)
- `restore` (오래된 사진 복원)
- `colorize` (컬러라이징)
- `remove-background` (배경 제거)

**워커**: `/queues/photoWorker.js`

---

### 4. Will (AI 유언장)
**경로**: `/backend/src/domains/will/`

| 모듈 | 설명 |
|------|------|
| `willRoutes.js` | 유언장 생성, 조회 |
| `willController.js` | HTTP 핸들러 |
| `willService.js` | AI 유언 영상 생성 로직 |
| `willRepository.js` | wills 테이블 CRUD |

**AI 통합**: OpenAI (텍스트), ElevenLabs (음성), D-ID (영상)

**BullMQ 큐**: willQueue
- `voiceClone` (음성 생성)
- `videoGenerate` (영상 생성)

**워커**: `/queues/willWorker.js`

---

### 5. Pet (반려동물 아카이브)
**경로**: `/backend/src/domains/pet/`

| 모듈 | 설명 |
|------|------|
| `petRoutes.js` | 반려동물 CRUD |
| `petController.js` | HTTP 핸들러 |
| `petService.js` | 비즈니스 로직 |
| `petRepository.js` | pets 테이블 CRUD |

**프론트엔드**: `/frontend/src/pages/pet/`
- `PetPage.jsx` — 반려동물 목록
- `PetDetailPage.jsx` — 상세 페이지
- `PetNewPage.jsx` — 신규 등록
- `PetPortraitPage.jsx` — AI 초상화
- `PetSubscriptionPage.jsx` — 구독 관리
- `usePet.js`, `usePetDetail.js` — 상태 관리 훅

---

### 6. Memorial (추모관)
**경로**: `/backend/src/domains/memorial/`

**접근 제어**: 접근 코드(memorial_access_code) 검증 필수

| 모듈 | 설명 |
|------|------|
| `memorialRoutes.js` | 접근 코드 인증, 추모관 데이터 |
| `memorialService.js` | 비즈니스 로직 |
| `memorialRepository.js` | memorials 테이블 CRUD |

---

### 7. Payment (결제)
**경로**: `/backend/src/domains/payment/`

| 모듈 | 설명 |
|------|------|
| `paymentRoutes.js` | 결제 검증, 웹훅 |
| `paymentService.js` | 토스 결제 검증 |
| `paymentRepository.js` | payments 테이블 CRUD |

**웹훅 경로**: `POST /api/payments/webhook`
- 서명 검증: `TOSS_WEBHOOK_SECRET`
- 멱등성: `payments.payment_key` UNIQUE

---

## 프론트엔드 구조

**경로**: `/frontend/src/`

```
pages/
├─ auth/
│  ├─ LoginPage.jsx
│  ├─ SignupPage.jsx
│  └─ LoginPage.css
├─ photo/
│  ├─ PhotoPage.jsx
│  ├─ photoApi.js
│  └─ PhotoPage.css
├─ will/
│  └─ WillPage.jsx
├─ pet/
│  ├─ PetPage.jsx
│  ├─ PetDetailPage.jsx
│  ├─ PetNewPage.jsx
│  ├─ PetPortraitPage.jsx
│  ├─ PetSubscriptionPage.jsx
│  ├─ BillingAuthSuccessPage.jsx
│  ├─ BillingAuthFailPage.jsx
│  ├─ CancelSubscriptionModal.jsx
│  ├─ SubscriptionStatusCard.jsx
│  ├─ usePet.js
│  ├─ usePetDetail.js
│  ├─ usePetNew.js
│  ├─ usePetPortrait.js
│  ├─ usePetSubscription.js
│  ├─ petApi.js
│  └─ PetPage.css
├─ memorial/
│  └─ MemorialPage.jsx
├─ admin/
│  └─ AdminPage.jsx
└─ home/
   └─ HomePage.jsx

components/common/
├─ Header.jsx
├─ Footer.jsx
├─ Button.jsx
├─ Modal.jsx
└─ (기타)

config/
├─ apiClient.js — axios 인스턴스 (권장 사용)

hooks/
├─ useAuth.js
├─ useUser.js
└─ (기타)

lib/
└─ tossPayments.js — 토스페이먼츠 SDK 래퍼

utils/
├─ dateKst.js — KST 날짜 유틸
└─ (기타)

store/
└─ (Zustand, Recoil 등 상태 관리)

styles/
└─ (전역 스타일, CSS 변수)
```

### 프론트엔드 3레이어 패턴

**예: Pet 페이지**
```
1. PetPage.jsx       — UI 렌더링만
2. usePet.js         — 상태 관리, 데이터 페칭 로직
3. petApi.js         — 백엔드 API axios 호출
```

### 구독 UI 컴포넌트

- `PetSubscriptionPage.jsx` — 구독 페이지 (플랜 선택, 빌링 인증)
- `SubscriptionStatusCard.jsx` — 현재 구독 상태 표시
- `CancelSubscriptionModal.jsx` — 구독 취소 모달
- `BillingAuthSuccessPage.jsx` — 빌링 성공 페이지
- `BillingAuthFailPage.jsx` — 빌링 실패 페이지

---

## 데이터베이스 스키마 (주요 테이블)

### subscriptions
```sql
subscription_id (UUID)
user_id (UUID, FK)
plan (enum: pet_archive, will_premium, all)
sub_status (enum: active, past_due, suspended, canceled)
toss_billing_key_encrypted (VARCHAR, KMS 암호화)
billing_kms_key_id (VARCHAR, KMS Key ID)
price_krw (INT)
next_billing_at (DATE, KST)
last_billed_at (DATETIME, KST)
fail_count (INT, 0~3)
grace_period_until (DATE, past_due 유예 종료일)
suspended_at (DATETIME)
canceled_at (DATETIME)
cancel_reason (VARCHAR)
deleted_at (DATETIME, 소프트 삭제)
created_at, updated_at
```

### subscription_payment_logs
```sql
log_id (UUID)
subscription_id (FK)
payment_key (VARCHAR, 토스 결제 ID, UNIQUE)
billing_cycle_date (DATE, 결제 기준일)
attempt_no (INT, 해당 날짜 시도 번호)
attempt_type (enum: initial, retry)
log_status (enum: pending, completed, failed)
amount_krw (INT)
failure_reason (VARCHAR)
created_at
```

---

## 환경 변수 (필수)

```bash
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=ondam

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# AWS KMS (빌링키 암호화)
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=***
AWS_SECRET_ACCESS_KEY=***
KMS_KEY_ID=arn:aws:kms:ap-northeast-2:xxx:key/xxx

# 토스페이먼츠
TOSS_SECRET_KEY=sk_test_***
TOSS_WEBHOOK_SECRET=***
TOSS_CLIENT_KEY=pk_test_***

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# S3
S3_BUCKET=ondam-prod
S3_REGION=ap-northeast-2

# OpenAI, ElevenLabs, D-ID 등
OPENAI_API_KEY=***
ELEVENLABS_API_KEY=***
DID_API_KEY=***
```

---

## BullMQ 작업 큐 구성

### subscription-billing 큐
**경로**: `/backend/src/queues/billingQueue.js` + `billingWorker.js`

| 작업명 | 트리거 | 주기 | 책임 |
|--------|--------|------|------|
| `scan-due` | 크론 | 매일 03:00 KST | 결제 대상 조회 → execute-billing job 등록 |
| `execute-billing` | scan-due 완료 | - | 개별 구독 자동결제 실행 |

---

## 시간대 설정

**Node.js**:
```javascript
// server.js 또는 index.js 최상단
process.env.TZ = 'Asia/Seoul'
```

**MySQL**:
```sql
SET time_zone = '+09:00';
```

모든 날짜 연산은 `subscriptionBillingService.todayKST()` 함수 사용.

---

## 보안 체크리스트

- [x] 빌링키는 KMS 암호화 후 DB 저장
- [x] authKey는 1회용 (빌링키 교환 후 폐기)
- [x] 결제 웹훅 서명 검증
- [x] 멱등성 보장 (jobId = 날짜 + subscriptionId)
- [x] 접근 코드 검증 (추모관)
- [x] 음성권 동의 확인 (will)
- [x] 소프트 삭제 적용

---

## 관련 문서

- `CLAUDE.md` — 프로젝트 가이드, 에러 처리, API 응답 포맷
- `dev-style.md` — 코딩 스타일, 네이밍 컨벤션
- `/ondam_schema.sql` — 전체 DB 스키마
