# BullMQ 작업 큐

온담의 AI 처리 작업은 HTTP 요청 중에 직접 처리하지 않고 **BullMQ 큐를 통해 비동기 처리**합니다.

## 큐 목록

| 큐 이름 | 용도 | 외부 API |
|--------|------|---------|
| `photo` | 사진 배경 제거, 화질 개선, 컬러라이징, 복원 | remove.bg, OpenAI |
| `voiceClone` | 고인 음성 클론 생성 | ElevenLabs |
| `videoGenerate` | AI 말하는 영상 생성 (사진 + 음성) | D-ID |
| `notification` | 이메일/SMS 발송 | Coolsms, Nodemailer |

## 사용 방법

### 작업 추가 (컨트롤러에서)
```js
import { photoQueue } from '../jobs/queue.js'

// 사진 처리 작업 추가
await photoQueue.add('enhance', {
  jobId: uuid,         // DB jobs 테이블 ID
  userId: user.id,
  s3Key: 'photos/...',
  type: 'enhance',     // enhance | restore | colorize | remove_bg
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
})
```

### 작업 상태 조회
```js
const job = await photoQueue.getJob(jobId)
const state = await job.getState() // waiting | active | completed | failed
```

## 보안 주의사항

- **음성 데이터**: voiceClone 큐의 페이로드에 음성 원본 S3 URL 포함 - KMS로 암호화 필수
- **유언 영상**: videoGenerate 완료 후 S3 저장 시 서버사이드 암호화 (`SSE-KMS`) 강제
- **동의 없는 처리 금지**: 큐 추가 전 반드시 `consent_at` 확인

## 워커 실행

```bash
# 개발
npm run workers

# PM2 (프로덕션)
pm2 start src/jobs/index.js --name ondam-workers
```
