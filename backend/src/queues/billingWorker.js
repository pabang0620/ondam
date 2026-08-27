/**
 * 구독 자동결제 BullMQ Worker
 * job 타입:
 *   - scan-due: 결제 대상 구독 스캔 → execute-billing job 큐 등록
 *   - execute-billing: 개별 구독 자동결제 실행
 */

import { Worker } from 'bullmq'
import { v4 as uuidv4 } from 'uuid'
import redis from '../config/redis.js'
import pool from '../config/db.js'
import { decryptString } from '../utils/kms.js'
import { billingQueue } from './billingQueue.js'
import * as subscriptionRepository from '../domains/subscription/subscriptionRepository.js'
import {
  runBilling,
  reserveBillingAttempt,
  todayKST,
  addOneMonth,
} from '../domains/subscription/subscriptionBillingService.js'
import { PLANS } from '../domains/subscription/subscriptionService.js'

/**
 * 오늘 날짜 'YYYYMMDD' 형식 반환
 */
const todayYYYYMMDD = () => todayKST().replace(/-/g, '')

/**
 * 결제 대상 구독 스캔 → execute-billing job 등록
 */
const handleScanDue = async () => {
  const dueSubscriptions = await subscriptionRepository.findDueSubscriptions(500)

  console.log(`[billingWorker] scan-due: ${dueSubscriptions.length}건 결제 대상 발견`)

  const date = todayYYYYMMDD()
  for (const sub of dueSubscriptions) {
    await billingQueue.add(
      'execute-billing',
      {
        subscriptionId: sub.subscription_id,
        userId: sub.user_id,
        plan: sub.plan,
      },
      {
        jobId: `billing_${sub.subscription_id}_${date}`,
      }
    )
  }
}

/**
 * 개별 구독 자동결제 실행
 */
const handleExecuteBilling = async (data) => {
  const { subscriptionId, userId, plan } = data
  const billingCycleDate = todayKST()

  // 1~3. 구독 조회(FOR UPDATE) + 멱등성 체크(당일 성공/pending 로그 확인) + pending
  // 로그 예약(선기록)까지 전부 같은 트랜잭션/락 구간 안에서 수행한다.
  // [DEV-26 수정] 이전에는 FOR UPDATE 조회 직후 바로 commit해 락이 즉시 풀렸고,
  // 그 뒤(락이 없는 상태)에서 멱등성 체크를 했다.
  // [CRITICAL #2 수정] 그 다음엔 멱등성 체크는 락 안으로 옮겼지만, attempt_no
  // 채번 + pending 로그 INSERT(reserveBillingAttempt에 해당하는 부분)는 여전히
  // 락 밖에서 수행했다 - 이 job이 동시에 두 번 실행되면(재시도 job 재등록 등) 둘
  // 다 "막을 로그 없음"을 보고 통과해 실결제 2건이 될 수 있었다. 이제 예약까지
  // 커밋된 뒤에만 락을 놓는다. 외부 API 호출(토스)이 필요한 실제 결제 실행은
  // 락을 놓은 뒤(트랜잭션 밖)에서 진행한다 - 락을 외부 API 호출 시간만큼 오래
  // 붙잡아두면 다른 쿼리를 막는 부작용이 더 크기 때문이다 (G4-4).
  const conn = await pool.getConnection()
  let sub
  let reservation
  let amount
  let missingBillingKey = false
  try {
    await conn.beginTransaction()
    sub = await subscriptionRepository.findSubscriptionForBilling(subscriptionId, conn)
    if (sub && ['active', 'past_due'].includes(sub.sub_status)) {
      // [C-7 수정] 빌링키 null 가드를 reserveBillingAttempt(예약/pending 선기록)
      // 보다 앞에 둔다. 예약이 이미 커밋된 뒤에 decryptString이 터지면 pending
      // 로그가 방치되고, jobId(billing_{subscriptionId}_{date}) 중복 차단 +
      // attempts:1(billingQueue.js 기본값) 때문에 당일 재시도가 전혀 발생하지
      // 않는다. 아예 예약을 만들지 않으면 이 job은 조용히 스킵되고, 다음 날
      // scan-due가 next_billing_at(이번에 손대지 않았으므로 여전히 지난 날짜)
      // 기준으로 다시 골라내 자연스럽게 재시도된다.
      if (!sub.toss_billing_key_encrypted) {
        missingBillingKey = true
      } else {
        const planInfo = PLANS[plan] ?? PLANS[sub.plan]
        amount = planInfo?.price ?? sub.price_krw
        reservation = await reserveBillingAttempt({
          subscriptionId,
          userId,
          billingCycleDate,
          attemptType: 'recurring',
          amount,
          conn,
        })
      }
    }
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  if (!sub) {
    console.warn(`[billingWorker] 구독 없음: ${subscriptionId}`)
    return
  }
  if (!['active', 'past_due'].includes(sub.sub_status)) {
    console.warn(`[billingWorker] 결제 불가 상태: ${subscriptionId} (${sub.sub_status})`)
    return
  }
  if (missingBillingKey) {
    // 빌링키 없이는 결제 자체가 불가능하다 - 카드사 재등록(retryPayment 또는
    // 재구독) 전까지는 매번 이 상태이므로 알림/상태 전이 없이 조용히 스킵한다.
    // 데이터 정합성상 active/past_due인데 빌링키가 없는 것은 정상 상태가
    // 아니므로 운영 가시성을 위해 error 레벨로 남긴다.
    console.error(
      `[billingWorker] 빌링키 없음 - 결제 스킵 (수동 확인 필요): ${subscriptionId} (${sub.sub_status})`
    )
    return
  }
  if (!reservation) {
    console.log(`[billingWorker] 이미 처리된 결제: ${subscriptionId}`)
    return
  }

  // 4. 빌링키 복호화
  const billingKey = await decryptString(
    sub.toss_billing_key_encrypted,
    sub.billing_kms_key_id
  )

  // 5. 사용자 이메일 조회
  const [[userRow]] = await pool.execute(
    'SELECT email FROM users WHERE user_id = ? LIMIT 1',
    [userId]
  )
  const customerEmail = userRow?.email ?? ''

  const planInfo = PLANS[plan] ?? PLANS[sub.plan]
  const orderName = `리멤버미 ${planInfo?.name ?? plan} 정기구독`

  // 6. 결제 실행 (orderId/log는 위에서 락 안에 예약된 것을 그대로 사용)
  const result = await runBilling({
    subscriptionId,
    userId,
    billingKey,
    amount,
    orderId: reservation.orderId,
    orderName,
    customerEmail,
    log: reservation.log,
    isReclaim: reservation.isReclaim,
    // [C-2/#5 수정] 다음 청구일 드리프트 방지 - sub.next_billing_at은 실패
    // 재시도 중 _finalizeFailure가 재시도 스케줄(nextRetryAt)로 덮어써 "원래
    // 예정일"을 더 이상 신뢰할 수 없다. last_billed_at은 성공 시에만 갱신되므로
    // 재시도 동안 불변이다 - 여기서 +1개월 해 이번 사이클이 원래 청구됐어야 할
    // 날짜를 재구성한다(완료 보고 5번 참조).
    currentNextBillingAt: addOneMonth(sub.last_billed_at ?? sub.next_billing_at ?? new Date()),
  })

  // 7. 알림 INSERT - notification_type ENUM에 'payment_success'는 없다(정답은
  // 'payment_done'). 이 오타로 INSERT가 항상 예외를 던져 execute-billing job이
  // "결제는 성공했는데 job은 실패"로 기록됐고, existingLog가 이미 success라
  // 재시도해도 알림이 영구히 나가지 않는 문제가 있었다. ENUM 값을 고치는 것과
  // 별개로, 알림 발송 실패가 결제 처리 자체(job 성공 여부)를 뒤집지 않도록
  // 비차단으로 처리한다 (G6).
  //
  // [C-4 수정] result.indeterminate(불확정)는 "실패"가 아니다 - 로그는 pending
  // 그대로 남아 다음 재시도가 같은 orderId를 재선점한다. 이걸 payment_failed로
  // 알리면 사용자가 실제로는 처리 중일 수 있는 결제를 "실패"로 오인해 불필요한
  // 수동 재시도를 유발할 수 있다. notifications.notification_type ENUM에는
  // "확인 중"에 해당하는 값이 없으므로(ondam_schema.sql 실측 - photo_complete,
  // voice_clone_complete, will_video_ready, will_release_request, will_released,
  // payment_done, payment_failed, subscription_renewed, subscription_canceled,
  // pet_memorial_shared, admin_notice 뿐) 새 ENUM 값을 추가하는 대신 알림을
  // 생략하고 로그만 남긴다 (완료 보고 4번 참조).
  if (result.indeterminate) {
    console.warn(
      `[billingWorker] 결제 결과 불확정 - 알림 생략, 다음 재시도에서 재확인: ${subscriptionId} - ${result.failReason}`
    )
    return
  }

  const notificationId = uuidv4()
  try {
    if (result.success) {
      await pool.execute(
        `INSERT INTO notifications
           (notification_id, user_id, notification_type, target_type, target_id, title, message, created_at)
         VALUES (?, ?, 'payment_done', 'subscription', ?, '구독 결제 완료', ?, NOW())`,
        [
          notificationId,
          userId,
          subscriptionId,
          `${orderName} ${amount.toLocaleString()}원 결제가 완료되었습니다.`,
        ]
      )
      console.log(`[billingWorker] 결제 성공: ${subscriptionId}`)
    } else {
      await pool.execute(
        `INSERT INTO notifications
           (notification_id, user_id, notification_type, target_type, target_id, title, message, created_at)
         VALUES (?, ?, 'payment_failed', 'subscription', ?, '구독 결제 실패', ?, NOW())`,
        [
          notificationId,
          userId,
          subscriptionId,
          `${orderName} 결제에 실패했습니다. 사유: ${result.failReason ?? '알 수 없음'}`,
        ]
      )
      console.warn(`[billingWorker] 결제 실패: ${subscriptionId} - ${result.failReason}`)
    }
  } catch (notifyErr) {
    console.error(
      `[billingWorker] 알림 INSERT 실패 (결제 처리 결과에는 영향 없음): ${subscriptionId} - ${notifyErr.message}`
    )
  }
}

// 워커 등록
const worker = new Worker(
  'subscription-billing',
  async (job) => {
    if (job.name === 'scan-due') {
      await handleScanDue()
    } else if (job.name === 'execute-billing') {
      await handleExecuteBilling(job.data)
    }
  },
  {
    connection: redis,
    concurrency: 5,
    stalledInterval: 30000,
  }
)

worker.on('completed', (job) => {
  console.log(`[billingWorker] job 완료: ${job.name} (${job.id})`)
})

worker.on('failed', (job, err) => {
  console.error(`[billingWorker] job 실패: ${job?.name} (${job?.id}) - ${err.message}`)
})

export default worker
