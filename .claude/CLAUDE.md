# 온담(ondam) 프로젝트 가이드

## 서비스 개요
온담 - AI 기억사진관. 고인과의 기억을 AI로 간직하는 통합 플랫폼.
- **AI 사진관**: 오래된 사진 복원, 화질 개선, 컬러라이징, 배경 제거
- **AI 디지털 유언장**: 고인의 사진 + 음성 → AI 영상 메시지 생성 (유가족 전달)
- **반려동물 아카이브**: 반려동물 기억 사진 보관 + AI 초상화
- **추모관**: 유가족 전용 - 고인 기억 모아보기 (접근 코드 필요)

---

## 기술 스택
- **DB**: MySQL 8.4, InnoDB, utf8mb4
- **스키마 파일**: `ondam_schema.sql` (프로젝트 루트)
- **작업 큐**: BullMQ + Redis (AI 처리 비동기)
- **AI API**: OpenAI, ElevenLabs, Sync.so/MuseTalk/D-ID(립싱크, LIPSYNC_PROVIDER로 교체), remove.bg
- **결제**: 토스페이먼츠 빌링 API (정기결제)
- **암호화**: AWS KMS (민감 데이터)
- **시간대**: `process.env.TZ = 'Asia/Seoul'` (Node.js) + MySQL `SET time_zone = '+09:00'` (DB)

---

## 온담 전용 에이전트 (`.claude/agents/` 예정)

| 에이전트 | 언제 사용 |
|---------|---------|
| `ondam-backend-coder` | 백엔드 API 신규 작성·수정 시 |
| `ondam-api-linker` | 데이터 안 나올 때 / API 연결 검증 |
| `ondam-reviewer` | 전체 코드 종합 진단 |
| `ondam-bug-hunter` | 배포 전 버그 점검 |

---

## 공통 에이전트 (프로젝트 전역)

| 에이전트 | 언제 사용 |
|---------|---------|
| `database-reviewer` | DB 스키마 설계·리뷰 |
| `architect` | 아키텍처 결정·기술 선택 |
| `planner` | 복잡한 기능 구현 계획 |
| `code-reviewer` | 코드 작성 직후 |
| `security-reviewer` | 보안 민감 코드 작성 후 |

---

## 오케스트레이터 원칙 (CRITICAL)

> **오케스트레이터(메인 Claude)는 절대 코드를 직접 작성하거나 수정하지 않는다.**
> 모든 코드 변경은 반드시 에이전트에 위임한다.

---

## 에이전트 실행 순서

### 신규 기능 개발
```
architect / planner          → 설계
        ↓
database-reviewer            → DB 스키마 변경 시
        ↓
ondam-backend-coder          → 백엔드 코드 작성
        ↓
code-reviewer                → 작성 직후 무조건
        ↓
ondam-api-linker             → API-프론트 연결 검증
```

---

## 온담 전용 보안 규칙 (CRITICAL)

### 1. 민감 데이터 KMS 암호화 필수
다음 데이터는 S3 저장 시 반드시 `SSE-KMS` (`KMS_KEY_ID` 환경변수) 적용:
- **음성 파일** (voiceClone 큐 처리 결과)
- **유언 영상** (videoGenerate 큐 처리 결과)
- **유언장 텍스트 내용**

```js
// S3 업로드 시 필수
{
  ServerSideEncryption: 'aws:kms',
  SSEKMSKeyId: process.env.KMS_KEY_ID,
}
```

### 2. AI 처리 - BullMQ 큐 경유 필수
AI API 호출(OpenAI, ElevenLabs, Sync.so/MuseTalk/D-ID)은 **절대 HTTP 요청 핸들러 안에서 직접 호출 금지**.
반드시 BullMQ 큐에 작업 추가 → 워커에서 처리 → 결과 DB 업데이트 → 프론트 폴링/웹소켓 알림.

```js
// 금지
app.post('/api/photo/enhance', async (req, res) => {
  const result = await openai.images.edit(...) // 직접 호출 금지
})

// 필수
app.post('/api/photo/enhance', async (req, res) => {
  const job = await photoQueue.add('enhance', { ... })
  res.json({ success: true, data: { jobId: job.id } })
})
```

### 3. 초상권·음성권 동의 없이 처리 금지
`users.voice_consent_at` 컬럼은 실제 스키마에 존재하지 않는다 (2026-08-23 정정). 동의는
`user_consents` 테이블(append-only, `consent_type` ENUM: privacy/portrait/voice/
ai_generation/posthumous_release/terms/marketing)에 사용자·유형별 이력으로 저장된다.
최신 동의 상태는 `WHERE user_id=? AND consent_type=? ORDER BY agreed_at DESC, id DESC
LIMIT 1`로 조회한다(예: `willRepository.findVoiceConsent`/`findPortraitConsent`/
`findAiGenerationConsent`/`findPosthumousReleaseConsent`, `photoRepository.findPortraitConsent`).
음성 샘플 등록·유언 영상 활성화(`voice`+`portrait`+`ai_generation`), 사진 주문·AI 처리 시작
(`portrait`), 유언 영상 공개 승인(`posthumous_release`) 전 반드시 해당 동의의
`is_agreed=1` 최신 행을 확인하고, 없으면 400으로 거부한다. 서비스 계층에서 검증하고
BullMQ 워커에서도 실제 벤더 호출 직전 재검증한다(큐 대기 중 동의 철회 대응).

### 4. 추모관 접근 제한
`/api/memorial/:code` - 접근 코드(`memorial_access_code`) 검증 필수.
유가족 인증 없이 고인 데이터 노출 절대 금지.

### 5. 빌링키 보안
- 빌링키는 KMS 암호화 후 DB 저장. 로그·API 응답에 절대 노출 금지.
- 해지 시 즉시 `toss_billing_key_encrypted = NULL` 처리.
- authKey는 1회용 - 백엔드에서 billingKey 교환 후 즉시 폐기.
- 빌링키로 결제 후 토스 응답값은 즉시 `subscription_payment_logs`에 기록, authKey는 메모리에서 제거.

---

## 어르신 UX 강제 규칙

모든 프론트엔드 컴포넌트 작성 시:
- 버튼 최소 높이: `48px` (CSS 변수: `var(--min-touch-target)`)
- 폰트 최소 크기: `16px` (CSS 변수: `var(--font-size-base)`)
- 핵심 CTA 버튼 최소 너비: `120px`
- 텍스트 대비: WCAG AA 기준 이상 (일반 텍스트 4.5:1)

---

## 도메인 목록

| 도메인 | 경로 | 설명 |
|--------|------|------|
| `auth` | `/api/auth` | 회원가입, 로그인, 토큰 갱신 |
| `user` | `/api/users` | 프로필, 회원 탈퇴 |
| `photo` | `/api/photo` | AI 사진 처리 |
| `will` | `/api/will` | AI 유언장 |
| `pet` | `/api/pet` | 반려동물 아카이브 |
| `memorial` | `/api/memorial` | 추모관 (접근 코드 필요) |
| `payment` | `/api/payments` | 토스페이먼츠 결제 |
| `subscription` | `/api/subscriptions` | 구독 관리, 정기결제 |
| `notification` | `/api/notifications` | 알림 |
| `admin` | `/api/admin` | 관리자 |
| `common` | `/api/uploads` | S3 업로드, 공통 |

### Subscription (구독) 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/subscriptions/plans` | 구독 플랜 목록 (비인증) |
| `POST` | `/api/subscriptions/billing-auth` | 빌링키 발급 + 즉시 첫 결제 + 구독 생성 |
| `GET` | `/api/subscriptions` | 내 구독 목록 |
| `POST` | `/api/subscriptions` | 구독 시작 (deprecated, 하위호환) |
| `DELETE` | `/api/subscriptions/:id` | 구독 취소 |
| `POST` | `/api/subscriptions/:id/retry-payment` | 결제 재시도 (past_due/suspended 복원) |
| `GET` | `/api/subscriptions/:id/payment-logs` | 결제 이력 조회 |

---

## API 응답 포맷 (고정)

```json
{
  "success": true,
  "message": "성공",
  "data": { ... },
  "meta": { "total": 100, "page": 1, "limit": 20 }
}
```

오류:
```json
{
  "success": false,
  "message": "오류 메시지"
}
```

---

## 백엔드 레이어 구조

```
routes → controller → service → repository → DB
```

파일 네이밍: `{Domain}{Layer}.js` (점 금지)
- authRoutes.js / authController.js / authService.js / authRepository.js

---

## 프론트엔드 3레이어 구조

```
pages/photo/
├── PhotoPage.jsx      # View (렌더링만)
├── usePhoto.js        # Hook (상태·로직·API 조합)
└── photoApi.js        # API (axios 호출만)
```

---

## S3 업로드 폴더 컨벤션

```
profiles/{userUuid}/                           # 프로필 이미지
photos/{userUuid}/{jobUuid}/                   # AI 처리 사진 (원본/결과)
wills/{userUuid}/{willUuid}/                   # 유언 영상·음성 (KMS 암호화 필수)
pets/{userUuid}/{petUuid}/                     # 반려동물 사진
admin/                                         # 관리자 업로드
```

---

## 백엔드 개발 컨벤션

### 에러 처리 컨벤션
Service에서 에러 발생 시 HTTP 상태 코드를 함께 전달:

```js
// Service
throw Object.assign(new Error('메시지'), { status: 404 })

// Controller - 모든 catch는 next(err)로만 위임
} catch (err) {
  next(err)
}
// 글로벌 에러 핸들러(server.js)가 err.status 읽어서 응답 처리
```

### validate 미들웨어 사용법
Zod 스키마는 반드시 `{ body, params, query }` 구조로 감싸기:

```js
import { z } from 'zod'
import { validate } from '../middleware/validate.js'

const schema = z.object({
  body: z.object({
    email: z.string().email('유효한 이메일'),
  }),
  params: z.object({
    id: z.string().uuid('유효한 UUID'),
  }).optional(),
  query: z.object({
    page: z.coerce.number().default(1),
  }).optional(),
})

router.post('/path/:id', validate(schema), controller)
```

### JWT 페이로드 필드명 (온담 고정)
- accessToken payload: `{ userId: string, role: string }`
- 컨트롤러에서 `req.user.userId` 로 접근
- **주의**: WeCom은 `req.user.uuid` 사용 - 온담은 `userId` 사용

---

## 프론트엔드 개발 컨벤션

### API 클라이언트 사용
신규 코드에서는 반드시 `apiClient.js` 사용:

```js
// 신규 코드 (필수)
import apiClient from '../config/apiClient.js'
const response = await apiClient.get('/api/users/me')

// 레거시 (사용 금지)
import api from '../api.js'  // 절대 금지
```

---

## 개발 주의사항

### BullMQ 작업 상태 관리
AI 처리 작업에는 반드시 DB에 `jobs` 테이블 레코드를 생성하고 상태를 추적:
- `pending` → `processing` → `completed` | `failed`
- 프론트엔드는 폴링(`GET /api/photo/job/:jobId`) 또는 WebSocket으로 상태 구독

### 결제 웹훅 보안
토스페이먼츠 웹훅(`/api/payments/webhook`) 수신 시:
1. `TOSS_WEBHOOK_SECRET` 서명 검증 필수
2. 멱등성 보장 - 같은 결제 ID 중복 처리 방지 (`payments.payment_key` UNIQUE)

### 구독 결제 상태 머신
```
active → past_due (1~2회 실패, 3일 유예) → suspended (3회 실패)
suspended → active (수동 retryPayment 성공 시)
모든 상태 → canceled (사용자/관리자 취소)
```
결제 시도는 반드시 `subscription_payment_logs`에 기록 (pending 선기록 → 결과 업데이트).

### BullMQ 크론 작업
`subscription-billing` 큐에서 크론 작업:
- **scan-due 작업**: 매일 03:00 KST에 실행
- 구독 상태 `active`인 항목만 대상
- 결제 예정일(next_billing_date ≤ 현재) 구독 찾기
- 각각 자동 결제 시도 → `subscription_payment_logs` 기록

### 소프트 삭제
모든 도메인 테이블에 `deleted_at DATETIME NULL` 필수.
SELECT 쿼리에 항상 `AND deleted_at IS NULL` 포함.

---

## Git 브랜치 전략
- `main`: 배포 기준
- `claude`: 현재 작업 브랜치
- feature 브랜치: `feat/도메인명-기능명`
