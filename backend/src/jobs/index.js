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

console.error('[ondam-workers] BullMQ 워커 시작됨')
console.error('[ondam-workers] 활성 큐: photo, voiceClone, videoGenerate, notification')

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

const shutdown = async (signal) => {
  console.error(`[ondam-workers] ${signal} 수신 - graceful shutdown 시작`)

  try {
    await Promise.all([
      photoWorker.close(),
      voiceWorker.close(),
      videoWorker.close(),
      notificationWorker.close(),
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
