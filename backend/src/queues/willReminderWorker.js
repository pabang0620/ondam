/**
 * 유언 영상 편지 미열람 리마인드 워커 (SPEC-04 5절, SPEC-05 3절)
 *
 * willReminderQueue.js가 등록한 반복 job('scan-reminders')을 소비한다. 만료
 * 7일 이내 + 미열람 수신인을 PK 커서 배치로 스캔해 1인당 1회만 알림톡/SMS
 * 리마인드를 발송한다. LIMIT/OFFSET을 쓰지 않는 이유·1회 제한 판정 방법은
 * willRepository.findReminderCandidatesBatch/hasReminderBeenSent 주석 참고.
 */

import { Worker } from 'bullmq'
import redis from '../config/redis.js'
import { notificationQueue } from '../jobs/queue.js'
import * as willRepository from '../domains/will/willRepository.js'

const QUEUE_NAME = 'will-reminder'
const REMINDER_WINDOW_DAYS = 7
const BATCH_SIZE = 500

// SPEC-04 5절 민감 발송 문구 원칙: 죽음을 직접 언급하는 단어 최소화, 열람 강요 금지
// (통지는 1회로 제한 - 호출자가 hasReminderBeenSent로 보장), 기한이 지나도 페이지에서
// 다시 요청할 수 있다는 안내(SPEC-05 3절 연장 요청 경로)를 포함한다.
const buildReminderMessage = (name, watchUrl) => {
  const greeting = name ? `${name}님, ` : ''
  return (
    `${greeting}소중한 분이 남긴 영상 편지가 곧 열람 기한을 넘겨요. ` +
    `아직 열어보지 않으셨다면 확인해 주세요. 기한이 지나도 페이지에서 다시 요청하실 수 있어요. ${watchUrl}`
  )
}

const buildWatchUrl = (inviteToken) =>
  `${process.env.CLIENT_URL || 'http://localhost:5173'}/watch/${inviteToken}`

/**
 * SPEC-04 매트릭스: "열람 링크 만료 임박" 이벤트는 알림톡(1순위)/SMS(폴백)만 대상이고
 * 인앱·이메일은 없다. 알림톡 벤더는 아직 미선정(DEV-07)이라 지금은 SMS로만 발송한다 -
 * 벤더 연동 후 이 부분을 알림톡 우선 발송으로 교체할 것.
 */
const scanAndSendReminders = async () => {
  let cursorId = 0
  let totalCandidates = 0
  let totalSent = 0
  let totalSkippedNoPhone = 0

  for (;;) {
    const candidates = await willRepository.findReminderCandidatesBatch({
      cursorId,
      withinDays: REMINDER_WINDOW_DAYS,
      batchSize: BATCH_SIZE,
    })
    if (candidates.length === 0) break

    for (const beneficiary of candidates) {
      totalCandidates += 1
      try {
        const alreadySent = await willRepository.hasReminderBeenSent(beneficiary.beneficiary_id)
        if (alreadySent) continue

        if (!beneficiary.phone) {
          totalSkippedNoPhone += 1
          continue
        }

        const watchUrl = buildWatchUrl(beneficiary.invite_token)
        const message = buildReminderMessage(beneficiary.name, watchUrl)

        await notificationQueue.add('will_watch_reminder', {
          type: 'sms', // TODO(DEV-07): 알림톡 벤더 연동 후 1순위 채널로 교체
          to: beneficiary.phone,
          message,
        })

        // 발송 큐 등록 성공 직후 기록 - 이 시점 이후 실패(워커 측 실제 발송 실패)는
        // notificationWorker의 재시도/로그 영역이고, "1회 통지 시도했다"는 사실 자체는
        // 바뀌지 않으므로 여기서 확정한다(리마인드 스팸 방지가 우선).
        await willRepository.recordReminderSent(beneficiary.beneficiary_id, beneficiary.will_id)
        totalSent += 1
      } catch (err) {
        // 수신인 1명 처리 실패가 배치 전체를 막지 않는다 (G6 비차단 원칙)
        console.error(
          `[willReminderWorker] beneficiaryId=${beneficiary.beneficiary_id} 리마인드 처리 실패:`,
          err.message,
        )
      }
    }

    cursorId = candidates[candidates.length - 1].id
  }

  console.log(
    `[willReminderWorker] scan-reminders 완료 - 후보 ${totalCandidates}건, 발송 ${totalSent}건, ` +
      `연락처 없음 ${totalSkippedNoPhone}건`,
  )
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    if (job.name === 'scan-reminders') {
      await scanAndSendReminders()
    }
  },
  {
    connection: redis,
    concurrency: 1,
    stalledInterval: 30000,
  },
)

worker.on('completed', (job) => {
  console.log(`[willReminderWorker] job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  const maxAttempts = job?.opts?.attempts ?? 1
  console.error(
    `[willReminderWorker] job ${job?.id} failed (attempt ${job?.attemptsMade}/${maxAttempts}):`,
    err.message,
  )
})

worker.on('error', (err) => {
  console.error('[willReminderWorker] worker error:', err.message)
})

export default worker
