# 립싱크 벤더 테스트 가이드

**작성일**: 2026-07-06

---

## 배경

`backend/scripts/test-lipsync.js` CLI 도구로 3개 립싱크 벤더(Sync.so / MuseTalk / D-ID)에 같은 사진+음성을 넣어 결과 영상 품질을 직접 비교할 수 있다.

---

## 사전 준비

### 1. 패키지 설치

```bash
cd backend && npm install
```

이번에 `fluent-ffmpeg`, `ffmpeg-static`이 새로 추가됨. 시스템에 ffmpeg 바이너리가 없어도 `ffmpeg-static`이 번들된 바이너리를 자동으로 사용한다.

### 2. 각 벤더 API 키 발급

| 벤더 | 발급 경로 | 비고 |
|------|-----------|------|
| Sync.so | https://sync.so | 가입 후 API 키 발급 |
| MuseTalk | https://fal.ai | Fal.ai 계정 생성 후 API 키 발급 - MuseTalk 모델을 Fal 경유로 사용 |
| D-ID | https://www.d-id.com | 가입 후 API 키 발급 |

### 3. `.env` 파일 채우기

`backend/.env` (없으면 `backend/.env.example` 복사해서 사용)

```
LIPSYNC_PROVIDER=sync   # 기본값. CLI에서 --provider로 오버라이드 가능하니 신경 안 써도 됨
SYNC_API_KEY=발급받은키
FAL_API_KEY=발급받은키
DID_API_KEY=발급받은키
```

**주의**: 3개 어댑터 모두 임시 파일을 S3에 KMS 암호화해서 업로드하는 과정을 거치므로, 아래 AWS 관련 값도 반드시 채워져 있어야 한다 (API 키만 넣으면 실패함).

```
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=
KMS_KEY_ID=
```

### 4. 테스트용 사진·음성 파일 준비

- **사진**: 정면, 균일한 조명, 중립 표정 권장 (HeyGen 공식 가이드 기준 - 어떤 벤더를 쓰든 공통으로 유리)
- **음성**: 대본을 읽는 mp3/wav 파일 (실제 서비스에서는 ElevenLabs로 클론된 음성을 쓰지만, 테스트 단계에서는 아무 음성 파일이나 넣어서 립싱크 정확도만 먼저 확인 가능)

---

## 실행

### 5. 벤더별로 하나씩 실행

같은 사진·음성으로 3번 반복한다. 결과 비교가 핵심이므로 입력은 동일하게 유지할 것.

```bash
node scripts/test-lipsync.js --provider sync --photo ./test-photo.jpg --audio ./test-audio.mp3 --out ./result-sync.mp4
node scripts/test-lipsync.js --provider musetalk --photo ./test-photo.jpg --audio ./test-audio.mp3 --out ./result-musetalk.mp4
node scripts/test-lipsync.js --provider did --photo ./test-photo.jpg --audio ./test-audio.mp3 --out ./result-did.mp4
```

각 실행이 끝나면 콘솔에 소요 시간(초)이 출력된다.

### 6. 결과 비교 관점

- 입 모양이 자연스럽게 음성에 맞는지 (립싱크 정확도)
- 얼굴이 프레임마다 안 흔들리는지 (temporal consistency / face drift 여부)
- 처리 속도 (콘솔에 출력된 소요 시간)
- 실제 비용 대비 만족스러운 퀄리티인지 (Sync.so 초당 과금, MuseTalk 종량제, D-ID 분당 과금 - 벤더별 요금제는 실제 대시보드에서 확인)

---

## 문제 발생 시

### 7. "허용되지 않는 영상 URL 호스트" 에러

SSRF 허용 호스트 목록이 실제 벤더 응답과 달라서 나는 에러다. 에러 메시지에 찍힌 실제 호스트명을 그대로 캡처해서 알려주면 코드에서 바로 수정 가능.

### 8. AWS/KMS 관련 에러

`.env`의 `AWS_*`, `S3_BUCKET`, `KMS_KEY_ID` 값이 비어있거나 잘못된 경우다. 이 값들은 온담 실제 AWS 인프라 값을 그대로 써야 한다.
