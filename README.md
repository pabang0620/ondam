# 온담 (ondam)

AI 기억사진관 — AI로 기억을 간직하는 통합 플랫폼

## 서비스 소개

| 서비스 | 설명 |
|--------|------|
| AI 사진관 | 오래된 사진 복원, 화질 개선, 흑백 컬러라이징, 배경 제거 |
| AI 디지털 유언장 | 고인 사진 + 음성 → AI 영상 메시지 생성 → 유가족 전달 |
| 반려동물 아카이브 | 반려동물 기억 사진 보관 + AI 초상화 생성 |
| 추모관 | 유가족 전용 — 접근 코드로 고인 기억 모아보기 |

## 기술 스택

**프론트엔드**
- React 19 + Vite 7
- React Router v7
- Zustand v5 (상태 관리)
- Tailwind CSS v4 + 파일별 CSS (BEM 컨벤션)

**백엔드**
- Node.js + Express
- MySQL 8.4 (InnoDB, utf8mb4)
- BullMQ + Redis (AI 처리 비동기 큐)
- AWS S3 (파일 저장) + KMS (민감 데이터 암호화)

**AI API**
- OpenAI (사진 처리)
- ElevenLabs (음성 클론)
- D-ID (AI 영상 생성)
- remove.bg (배경 제거)

**결제**
- 토스페이먼츠

## 개발 환경 설정

### 1. 환경변수 설정

```bash
cp backend/.env.example backend/.env
# .env 파일을 열어 값 입력
```

### 2. DB 생성

```bash
mysql -u root -p -e "CREATE DATABASE ondam CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
# 스키마 설계 후:
mysql -u root -p ondam < ondam_schema.sql
```

### 3. Redis 실행 (BullMQ 필수)

```bash
redis-server
# 또는 Docker
docker run -d -p 6379:6379 redis
```

### 4. 의존성 설치

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 5. 개발 서버 실행

```bash
# 백엔드 (포트 4000)
cd backend && npm run dev

# 프론트엔드 (포트 5173)
cd frontend && npm run dev

# BullMQ 워커 (AI 처리 테스트 시)
cd backend && npm run workers
```

## 프로젝트 구조

```
ondam/
├── frontend/           # React 19 + Vite 7
│   └── src/
│       ├── pages/      # 페이지 (3레이어: Page + Hook + Api)
│       ├── components/ # 공통 컴포넌트
│       ├── layouts/    # 레이아웃
│       ├── store/      # Zustand 스토어
│       ├── config/     # axios 인스턴스
│       ├── constants/  # ROUTES 등 상수
│       └── styles/     # 전역 CSS + 디자인 토큰
│
├── backend/            # Express + MySQL 8
│   └── src/
│       ├── domains/    # 도메인별 Routes/Controller/Service/Repository
│       ├── middleware/ # auth, validate, errorHandler
│       ├── config/     # db.js, redis.js
│       ├── utils/      # response.js
│       └── jobs/       # BullMQ 큐 + 워커
│
├── ondam_schema.sql    # DB 스키마
└── .claude/            # 에이전트·스타일 가이드
```

## API 응답 포맷

```json
{
  "success": true,
  "message": "성공",
  "data": { ... },
  "meta": { "total": 100, "page": 1, "limit": 20 }
}
```

## 보안 주요 사항

- 음성·유언 영상 파일: AWS KMS 암호화 필수 (`KMS_KEY_ID`)
- AI 처리 작업: BullMQ 큐 경유 (직접 HTTP 핸들러 안 처리 금지)
- 음성 클론 생성 전: `voice_consent_at` 동의 확인 필수
- 추모관 접근: 접근 코드 검증 필수
- refreshToken: HttpOnly 쿠키 저장 (localStorage 금지)

## 브랜치 전략

- `main`: 배포 기준
- `claude`: 현재 개발 작업
- `feat/도메인명-기능명`: feature 브랜치
