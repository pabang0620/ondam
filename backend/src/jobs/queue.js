import { Queue } from 'bullmq'
import redis from '../config/redis.js'

const connection = redis

/**
 * 큐 공통 기본 job 옵션
 * - attempts: 최대 3회 재시도
 * - backoff: 지수 백오프 (2초 → 4초 → 8초)
 * - removeOnComplete: 완료 job 최대 100개 보관
 * - removeOnFail: 실패 job 최대 500개 보관 (디버깅용)
 */
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
}

/**
 * AI 사진 처리 큐
 * - 사진 배경 제거 (remove-bg)
 * - 화질 개선 (enhance)
 * - 흑백 컬러라이징 (colorize)
 * - 오래된 사진 복원 (restore)
 */
export const photoQueue = new Queue('photo', { connection, defaultJobOptions })

/**
 * AI 음성 클론 큐
 * - ElevenLabs API 호출
 * - 음성 파일 생성 + S3 업로드
 * - [보안] 음성 데이터는 KMS 암호화 필수
 */
export const voiceCloneQueue = new Queue('voiceClone', { connection, defaultJobOptions })

/**
 * AI 영상 생성 큐
 * - D-ID API 호출 (사진 + 음성 → 말하는 영상)
 * - [보안] 유언 영상은 KMS 암호화 필수
 */
export const videoGenerateQueue = new Queue('videoGenerate', { connection, defaultJobOptions })

/**
 * 이메일/SMS 발송 큐
 */
export const notificationQueue = new Queue('notification', { connection, defaultJobOptions })

export const queues = {
  photo: photoQueue,
  voiceClone: voiceCloneQueue,
  videoGenerate: videoGenerateQueue,
  notification: notificationQueue,
}
