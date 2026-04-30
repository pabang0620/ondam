# 온담 개발 스타일 가이드

## 작업 방식

- 구현 전 항상 방향 확인 먼저 - 추측 금지
- 기획/설계 포함 작업은 반드시 물어보고 진행
- AI 기능(음성 클론, 영상 생성)은 Phase 2 - Phase 1에서는 큐 구조만 구축
- 결제/구독은 Phase 3

---

## 기술 스택 (확정)

### 백엔드
| 라이브러리 | 용도 |
|-----------|------|
| express | 웹 프레임워크 |
| mysql2 | MySQL 커넥션 풀 (promise API) |
| bcrypt | 비밀번호 해싱 (SALT_ROUNDS=12) |
| jsonwebtoken | JWT 액세스·리프레시 토큰 |
| uuid | UUID 생성 |
| zod | 입력 유효성 검사 |
| multer + multer-s3 + @aws-sdk/client-s3 | 파일 업로드 (S3) |
| @aws-sdk/client-kms | 민감 데이터 암호화 |
| bullmq | AI 작업 큐 |
| ioredis | Redis 연결 (BullMQ) |
| express-rate-limit | Rate limiting |
| express-slow-down | Slow-down 미들웨어 |
| helmet | 보안 헤더 |
| morgan | HTTP 로깅 |
| cookie-parser | 쿠키 파싱 |
| nodemailer | 이메일 발송 |
| node-cron | 스케줄러 |
| nodemon | 개발 서버 자동 재시작 |

### 프론트엔드
| 라이브러리 | 용도 |
|-----------|------|
| react 19 + vite 7 | UI 프레임워크 + 빌드 |
| react-router-dom v7 | 라우팅 |
| axios | HTTP 클라이언트 |
| zustand v5 | 전역 상태 |
| tailwindcss v4 + @tailwindcss/vite | devDependencies - global.css import 유지 |
| 파일별 CSS | 스타일링 (BEM 컨벤션) - 신규 컴포넌트는 전부 이 방식 |
| dayjs | 날짜 포맷 |
| lucide-react | 아이콘 |
| swiper | 슬라이더 |
| pretendard | 폰트 |
| socket.io-client | WebSocket (AI 처리 상태 알림) |

---

## 백엔드 아키텍처

### 레이어 구조
```
routes → controller → service → repository → DB
```

### 도메인 구조
```
src/domains/
├── auth/           # 회원가입, 로그인, refresh, 비밀번호 재설정
├── user/           # 내 프로필, 공개 프로필, 회원 탈퇴
├── photo/          # AI 사진 처리 요청·결과 조회
├── will/           # AI 유언장 생성·관리
├── pet/            # 반려동물 아카이브
├── memorial/       # 추모관 (접근 코드 기반)
├── payment/        # 토스페이먼츠 결제·환불
├── subscription/   # 구독 플랜 관리
├── notification/   # 알림 (읽음 처리·설정)
├── admin/          # 관리자 API
└── common/         # upload(S3), 공통 유틸
```

### BullMQ 작업 큐
```
src/jobs/
├── queue.js        # 큐 정의 (photo, voiceClone, videoGenerate, notification)
├── index.js        # 워커 엔트리포인트 (별도 프로세스)
└── workers/        # 도메인별 워커 (구현 시 생성)
    ├── photoWorker.js
    ├── voiceCloneWorker.js
    ├── videoGenerateWorker.js
    └── notificationWorker.js
```

### 파일 네이밍 - 점(.) 절대 금지
```
{Domain}{Layer}.js  ← camelCase
예: authRoutes.js / authController.js / authService.js / authRepository.js
❌ auth.routes.js / auth.service.js
```

---

## 프론트엔드 아키텍처

### 3레이어 분리
```
pages/photo/
├── PhotoPage.jsx    # View (렌더링만 - fetch/상태 직접 작성 금지)
├── usePhoto.js      # Hook (상태·로직·API 조합)
└── photoApi.js      # API (axios 호출만)
```

### 페이지 구조
```
pages/
├── home/           # 홈 (서비스 소개, CTA)
├── auth/           # 로그인, 회원가입
├── photo/          # AI 사진관
├── will/           # AI 유언장
├── pet/            # 반려동물 아카이브
├── memorial/       # 추모관 (유가족 전용)
├── mypage/         # 마이페이지 (주문, 구독, 알림)
└── admin/          # 관리자 패널
```

### 레이아웃
- `MainLayout` - 일반 페이지 (Header + Footer)
- `AuthLayout` - 로그인/회원가입 (Header 없음)
- `AdminLayout` - `/admin/*` (사이드바)

---

## CSS 스타일링

### 작성 규칙 (WeCom 동일)

**BEM 컨벤션**
```css
/* 최상단 컨테이너 */
.componentName-container { }
.pageName-page { }

/* 하위 요소 */
.photoCard__image { }
.photoCard__title { }

/* 상태 */
.photoCard--active { }
.button--primary { }
.button--secondary { }
```

**어르신 UX 필수 적용**
```css
/* 모든 버튼 컴포넌트에 적용 */
.button-container {
  min-height: var(--min-touch-target);  /* 48px */
  font-size: var(--font-size-base);     /* 16px */
  padding: 12px 24px;
}
```

**선택자 규칙**
- 클래스명만 사용 (태그 선택자 금지)
- `global.css`에 `@import "tailwindcss"` 유지

---

## DB 설계 컨벤션

### 이중 ID
```sql
id     INT AUTO_INCREMENT PRIMARY KEY,
uuid   CHAR(36) NOT NULL UNIQUE,
```

### 소프트 삭제
```sql
deleted_at DATETIME NULL DEFAULT NULL
```

### 로그 테이블
- `created_at` 만 - `updated_at` 없음 (append-only)

### 동의 추적
- 음성/영상 처리 동의: `voice_consent_at DATETIME NULL`
- 추모관 공개 동의: `memorial_consent_at DATETIME NULL`
- 서비스 이용 동의: `terms_agreed_at DATETIME NOT NULL`

### 테이블 네이밍
- 관리자 설정: `admin_` 접두사 (`admin_notices`, `admin_banners`)
- 일반 테이블: 도메인명 복수형 (`users`, `photos`, `wills`, `pets`)
- AI 처리 작업: `ai_jobs`

---

## 보안 원칙

- JWT accessToken → Zustand store 메모리 (localStorage 금지)
- refreshToken → HttpOnly 쿠키 (`withCredentials: true`)
- 민감 파일(음성, 유언 영상) S3 → SSE-KMS 암호화
- AI API 호출 → 반드시 BullMQ 큐 경유 (직접 호출 금지)
- 추모관 → 접근 코드 검증 필수

---

## 코딩 스타일

- 들여쓰기: **2 spaces**
- 불변성: 객체 직접 수정 금지 → spread/새 객체 반환
- 함수 크기: **50줄 이하** 권장
- 파일 크기: **400줄 이하** (초과 시 분리)
- 에러 처리: try/catch 필수
- 입력 검증: 경계(user input, external API)에서 반드시 zod 검증
- 환경변수: `.env` 사용, 절대 커밋 금지

---

## 배포

- **서버**: AWS EC2
- **프로세스 매니저**: PM2
- **워커 별도 실행**: `pm2 start src/jobs/index.js --name ondam-workers`
- **Docker 미사용**

---

## 개발 환경

```bash
# 백엔드 서버
cd backend && npm run dev   # 포트 4000

# 프론트엔드
cd frontend && npm run dev  # 포트 5173

# BullMQ 워커 (AI 처리 테스트 시)
cd backend && npm run workers
```

---

## Git

- 작업 완료 후 커밋 & 푸시
- 커밋 메시지: `feat:` / `fix:` / `refactor:` / `docs:` / `chore:`
- `.env` 파일 커밋 절대 금지
