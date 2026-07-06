# 온담(ondam) 서비스 기능명세 & 기술스택

**문서 버전**: 1.0  
**최종 수정**: 2026-04-19  
**상태**: 개발 진행 중

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **서비스명** | 온담(ondam) |
| **슬로건** | AI로 기억을 간직하는 플랫폼 |
| **타겟 사용자** | 중장년층(50대 이상) |
| **타겟 UX** | 어르신 친화(버튼 48px 이상, 폰트 16px 이상) |
| **MVP 서비스** | AI 사진관 + AI 디지털 유언장 |

---

## 2. 서비스 & 기능 명세

### 서비스 1. AI 사진관 (9,900원/세트)

**설명**: 낡거나 손상된 사진을 AI로 보정하고, 정장 착용 AI 합성을 통해 특별한 순간을 연출하는 서비스

| # | 기능 | 상세 | 우선순위 |
|----|------|------|---------|
| 1 | 사진 업로드 | JPG/PNG 형식, 최대 20MB | P0 |
| 2 | AI 화질 복원 | 흐림·노이즈·손상 제거 (Real-ESRGAN) | P0 |
| 3 | 흑백→컬러 변환 | 레거시 흑백 사진 컬러화 | P1 |
| 4 | 배경 제거 | remove.bg API 활용 | P1 |
| 5 | 정장 착용 AI 합성 | 장례/증명/취업 타입 선택 | P0 |
| 6 | 진행률 표시 | 폴링(3초) 기반 실시간 반영 | P0 |
| 7 | 결과물 다운로드 | 원본 + 보정본 세트 ZIP | P0 |
| 8 | 재처리 1회 무료 | 고객 서비스 정책 | P1 |
| 9 | 카카오톡 공유 | 카카오 API 간편공유 | P2 |
| 10 | 완료 SMS 알림 | 처리 완료 시 휴대폰 문자 | P0 |

**사용자 플로우**:
```
[업로드 페이지]
    ↓
[사진 선택 + 타입 선택(장례/증명/취업)]
    ↓
[결제(톤 페이먼츠)]
    ↓
[AI 처리 시작 - 3~5분 대기]
    ↓
[진행률 표시 페이지]
    ↓
[결과 확인 → 다운로드]
```

---

### 서비스 2. AI 디지털 유언장 (49,000원/건) ⭐ **핵심 서비스**

**설명**: 고인이 직접 유언을 읽어주는 AI 영상 - 가족에게 남기는 마지막 편지

#### 2-1. 핵심 결과물
> **고인이 직접 유언을 읽어주는 AI 영상**  
> ElevenLabs 음성 복제 + 립싱크 AI(TBD) = 사랑하는 사람의 목소리로 전달되는 영원한 메시지

#### 2-2. 기능 명세

| # | 기능 | 상세 | 우선순위 |
|----|------|------|---------|
| 1 | 초상권·음성권 동의서 | 디지털 서명 (구글 등 OAuth 기반) | P0 |
| 2 | 유가족 메시지 작성 | 받는 사람 이름·연락처·관계·메시지 입력 | P0 |
| 3 | 음성 샘플 녹음 | 브라우저 녹음, 10~30분 | P0 |
| 4 | AI 음성 복제 | ElevenLabs API (음성 클론) | P0 |
| 5 | 사진 업로드 | 얼굴 사진 1장 (고인 얼굴) | P0 |
| 6 | 미리보기 확인 | 텍스트+음성 검증 후 최종 결정 | P0 |
| 7 | 결제 | 톱 페이먼츠 (49,000원) | P0 |
| 8 | AI 유언 영상 생성 | 립싱크 AI (사진+TTS음성→말하는 영상, TBD: Higgsfield/Hedra/SadTalker 검토 중) | P0 |
| 9 | 재생성 1회 | 텍스트 수정 후 영상 재생성 | P1 |
| 10 | 암호화 보관 | AWS KMS (사망 전 유가족 접근 불가) | P0 |
| 11 | 사후 공개 트리거 | 유가족: 사망증명서 업로드 → 관리자 검토·승인 | P0 |
| 12 | 유가족 영상 수신 | 문자 링크(비회원), 90일 유효, 암호화 해제 | P0 |

#### 2-3. 사용자 플로우

```
┌─────────────────────────────────────────────────────────┐
│                    고인의 여정                           │
├─────────────────────────────────────────────────────────┤
│ 1. [동의서 서명 페이지]                                  │
│    └─ 초상권·음성권·개인정보 동의                        │
│                                                          │
│ 2. [유가족 등록 + 메시지 작성]                           │
│    └─ 유가족 1~5명, 각각 개별 메시지 작성               │
│       (고인의 목소리로 각자에게 읽어주는 영상)           │
│                                                          │
│ 3. [음성 녹음]                                           │
│    └─ 10~30분 브라우저 녹음                              │
│    └─ 음성 재생/재녹음 가능                              │
│                                                          │
│ 4. [사진 업로드]                                         │
│    └─ 고인의 얼굴 사진 1장                               │
│                                                          │
│ 5. [미리보기]                                            │
│    └─ 샘플 유가족 1명의 텍스트+음성 확인                 │
│    └─ 최종 승인                                          │
│                                                          │
│ 6. [결제] - 49,000원                                    │
│                                                          │
│ 7. [AI 영상 생성 중] - 약 30분~1시간                    │
│    └─ 실시간 진행률 표시                                 │
│                                                          │
│ 8. [암호화 보관 - 사망 전]                              │
│    └─ AWS KMS로 보호되는 개인 보관함                     │
│    └─ 매월 1,900원 보관료 자동결제 (구독)                │
│                                                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   유가족의 여정                           │
├─────────────────────────────────────────────────────────┤
│ 1. [사망증명서 업로드]                                   │
│    └─ PDF/이미지 업로드                                  │
│                                                          │
│ 2. [관리자 검토 & 승인]                                  │
│    └─ 진위성 확인 후 승인                                │
│                                                          │
│ 3. [문자(SMS) 수신]                                      │
│    └─ 비회원 링크: ondam.kr/watch/{token}                │
│    └─ 유효기간: 90일                                     │
│                                                          │
│ 4. [영상 재생]                                           │
│    └─ 고인이 직접 읽어주는 유언                           │
│    └─ 각 유가족별 개별 영상                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### 2-4. 수익화 구조 (락인 메커니즘)

| 항목 | 가격 | 상세 |
|------|------|------|
| **1회 생성** | 49,000원 | 음성 클론 생성 + 유언 영상 |
| **월간 보관료** | 1,900원/월 | 영상 암호화 보관(구독) |
| **이벤트 추가 영상** | 19,900원/건 | 같은 음성 재사용(결혼·탄생·생일) |

**락인 포인트**:
- 음성 클론이 온담 계정에 묶임 → 장기 고객 유지
- 보관 구독 해지 시 영상 삭제 예고(30일) → 재신청 유도
- 이벤트 영상은 기존 음성 클론 재활용 → 낮은 추가 원가

---

### 서비스 3. 반려동물 아카이브 (구독제)

**설명**: 사랑하던 반려동물의 추억을 저장하고 공유하는 디지털 추모공간

#### 3-1. 구독 티어

| 티어 | 가격 | 스토리지 | AI 초상화 | 이달의 추억 | 추모페이지 |
|------|------|---------|---------|----------|---------|
| **무료** | 무료 | 1GB | - | - | 기본 |
| **스탠다드** | 4,900원/월 | 30GB | 월 3장 | O (표준) | 커스텀 |
| **프리미엄** | 9,900원/월 | 100GB | 무제한 | O (고화질) | 커스텀 |

#### 3-2. 기능 명세

| # | 기능 | 상세 | 포함 티어 |
|----|------|------|---------|
| 1 | 반려동물 프로필 | 이름·종류·생일·사망일 입력 | 무료 |
| 2 | 사진·영상 업로드 | 용량 제한 (티어별) | 무료 |
| 3 | AI 초상화 생성 | 스타일 선택(수채화/유화/만화) | 스탠다드↑ |
| 4 | 추모 페이지 공개링크 | ondam.kr/memorial/{slug} (비회원) | 무료 |
| 5 | 기일·생일 알림 | 푸시 알림 | 무료 |
| 6 | 이달의 추억 자동생성 | 월별 자동 편집 영상 | 스탠다드↑ |

#### 3-3. 추모 페이지 예시
```
ondam.kr/memorial/lele-2015

┌──────────────────────────────┐
│    🐕 렐레 - 2010.3~2015.12  │
├──────────────────────────────┤
│  안녕하세요, 렐레입니다.      │
│  우리 가족과 함께한            │
│  5년 반의 행복한 시간.         │
│                              │
│  [사진 갤러리 - 24장]         │
│  [동영상 - 5개]               │
│  [기일 - 2025.12.27]         │
│  [조문 방명록 - 15명]         │
│                              │
└──────────────────────────────┘
```

---

### 공통 기능

| # | 기능 | 상세 |
|----|------|------|
| 1 | 회원가입 | 이메일 + 비밀번호, 휴대폰 인증 |
| 2 | 소셜 로그인 | 카카오 OAuth |
| 3 | 마이페이지 | 주문 내역·구독 관리·알림 설정·회원정보 |
| 4 | 결제 | 토스 페이먼츠 (카드·계좌이체·간편) |
| 5 | SMS 알림 | 처리 완료 시 휴대폰 문자 |
| 6 | 진행률 표시 | WebSocket 또는 폴링(3초) |
| 7 | 로그아웃 | JWT 토큰 무효화 + 쿠키 삭제 |

---

## 3. 페이지 목록 (28개)

### 공통 페이지 (4)

| 경로 | 이름 | 설명 |
|------|------|------|
| `/` | 랜딩 페이지 | 3가지 서비스 소개 + 가입/로그인 CTA |
| `/join` | 회원가입 | 이메일 + 카카오 가입 |
| `/login` | 로그인 | 이메일 + 카카오 로그인 |
| `/my` | 마이페이지 | 주문내역·구독·설정 |

### AI 사진관 (5)

| 경로 | 이름 | 설명 |
|------|------|------|
| `/photo` | 서비스 소개 | AI 사진관 설명 + 가격 + 예제 |
| `/photo/order` | 주문 생성 | 사진 업로드 + 타입 선택 |
| `/photo/payment` | 결제 | 토스 페이먼츠 결제 페이지 |
| `/photo/processing/:orderId` | 진행 중 | 실시간 진행률 표시 |
| `/photo/result/:orderId` | 결과 확인 | 원본 + 보정본 확인 + 다운로드 |

### AI 유언장 (10)

| 경로 | 이름 | 설명 |
|------|------|------|
| `/will` | 서비스 소개 | AI 유언장 설명 + 가격 + FAQ |
| `/will/consent` | 동의서 서명 | 초상권·음성권 동의 |
| `/will/beneficiaries` | 유가족 등록 | 유가족 1~5명 등록 + 메시지 입력 |
| `/will/record` | 음성 녹음 | 브라우저 녹음, 10~30분 |
| `/will/photo` | 사진 업로드 | 얼굴 사진 1장 업로드 |
| `/will/preview` | 미리보기 | 음성 + 텍스트 확인 |
| `/will/payment` | 결제 | 토스 페이먼츠 (49,000원) |
| `/will/processing/:willId` | 생성 중 | 실시간 진행률 (30분~1시간) |
| `/will/vault` | 보관함 | 생성된 유언장 목록 + 재생성 |
| `/will/event` | 이벤트 영상 | 추가 영상 생성 (결혼·탄생·생일) |

### 유가족 전용 (비회원, 2)

| 경로 | 이름 | 설명 |
|------|------|------|
| `/release/:token` | 사후공개 신청 | 비회원, 사망증명서 업로드 |
| `/watch/:token` | 유언 영상 재생 | 비회원, 암호화된 영상 재생 |

### 반려동물 (6)

| 경로 | 이름 | 설명 |
|------|------|------|
| `/pet` | 서비스 소개 | 반려동물 아카이브 설명 + 구독 플랜 |
| `/pet/new` | 반려동물 등록 | 이름·종류·생일·사망일 입력 |
| `/pet/:petId` | 아카이브 홈 | 사진·영상 갤러리 + 기일 알림 |
| `/pet/:petId/portrait` | AI 초상화 | AI 초상화 생성 + 스타일 선택 |
| `/memorial/:slug` | 추모 페이지 | 공개 링크 (비회원 접근 가능) |
| `/pet/subscription` | 구독 관리 | 구독 업그레이드·취소 |

### 관리자 (4)

| 경로 | 이름 | 설명 |
|------|------|------|
| `/admin` | 대시보드 | 매출·주문·사용자 통계 |
| `/admin/release` | 사후공개 검토 | 사망증명서 검증 + 승인/거부 |
| `/admin/orders` | 주문 관리 | AI 사진관 주문 상태 관리 |
| `/admin/users` | 회원 관리 | 사용자 목록·권한·제한 |

---

## 4. 기술 스택

### 프론트엔드

| 항목 | 기술 | 용도 |
|------|------|------|
| **프레임워크** | React 19 | UI 렌더링 |
| **빌드 도구** | Vite 7 | 개발/빌드 |
| **라우팅** | React Router v6 | 페이지 라우팅 |
| **상태 관리** | Zustand | 전역 상태 |
| **HTTP 클라이언트** | Axios | API 통신 |
| **스타일링** | CSS Modules / BEM | 컴포넌트 스타일 |
| **UI 컴포넌트** | 커스텀 | 어르신 UX(48px 버튼) |
| **녹음** | Web Audio API | 브라우저 음성 녹음 |
| **파일 업로드** | Multer (BE) | FormData 처리 |

**주요 라이브러리**:
```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "react-router-dom": "^6.x",
  "zustand": "^4.x",
  "axios": "^1.x",
  "vite": "^7.x"
}
```

### 백엔드

| 항목 | 기술 | 용도 |
|------|------|------|
| **런타임** | Node.js | 서버 런타임 |
| **프레임워크** | Express | REST API |
| **데이터베이스** | MySQL 8.0 (InnoDB) | 메인 DB |
| **캐시** | Redis | 세션·캐시 |
| **작업 큐** | BullMQ | AI 비동기 작업 |
| **실시간** | Socket.io | 진행률 실시간 전송 |
| **인증** | JWT Dual-Token | 토큰 기반 인증 |
| **파일 저장** | AWS S3 | 미디어 저장소 |
| **CDN** | CloudFront | 미디어 배포 |
| **암호화** | AWS KMS | 민감 데이터 암호화 |
| **결제** | Toss Payments API | 결제 처리 |
| **문자** | SMS API | 알림 발송 |

**주요 라이브러리**:
```json
{
  "express": "^4.x",
  "mysql2": "^3.x",
  "redis": "^4.x",
  "bullmq": "^5.x",
  "socket.io": "^4.x",
  "jsonwebtoken": "^9.x",
  "aws-sdk": "^2.x",
  "@aws-sdk/client-kms": "^3.x",
  "@aws-sdk/client-s3": "^3.x",
  "axios": "^1.x"
}
```

### AI API

| 서비스 | API | 용도 | 비용 |
|-------|------|------|------|
| **화질 복원** | Real-ESRGAN | 흐림·노이즈 제거 | 무료(오픈소스) |
| **배경 제거** | remove.bg API | 배경 자동 제거 | $0.05/이미지 |
| **음성 복제** | ElevenLabs | 음성 클론 + 텍스트→음성 | $0.30~1/1k자 |
| **영상 생성 (립싱크)** | TBD | 사진+TTS음성→말하는 영상 ([결정 3] 미확정) | 미정 |
| **AI 정장 합성** | OpenAI GPT-4o | 프롬프트 최적화 | $0.015/1k입력토큰 |
| **OAuth** | 카카오 | 소셜 로그인 | 무료 |

**Python 워커** (별도):
```python
# Real-ESRGAN 로컬 실행
import cv2
from realesrgan import RealESRGAN

def upscale(input_path):
    model = RealESRGAN(...)
    return model.enhance(cv2.imread(input_path))
```

### 인프라 & 외부 서비스

| 항목 | 서비스 | 용도 |
|------|-------|------|
| **클라우드** | AWS | EC2·S3·KMS·CloudFront |
| **컨테이너** | Docker | 배포 이미지화 |
| **CI/CD** | GitHub Actions | 자동 배포 |
| **모니터링** | CloudWatch | 로그·메트릭 |
| **결제** | Toss Payments | 신용카드·계좌이체 |
| **문자** | Twilio 또는 국내 API | SMS 발송 |
| **DNS** | Route 53 | 도메인 관리 |
| **이메일** | SES 또는 SendGrid | 트랜잭션 이메일 |

---

## 5. 데이터베이스 스키마

### DB 설계 원칙

```sql
-- 모든 테이블 기본 구조
CREATE TABLE {table_name} (
  id INT AUTO_INCREMENT PRIMARY KEY,          -- 내부 JOIN용
  uuid CHAR(36) UNIQUE NOT NULL,              -- 외부 노출용 (UUID4)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,                  -- 소프트삭제
  created_by INT NOT NULL,                    -- 감사용
  updated_by INT,
  ...
);

-- 민감 데이터 암호화 (KMS)
VARBINARY(512)  -- ENC_voice_file, ENC_video_file, ENC_billing_key
INT             -- kms_key_id (KMS 키 ID)

-- 상태 로그 (Append-Only)
CREATE TABLE {table_name}_status_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  {table_name}_id INT NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT,
  KEY({table_name}_id)
);
```

### 테이블 목록 (26개)

#### 회원/인증 (6)

```sql
-- 1. users
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,          -- bcrypt
  phone VARCHAR(20),
  name VARCHAR(100),
  birthdate DATE,
  kakao_id VARCHAR(100) UNIQUE,                 -- 카카오 OAuth
  auth_level ENUM('verified','pending'),        -- 휴대폰 인증 여부
  profile_image_url VARCHAR(500),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY(email), KEY(kakao_id)
);

-- 2. user_consents
CREATE TABLE user_consents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  uuid CHAR(36) UNIQUE NOT NULL,
  consent_type ENUM('privacy','voice_clone','ai_video','marketing'),
  consent_text TEXT,
  agreed_at TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  KEY(user_id)
);

-- 3. email_verifications
CREATE TABLE email_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  token CHAR(32),
  expires_at TIMESTAMP,
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. phone_verifications
CREATE TABLE phone_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  code CHAR(6),
  expires_at TIMESTAMP,
  verified_at TIMESTAMP NULL,
  attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. password_reset_tokens
CREATE TABLE password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token CHAR(32),
  expires_at TIMESTAMP,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  KEY(user_id)
);

-- 6. refresh_tokens
CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(500),
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  KEY(user_id)
);
```

#### AI 사진관 (3)

```sql
-- 7. photo_orders
CREATE TABLE photo_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  order_number VARCHAR(20) UNIQUE NOT NULL,    -- e.g., PHO-20260419-001
  status ENUM('pending','processing','completed','failed','cancelled'),
  photo_type ENUM('funeral','certificate','employment'),  -- 정장 타입
  original_image_key VARCHAR(255),              -- S3 키
  processed_images JSON,                        -- 다중 결과 {urls:[...]}
  progress_percent INT DEFAULT 0,
  ai_job_id INT,                                -- BullMQ 작업 ID 연결
  processing_started_at TIMESTAMP NULL,
  processing_completed_at TIMESTAMP NULL,
  total_price INT,                              -- 9,900원
  paid_at TIMESTAMP NULL,
  payment_method VARCHAR(50),
  reprocess_count INT DEFAULT 0,                -- 재처리 카운트
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  KEY(user_id), KEY(status), KEY(order_number)
);

-- 8. photo_order_status_logs
CREATE TABLE photo_order_status_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  photo_order_id INT NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  progress_percent INT,
  reason TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(photo_order_id) REFERENCES photo_orders(id),
  KEY(photo_order_id)
);

-- 9. photo_files
CREATE TABLE photo_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  photo_order_id INT NOT NULL,
  file_type ENUM('original','processed'),
  s3_key VARCHAR(255),                         -- S3 객체 키
  file_size INT,
  mime_type VARCHAR(50),
  download_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(photo_order_id) REFERENCES photo_orders(id),
  KEY(photo_order_id)
);
```

#### AI 유언장 (6)

```sql
-- 10. voice_samples
CREATE TABLE voice_samples (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  ENC_audio_data VARBINARY(512),                -- KMS 암호화
  kms_key_id VARCHAR(100),
  duration_seconds INT,                        -- 녹음 길이
  sample_rate INT,                             -- 44100 또는 48000
  format VARCHAR(20),                          -- 'wav', 'mp3'
  voice_clone_id VARCHAR(100),                 -- ElevenLabs voice_id
  voice_clone_status ENUM('pending','created','failed'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  KEY(user_id)
);

-- 11. wills
CREATE TABLE wills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  voice_sample_id INT NOT NULL,
  will_number VARCHAR(20) UNIQUE NOT NULL,     -- e.g., WILL-20260419-001
  status ENUM('draft','submitted','processing','completed','archived','released'),
  ENC_video_data VARBINARY(512),               -- 립싱크 벤더 영상 (KMS 암호화, Sync.so/MuseTalk/D-ID 중 택1)
  kms_key_id VARCHAR(100),
  video_key_s3 VARCHAR(255),                   -- S3 동영상 키
  lipsync_external_job_id VARCHAR(100),        -- 립싱크 벤더 외부 작업 ID (벤더 무관)
  thumbnail_url VARCHAR(500),
  total_beneficiaries INT,
  progress_percent INT DEFAULT 0,
  ai_job_id INT,                               -- BullMQ 작업
  processing_started_at TIMESTAMP NULL,
  processing_completed_at TIMESTAMP NULL,
  total_price INT,                             -- 49,000원
  paid_at TIMESTAMP NULL,
  reprocess_count INT DEFAULT 0,               -- 재생성 횟수
  archived_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(voice_sample_id) REFERENCES voice_samples(id),
  KEY(user_id), KEY(status)
);

-- 12. will_status_logs
CREATE TABLE will_status_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  will_id INT NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  progress_percent INT,
  reason TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(will_id) REFERENCES wills(id),
  KEY(will_id)
);

-- 13. will_beneficiaries
CREATE TABLE will_beneficiaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  will_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  relationship VARCHAR(50),                    -- '아들', '딸', '친구' 등
  message TEXT NOT NULL,                       -- 유언 메시지
  video_token CHAR(32),                        -- 영상 수신 토큰
  token_expires_at TIMESTAMP NULL,
  video_watched_at TIMESTAMP NULL,
  watch_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(will_id) REFERENCES wills(id),
  KEY(will_id), KEY(video_token)
);

-- 14. will_release_requests
CREATE TABLE will_release_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  will_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('submitted','reviewing','approved','rejected'),
  ENC_death_cert_file VARBINARY(512),          -- 사망증명서 (KMS)
  kms_key_id VARCHAR(100),
  death_date DATE,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  reviewed_by INT,                             -- 관리자 ID
  review_notes TEXT,
  approved_at TIMESTAMP NULL,
  released_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(will_id) REFERENCES wills(id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  KEY(status), KEY(will_id)
);

-- 15. avatar_sessions (립싱크 벤더 세션 추적)
CREATE TABLE avatar_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  will_id INT NOT NULL,
  d_id_session_id VARCHAR(100),
  d_id_status VARCHAR(50),                     -- 'pending', 'processing', 'done', 'error'
  video_url VARCHAR(500),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(will_id) REFERENCES wills(id),
  KEY(will_id)
);
```

#### 반려동물 (3)

```sql
-- 16. pets
CREATE TABLE pets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  species VARCHAR(50),                         -- '개', '고양이', '새' 등
  breed VARCHAR(100),
  birthdate DATE,
  death_date DATE NULL,
  status ENUM('alive','deceased'),
  profile_image_url VARCHAR(500),
  bio TEXT,
  memorial_slug VARCHAR(100) UNIQUE,           -- 추모페이지 slug
  is_public BOOLEAN DEFAULT TRUE,              -- 추모페이지 공개 여부
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  KEY(user_id), KEY(memorial_slug)
);

-- 17. pet_status_logs
CREATE TABLE pet_status_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pet_id INT NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(pet_id) REFERENCES pets(id),
  KEY(pet_id)
);

-- 18. pet_media
CREATE TABLE pet_media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  pet_id INT NOT NULL,
  media_type ENUM('image','video'),
  s3_key VARCHAR(255),
  file_size INT,
  mime_type VARCHAR(50),
  caption TEXT,
  is_portrait BOOLEAN DEFAULT FALSE,           -- AI 초상화 여부
  portrait_style VARCHAR(50),                  -- '수채화', '유화', '만화' 등
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY(pet_id) REFERENCES pets(id),
  KEY(pet_id)
);
```

#### 결제/구독 (3)

```sql
-- 19. payments
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  order_type ENUM('photo','will','pet_upgrade'),
  order_id INT,                                -- photo_orders.id / wills.id / subscriptions.id
  amount INT,                                  -- 9900, 49000, 4900 등
  currency VARCHAR(3),                        -- 'KRW'
  payment_method VARCHAR(50),                 -- 'card', 'transfer', 'simple'
  toss_payment_key VARCHAR(100),               -- Toss Payments payment key
  toss_order_id VARCHAR(100),                  -- Toss orderID
  status ENUM('pending','completed','failed','refunded'),
  paid_at TIMESTAMP NULL,
  refunded_at TIMESTAMP NULL,
  refund_amount INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  KEY(user_id), KEY(status)
);

-- 20. subscriptions
CREATE TABLE subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  subscription_type ENUM('pet_standard','pet_premium','will_storage'),
  status ENUM('active','paused','cancelled'),
  plan_name VARCHAR(100),                      -- 'Pet Standard', 'Pet Premium' 등
  monthly_price INT,                           -- 4900, 9900, 1900 등
  cycle_start_date DATE,
  cycle_end_date DATE,
  auto_renew BOOLEAN DEFAULT TRUE,
  cancelled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  KEY(user_id), KEY(status)
);

-- 21. subscription_logs
CREATE TABLE subscription_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(subscription_id) REFERENCES subscriptions(id),
  KEY(subscription_id)
);
```

#### AI 작업 큐 (1)

```sql
-- 22. ai_jobs
CREATE TABLE ai_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  order_type ENUM('photo_upscale','photo_colorize','photo_remove_bg','photo_formal_wear','voice_clone','will_video','pet_portrait'),
  order_id INT,                                -- 해당 주문 ID
  job_type VARCHAR(50),                       -- BullMQ job_type
  status ENUM('queued','processing','completed','failed'),
  input_data JSON,
  output_data JSON,
  error_message TEXT,
  progress_percent INT DEFAULT 0,
  priority INT DEFAULT 0,                     -- 높을수록 우선순위
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  bullmq_job_id VARCHAR(100),
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY(order_type), KEY(status)
);
```

#### 알림 (2)

```sql
-- 23. notifications
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  notification_type ENUM('order_completed','will_ready','birthday','death_date','subscription_expiry'),
  title VARCHAR(255),
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  sent_via ENUM('in_app','email','sms'),
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  KEY(user_id), KEY(notification_type)
);

-- 24. user_notification_settings
CREATE TABLE user_notification_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  notification_type VARCHAR(50),
  via_email BOOLEAN DEFAULT TRUE,
  via_sms BOOLEAN DEFAULT TRUE,
  via_push BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  KEY(user_id),
  UNIQUE KEY(user_id, notification_type)
);
```

#### 관리자/감사 (2)

```sql
-- 25. admin_users
CREATE TABLE admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role ENUM('super_admin','content_moderator','payment_specialist'),
  permissions JSON,                           -- 권한 배열
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  UNIQUE KEY(user_id)
);

-- 26. audit_logs
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_user_id INT,
  action VARCHAR(100),                        -- 'approve_release', 'cancel_order' 등
  target_table VARCHAR(50),
  target_id INT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(admin_user_id) REFERENCES admin_users(user_id),
  KEY(target_table), KEY(created_at)
);
```

---

## 6. 개발 컨벤션

### 백엔드 레이어 구조

```
Routes → Controller → Service → Repository → Database
```

| 계층 | 책임 |
|------|------|
| **Routes** | HTTP 라우팅 + 요청 검증 |
| **Controller** | 요청 처리 + 응답 포맷 |
| **Service** | 비즈니스 로직 + 트랜잭션 |
| **Repository** | DB 쿼리 추상화 |

**파일 명명 규칙**:
```javascript
// 예: 유언장 기능
backend/src/routes/willRoutes.js
backend/src/controllers/willController.js
backend/src/services/willService.js
backend/src/repositories/willRepository.js
```

### API 응답 포맷

```json
{
  "success": true,
  "message": "성공했습니다",
  "data": {
    "orderId": "uuid",
    "status": "completed"
  },
  "meta": {
    "timestamp": "2026-04-19T10:30:00Z",
    "requestId": "req-xxx"
  }
}
```

### 에러 처리

```javascript
// 에러 던지기
throw Object.assign(new Error('유언장을 찾을 수 없습니다'), {
  status: 404,
  code: 'WILL_NOT_FOUND'
});

// 에러 응답
{
  "success": false,
  "message": "유언장을 찾을 수 없습니다",
  "code": "WILL_NOT_FOUND",
  "status": 404
}
```

### 프론트엔드 3레이어

```
pages/{domain}/
├── {Domain}Page.jsx    # 컴포넌트 렌더링만
├── use{Domain}.js      # 상태관리 + 비즈니스 로직
└── {domain}Api.js      # Axios API 호출
```

**예시 - 유언장**:
```
frontend/src/pages/will/
├── WillPage.jsx
├── useWill.js
└── willApi.js
```

### BullMQ 강제 규칙

| 금지 | 필수 |
|------|------|
| AI API 직접 호출 | 큐 경유 호출 |
| `await openai.chat.completions.create()` | BullMQ 큐 작업 |
| `await elevenLabs.textToSpeech()` | BullMQ 큐 작업 |
| `await didApi.createAvatar()` | BullMQ 큐 작업 |

**워커 구현 예시**:
```javascript
// backend/src/workers/willVideoWorker.js
const { Worker } = require('bullmq');

const willVideoWorker = new Worker('will_video', async (job) => {
  const { willId, voiceCloneId, message } = job.data;
  
  // 1. TTS 음성 생성 (ElevenLabs 클론된 목소리로 텍스트 읽기)
  const audio = await elevenLabsApi.textToSpeech(message, voiceCloneId);

  // 2. 진행률 갱신
  await job.updateProgress(50);

  // 3. 립싱크 영상 생성 (API TBD: Higgsfield / SadTalker / Hedra 중 선택)
  const video = await lipsyncApi.generate({
    photo: photoBuffer,
    audio: audioBuffer,
  });
  
  // 4. 진행률 갱신
  await job.updateProgress(80);
  
  // 5. 결과 저장
  return { videoUrl: video.video_url };
}, { connection: redis });

module.exports = willVideoWorker;
```

### KMS 암호화 강제 규칙

| 데이터 | 저장소 | 암호화 필수 |
|-------|-------|-----------|
| 음성 샘플 | S3 + DB | SSE-KMS |
| 유언 영상 | S3 + DB | SSE-KMS |
| 빌링 키 | DB | KMS 암호화 |
| 사망증명서 | S3 + DB | SSE-KMS |

**S3 저장 예시**:
```javascript
const s3 = new S3Client({});

await s3.send(new PutObjectCommand({
  Bucket: 'ondam-media',
  Key: `voices/${userId}/${voiceId}.wav`,
  Body: audioBuffer,
  ServerSideEncryption: 'aws:kms',
  SSEKMSKeyId: process.env.KMS_KEY_ID
}));
```

### 동의 선행 필수

```javascript
// 음성 복제 전 동의 확인
const hasConsent = await userConsentRepository.findByUserAndType(
  userId, 
  'voice_clone'
);

if (!hasConsent) {
  throw Object.assign(new Error('음성권 동의가 필요합니다'), {
    status: 403,
    code: 'VOICE_CONSENT_REQUIRED'
  });
}
```

### 환경변수 (.env 예시)

```bash
# DB
DB_HOST=localhost
DB_PORT=3306
DB_USER=ondam
DB_PASS=***
DB_NAME=ondam

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASS=***

# JWT
JWT_ACCESS_SECRET=***
JWT_REFRESH_SECRET=***
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# AWS
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=***
AWS_SECRET_ACCESS_KEY=***
AWS_S3_BUCKET=ondam-media
AWS_KMS_KEY_ID=***

# AI API
OPENAI_API_KEY=***
ELEVENLABS_API_KEY=***
LIPSYNC_API_KEY=***        # TBD: Higgsfield / SadTalker / Hedra 결정 후 교체
REMOVEBG_API_KEY=***

# Toss Payments
TOSS_SECRET_KEY=***
TOSS_CLIENT_KEY=***

# Kakao OAuth
KAKAO_CLIENT_ID=***
KAKAO_CLIENT_SECRET=***

# SMS
SMS_API_KEY=***
SMS_API_SECRET=***

# 기타
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://ondam.kr
BACKEND_URL=https://api.ondam.kr
```

---

## 7. 개발 로드맵

| 단계 | 서비스 | 기한 | 상태 |
|------|-------|------|------|
| **Phase 1** | AI 사진관 (MVP) | 2026년 5월 | 개발 중 |
| **Phase 2** | AI 유언장 (핵심) | 2026년 6월 | 계획 |
| **Phase 3** | 반려동물 아카이브 | 2026년 8월 | 계획 |
| **Phase 4** | 관리자 시스템 | 2026년 9월 | 계획 |

---

## 8. 주요 성능 지표 (KPI)

| 지표 | 목표 | 측정 기준 |
|------|------|---------|
| **월간 활성 사용자 (MAU)** | 10,000명 | 30일 내 1회 이상 접속 |
| **유언장 생성률** | 월 100건 | 결제 완료 건수 |
| **결제 전환율** | 3-5% | (결제완료 / 서비스 접속) |
| **API 응답시간** | <200ms | p95 기준 |
| **처리 성공률** | 99% | (완료 / 시작) |

---

**최종 수정**: 2026-05-01  
**다음 리뷰**: 2026-05-31
