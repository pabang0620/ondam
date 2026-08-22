/**
 * BullMQ 워커 엔트리포인트
 * 실행: npm run workers
 *
 * [주의] 이 파일은 별도 프로세스로 실행됩니다 (서버와 분리)
 * PM2: pm2 start src/jobs/index.js --name ondam-workers
 */
import 'dotenv/config'

import photoWorker from './workers/photoWorker.js'
import voiceWorker from './workers/voiceWorker.js'
import videoWorker from './workers/videoWorker.js'
import notificationWorker from './workers/notificationWorker.js'
import willReminderWorker from '../queues/willReminderWorker.js'
import { registerWillReminderScheduler } from '../queues/willReminderQueue.js'
import giftReminderWorker from '../queues/giftReminderWorker.js'
import { registerGiftReminderScheduler } from '../queues/giftReminderQueue.js'
import { checkDbConnection } from '../config/db.js'

console.error('[ondam-workers] BullMQ 워커 시작됨')
console.error('[ondam-workers] 활성 큐: photo, voiceClone, videoGenerate, notification, will-reminder, gift-reminder')

// DB 연결 헬스 프로브 (DEV-28) - 워커도 매 잡마다 DB에 상태를 기록하므로
// (jobs/payments/notifications 테이블 업데이트) 서버와 동일하게 부팅 시 확인한다.
// 실패해도 프로세스를 죽이지 않는다 - 워커가 죽으면 큐에 쌓인 잡이 전부 멈추므로,
// DB가 잠깐 불안정해도 재연결 가능성을 열어두는 편이 낫다(개발 편의 + 가용성).
checkDbConnection()

// SPEC-04 미열람 리마인드 반복 스캔 등록 - billingQueue의 scan-due와 동일 패턴.
// server.js는 다른 에이전트 소유라 여기(워커 전용 프로세스, 상시 구동)에서 등록한다.
registerWillReminderScheduler().catch((err) => {
  console.error('[ondam-workers] will-reminder 스케줄러 등록 실패:', err.message)
})

// SPEC-01 3-3/4-6 선물 미수행 리마인드 반복 스캔 등록 - 위와 동일 패턴
registerGiftReminderScheduler().catch((err) => {
  console.error('[ondam-workers] gift-reminder 스케줄러 등록 실패:', err.message)
})

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

const shutdown = async (signal) => {
  console.error(`[ondam-workers] ${signal} 수신 - graceful shutdown 시작`)

  try {
    await Promise.all([
      photoWorker.close(),
      voiceWorker.close(),
      videoWorker.close(),
      notificationWorker.close(),
      willReminderWorker.close(),
      giftReminderWorker.close(),
    ])
    console.error('[ondam-workers] 모든 워커 정상 종료')
    process.exit(0)
  } catch (err) {
    console.error('[ondam-workers] 워커 종료 중 오류:', err.message)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
