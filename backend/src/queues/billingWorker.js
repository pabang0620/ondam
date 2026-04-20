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
import * as subscriptionPaymentLogRepository from '../domains/subscription/subscriptionPaymentLogRepository.js'
import * as subscriptionRepository from '../domains/subscription/subscriptionRepository.js'
import {
  runBilling,
  todayKST,
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

  // 1. 구독 조회 (FOR UPDATE — 트랜잭션 + conn 전달로 실제 잠금)
  const conn = await pool.getConnection()
  let sub
  try {
    await conn.beginTransaction()
    sub = await subscriptionRepository.findSubscriptionForBilling(subscriptionId, conn)
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

  // 2. 멱등성 — 오늘 이미 성공/pending 로그 있으면 skip
  const billingCycleDate = todayKST()
  const existingLog = await subscriptionPaymentLogRepository.findTodayLog(subscriptionId, billingCycleDate)
  if (existingLog) {
    console.log(`[billingWorker] 이미 처리된 결제: ${subscriptionId} (${existingLog.log_status})`)
    return
  }

  // 3. attempt_no 채번
  const lastAttemptNo = await subscriptionPaymentLogRepository.getLastAttemptNo(subscriptionId, billingCycleDate)
  const attemptNo = lastAttemptNo + 1

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
  const amount = planInfo?.price ?? sub.price_krw
  const orderName = `온담 ${planInfo?.name ?? plan} 정기구독`
  const orderId = `sub_${subscriptionId.slice(0, 8)}_${billingCycleDate.replace(/-/g, '')}`

  // 6. 결제 실행
  const result = await runBilling({
    subscriptionId,
    userId,
    billingKey,
    amount,
    orderId,
    orderName,
    customerEmail,
    attemptType: 'recurring',
    billingCycleDate,
    attemptNo,
  })

  // 7. 알림 INSERT
  const notificationId = uuidv4()
  if (result.success) {
    await pool.execute(
      `INSERT INTO notifications
         (notification_id, user_id, notification_type, target_type, target_id, title, message, created_at)
       VALUES (?, ?, 'payment_success', 'subscription', ?, '구독 결제 완료', ?, NOW())`,
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
    console.warn(`[billingWorker] 결제 실패: ${subscriptionId} — ${result.failReason}`)
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
  console.error(`[billingWorker] job 실패: ${job?.name} (${job?.id}) — ${err.message}`)
})

export default worker
