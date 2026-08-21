/**
 * 구독 자동결제 BullMQ Queue
 */

import { Queue } from 'bullmq'
import redis from '../config/redis.js'

export const billingQueue = new Queue('subscription-billing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 500,
    removeOnFail: 2000,
  },
})

const SCAN_DUE_SCHEDULER_ID = 'billing-scan-due'

/**
 * 구독 자동결제 scan-due 반복 job 스케줄 등록/갱신
 *
 * [DEV-26 수정] BullMQ v3+ 부터 repeat 옵션은 `cron`이 아니라 `pattern`이다.
 * `repeat: { cron }`으로 등록하면 다음 실행 시각이 계산되지 않아 반복 job이
 * 조용히 등록되지 않는다(G7-2) - 정기결제가 아예 돌지 않는 이 결함의 근본 원인.
 * v5 권장 API인 upsertJobScheduler를 사용한다. 이 API는 schedulerId 기준으로
 * upsert하므로 여러 번(서버 기동 시 + 최초 구독 시) 호출해도 안전하다.
 * repeatable job에 custom jobId를 지정해도 BullMQ가 무시하므로 사용하지 않는다.
 *
 * 여러 곳(server.js, subscriptionService.js)에서 개별적으로 등록 코드를 두면
 * 이번처럼 cron/pattern 오타가 한쪽만 고쳐지고 다른 쪽은 방치되는 drift가
 * 재발할 수 있어 이 함수 하나로 단일화한다.
 *
 * @returns {Promise<boolean>} 등록 확인 성공 여부
 */
export const registerBillingScanDueScheduler = async () => {
  const pattern = process.env.BILLING_SCAN_CRON || '0 3 * * *'

  await billingQueue.upsertJobScheduler(
    SCAN_DUE_SCHEDULER_ID,
    { pattern, tz: 'Asia/Seoul' },
    { name: 'scan-due', data: {} },
  )

  // 조용히 실패하는 것이 이 결함의 본질이므로, 등록 호출이 성공했다고 믿지 않고
  // 실제로 스케줄러 목록에 반영됐는지 재조회해 로그로 검증한다.
  const schedulers = await billingQueue.getJobSchedulers()
  const registered = schedulers.find((s) => s.id === SCAN_DUE_SCHEDULER_ID)

  if (registered) {
    const nextRun = registered.next ? new Date(registered.next).toISOString() : '알 수 없음'
    console.log(
      `[billingQueue] scan-due 스케줄러 등록 확인됨 - pattern="${registered.pattern}" tz=${registered.tz} next=${nextRun}`,
    )
    return true
  }

  console.error(
    '[billingQueue] scan-due 스케줄러 등록 확인 실패 - getJobSchedulers()에 없음. 정기결제 자동 스캔이 동작하지 않습니다.',
  )
  return false
}
