/**
 * 선물 미수행 리마인드 BullMQ Queue (SPEC-01 3-3 "미수행 리마인드", 4-6 "수행자 사망·
 * 수행 불능")
 *
 * willReminderQueue.js와 완전히 동일한 upsertJobScheduler 패턴을 재사용한다(재구현
 * 없음) - 큐 이름/스케줄러 ID만 gift 전용으로 바꾼다.
 */

import { Queue } from 'bullmq'
import redis from '../config/redis.js'

export const giftReminderQueue = new Queue('gift-reminder', {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 200,
    removeOnFail: 1000,
  },
})

const SCAN_SCHEDULER_ID = 'gift-reminder-scan-due'

/**
 * 미수행 선물(link_sent/opened/in_progress) 리마인드 + 만료 전이 스캔 반복 job 등록/
 * 갱신. willReminderQueue와 마찬가지로 낮 시간대 기본값(오전 11시 KST, will의 10시와
 * 겹치지 않게) - "심야 발송 금지" 원칙은 두 리마인드 모두 동일하게 적용된다.
 *
 * @returns {Promise<boolean>} 등록 확인 성공 여부
 */
export const registerGiftReminderScheduler = async () => {
  const pattern = process.env.GIFT_REMINDER_SCAN_CRON || '0 11 * * *'

  await giftReminderQueue.upsertJobScheduler(
    SCAN_SCHEDULER_ID,
    { pattern, tz: 'Asia/Seoul' },
    { name: 'scan-reminders', data: {} },
  )

  // [DEV-27 수정] bullmq 5.74.1 getJobSchedulers()는 식별자를 `id`가 아니라 `key`
  // 필드에 담아 반환한다(billingQueue.js에서 실측 확인). key 우선 + id 폴백으로 비교.
  const schedulers = await giftReminderQueue.getJobSchedulers()
  const registered = schedulers.find((s) => (s.key ?? s.id) === SCAN_SCHEDULER_ID)

  if (registered) {
    const nextRun = registered.next ? new Date(registered.next).toISOString() : '알 수 없음'
    console.log(
      `[giftReminderQueue] scan-reminders 스케줄러 등록 확인됨 - pattern="${registered.pattern}" tz=${registered.tz} next=${nextRun}`,
    )
    return true
  }

  console.error(
    '[giftReminderQueue] scan-reminders 스케줄러 등록 확인 실패 - getJobSchedulers()에 없음. 선물 미수행 리마인드가 동작하지 않습니다.',
  )
  return false
}
