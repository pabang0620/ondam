/**
 * 유언 영상 편지 미열람 리마인드 BullMQ Queue (SPEC-04 5절 "열람 링크 만료 임박")
 *
 * billingQueue.js와 동일한 upsertJobScheduler 패턴을 재사용한다 - BullMQ v3+부터
 * repeat 옵션은 `cron`이 아니라 `pattern`이고, v5 권장 API인 upsertJobScheduler는
 * schedulerId 기준 upsert이므로 여러 프로세스에서 반복 호출해도 안전하다.
 */

import { Queue } from 'bullmq'
import redis from '../config/redis.js'

export const willReminderQueue = new Queue('will-reminder', {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 200,
    removeOnFail: 1000,
  },
})

const SCAN_SCHEDULER_ID = 'will-reminder-scan-due'

/**
 * 열람 링크 만료 임박(7일 이내) + 미열람 수신인 스캔 반복 job 등록/갱신
 * SPEC-04 5절 "심야 발송 금지" - 기본값을 낮 시간대(오전 10시 KST)로 둔다.
 *
 * @returns {Promise<boolean>} 등록 확인 성공 여부
 */
export const registerWillReminderScheduler = async () => {
  const pattern = process.env.WILL_REMINDER_SCAN_CRON || '0 10 * * *'

  await willReminderQueue.upsertJobScheduler(
    SCAN_SCHEDULER_ID,
    { pattern, tz: 'Asia/Seoul' },
    { name: 'scan-reminders', data: {} },
  )

  // billingQueue와 동일하게, 등록 호출 성공을 그대로 믿지 않고 실제 스케줄러 목록에
  // 반영됐는지 재조회해 로그로 검증한다.
  //
  // [DEV-27 수정] bullmq 5.74.1 getJobSchedulers()는 식별자를 `id`가 아니라 `key`
  // 필드에 담아 반환한다(billingQueue.js에서 실측 확인). key 우선 + id 폴백으로 비교.
  const schedulers = await willReminderQueue.getJobSchedulers()
  const registered = schedulers.find((s) => (s.key ?? s.id) === SCAN_SCHEDULER_ID)

  if (registered) {
    const nextRun = registered.next ? new Date(registered.next).toISOString() : '알 수 없음'
    console.log(
      `[willReminderQueue] scan-reminders 스케줄러 등록 확인됨 - pattern="${registered.pattern}" tz=${registered.tz} next=${nextRun}`,
    )
    return true
  }

  console.error(
    '[willReminderQueue] scan-reminders 스케줄러 등록 확인 실패 - getJobSchedulers()에 없음. 미열람 리마인드가 동작하지 않습니다.',
  )
  return false
}
