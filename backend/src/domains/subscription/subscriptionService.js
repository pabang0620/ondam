import { v4 as uuidv4 } from 'uuid'
import { encryptString, decryptString } from '../../utils/kms.js'
import * as subscriptionRepository from './subscriptionRepository.js'
import * as subscriptionPaymentLogRepository from './subscriptionPaymentLogRepository.js'
import * as subscriptionTossClient from './subscriptionTossClient.js'
import {
  runBilling,
  reserveBillingAttempt,
  addOneMonth,
  todayKST,
} from './subscriptionBillingService.js'
import { registerBillingScanDueScheduler } from '../../queues/billingQueue.js'
import pool from '../../config/db.js'

/**
 * 구독 플랜 상수
 */
export const PLANS = {
  pet_archive: { price: 4900, name: '반려동물 스탠다드' },
  will_premium: { price: 1900, name: '유언장 보관' },
  all: { price: 9900, name: '전체' },
}

/**
 * 구독 플랜 목록 반환 (비인증 접근 가능)
 */
export const getPlans = () => {
  return Object.entries(PLANS).map(([planKey, info]) => ({
    plan: planKey,
    name: info.name,
    priceKrw: info.price,
  }))
}

/**
 * 사용자 구독 목록 조회
 */
export const getSubscriptions = async (userId) => {
  const rows = await subscriptionRepository.findSubscriptionsByUserId(userId)
  return rows.map((row) => ({
    ...row,
    subStatus: row.sub_status,
  }))
}

/**
 * 구독 시작
 * 1. 중복 활성 구독 체크
 * 2. authKey → billingKey 교환 (토스)
 * 3. 빌링키 KMS 암호화
 * 4. 즉시 첫 결제 실행 (attempt_type='initial')
 * 5. 결제 성공 시에만 subscriptions INSERT
 * 6. 결제 실패 시 402 throw
 * 7. scan-due repeat job 등록 (최초 1회)
 */
export const subscribe = async (userId, { plan, authKey, customerKey }) => {
  if (!PLANS[plan]) {
    throw Object.assign(new Error('유효하지 않은 구독 플랜입니다'), { status: 400 })
  }
  if (!authKey) {
    throw Object.assign(new Error('authKey는 필수입니다'), { status: 400 })
  }
  if (!customerKey) {
    throw Object.assign(new Error('customerKey는 필수입니다'), { status: 400 })
  }

  // 중복 구독 확인 - active뿐 아니라 past_due/suspended도 차단 대상 (task 7)
  const existing = await subscriptionRepository.findBlockingSubscription(userId, plan)
  if (existing) {
    throw Object.assign(
      new Error('이미 구독 중이거나 연체/정지 상태인 플랜이 있습니다. 결제 재시도 또는 취소 후 다시 시도해 주세요'),
      { status: 409 }
    )
  }

  // authKey → billingKey 교환
  const issueResult = await subscriptionTossClient.issueBillingKey({ authKey, customerKey })
  if (!issueResult.ok) {
    throw Object.assign(
      new Error(issueResult.errorMessage ?? '빌링키 발급에 실패했습니다'),
      { status: 400 }
    )
  }
  const billingKey = issueResult.data?.billingKey
  if (!billingKey) {
    throw Object.assign(new Error('빌링키를 받아오지 못했습니다'), { status: 502 })
  }

  // 빌링키 KMS 암호화
  const { encrypted, kmsKeyId } = await encryptString(billingKey)

  // 사용자 이메일 조회
  const [[userRow]] = await pool.execute(
    'SELECT email FROM users WHERE user_id = ? LIMIT 1',
    [userId]
  )
  const customerEmail = userRow?.email ?? ''

  const planInfo = PLANS[plan]
  const amount = planInfo.price
  const orderName = `온담 ${planInfo.name} 정기구독`
  const orderId = `ondam_sub_init_${userId.slice(0, 8)}_${Date.now()}`
  const billingCycleDate = todayKST()

  // 즉시 첫 결제 실행 (subscriptions 미존재 상태이므로 임시 ID 사용)
  // 첫 결제는 subscriptions INSERT 전이므로 직접 토스 API 호출
  const tossResult = await subscriptionTossClient.executeBilling({
    billingKey,
    customerKey: userId,
    amount,
    orderId,
    orderName,
    customerEmail,
  })

  if (!tossResult.ok) {
    throw Object.assign(
      new Error(tossResult.errorMessage ?? '첫 결제에 실패했습니다'),
      { status: 402 }
    )
  }

  const tossPaymentKey = tossResult.data?.paymentKey ?? null
  const subscriptionId = uuidv4()
  const nextBillingAt = addOneMonth(new Date())

  // 결제 성공 후 DB 작업(구독 생성 + 결제 로그 + payments) 은 하나의 트랜잭션으로
  // 묶는다 (G4) - 이전에는 4개의 독립 pool.execute라 중간 INSERT가 실패하면
  // "결제 없이 구독 active" 같은 정합성 파손이 가능했다. 트랜잭션 자체가 실패하면
  // 이미 승인된 토스 결제를 보상 환불한다.
  let subscription
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 결제 성공 시에만 subscriptions INSERT
    subscription = await subscriptionRepository.createSubscription({
      subscriptionId,
      userId,
      plan,
      billingKeyEncrypted: encrypted,
      billingKmsKeyId: kmsKeyId,
      priceKrw: amount,
      nextBillingAt,
      lastBilledAt: new Date(),
    }, conn)

    // 결제 로그 INSERT (success)
    const log = await subscriptionPaymentLogRepository.createLog({
      subscriptionId,
      userId,
      billingCycleDate,
      attemptNo: 1,
      attemptType: 'initial',
      tossOrderId: orderId,
      amountKrw: amount,
    }, conn)
    await subscriptionPaymentLogRepository.updateLogResult(log.log_id, {
      logStatus: 'success',
      tossPaymentKey,
      succeededAt: new Date(),
    }, conn)

    // payments INSERT
    const paymentId = uuidv4()
    await conn.execute(
      `INSERT INTO payments
         (payment_id, user_id, target_type, target_id, toss_payment_key,
          toss_order_id, amount_krw, status, paid_at)
       VALUES (?, ?, 'subscription', ?, ?, ?, ?, 'done', NOW())`,
      [paymentId, userId, subscriptionId, tossPaymentKey ?? paymentId, orderId, amount]
    )

    await conn.commit()
  } catch (dbErr) {
    await conn.rollback()

    // 보상 환불 - 성공 여부(ok)까지 확인해 사용자 메시지에 실제로 반영한다.
    // subscriptionTossClient의 함수들은 throw 없이 {ok,...}를 반환하므로(네트워크
    // 예외 등 진짜 throw만 catch 대상), ok===false인 실패도 놓치지 않고 로그로 남긴다.
    let refunded = false
    if (tossPaymentKey) {
      const cancelResult = await subscriptionTossClient
        .cancelPayment({ paymentKey: tossPaymentKey, cancelReason: 'DB 저장 실패로 인한 자동 환불' })
        .catch((e) => {
          console.error('[subscribe] 보상 환불 요청 실패 - 수동 처리 필요:', tossPaymentKey, e.message)
          return null
        })
      refunded = !!cancelResult?.ok
      if (cancelResult && !cancelResult.ok) {
        console.error(
          '[subscribe] 보상 환불 거부됨 - 수동 처리 필요:',
          tossPaymentKey,
          cancelResult.errorCode,
          cancelResult.errorMessage,
        )
      }
    }

    // [수정] dbErr에 이미 상태 코드가 있으면(예: createSubscription의 409 중복 구독)
    // 그대로 전파한다. 이전에는 무조건 500 "구독 등록 중 오류가 발생했습니다"로
    // 치환되어, 사용자가 "카드는 승인됐다 취소됐는데 원인 불명 500"을 보는 문제가
    // 있었다. 환불 여부도 메시지에 반영해 사용자가 결제 내역을 다시 확인하지
    // 않아도 되게 한다.
    if (dbErr.status) {
      const refundNote = refunded
        ? ' 결제는 자동으로 취소되었습니다.'
        : tossPaymentKey
          ? ' 결제 취소 처리 중 오류가 발생했습니다. 결제 내역을 확인해 주세요.'
          : ''
      throw Object.assign(new Error(`${dbErr.message}${refundNote}`), { status: dbErr.status })
    }
    throw Object.assign(new Error('구독 등록 중 오류가 발생했습니다'), { status: 500 })
  } finally {
    conn.release()
  }

  // 큐 등록(외부 자원)은 커밋 이후에 한다 (G4-4) - 트랜잭션 안에서 먼저 등록하면
  // 롤백돼도 스케줄은 남아 유령 데이터를 처리하게 된다. 실패해도 결제/구독 생성
  // 자체는 이미 성공했으므로 비차단으로 처리한다.
  await registerBillingScanDueScheduler().catch((err) => {
    console.warn('[subscriptionService] scan-due 스케줄러 등록 실패 (무시):', err.message)
  })

  return {
    subscriptionId: subscription.subscription_id,
    plan: subscription.plan,
    subStatus: 'active',
    priceKrw: subscription.price_krw,
    nextBillingAt: subscription.next_billing_at,
    lastBilledAt: subscription.last_billed_at,
  }
}

/**
 * 구독 취소
 * 1. 소유권 + 상태 확인
 * 2. 빌링키 복호화 → deleteBillingKey 호출 (실패해도 DB는 취소)
 * 3. sub_status='canceled', toss_billing_key_encrypted/billing_kms_key_id=NULL
 * 4. subscription_logs INSERT
 * 5. notifications INSERT
 */
export const cancelSubscription = async (userId, subscriptionId) => {
  // 초기 조회 - 소유권/상태 확인 + 외부 호출(빌링키 삭제)에 필요한 값 확보용이다.
  // 아직 명시적 트랜잭션이 아니라 FOR UPDATE 락은 이 SELECT 한 줄에서 즉시 풀린다
  // (그래서 여기서는 "락"이 아니라 단순 조회로 취급한다). 실제 상태 전이 보호는
  // 아래 두 번째 조회(트랜잭션 내부)가 담당한다.
  const subscription = await subscriptionRepository.findSubscriptionForBilling(subscriptionId)
  if (!subscription) {
    throw Object.assign(new Error('구독 정보를 찾을 수 없습니다'), { status: 404 })
  }
  if (subscription.user_id !== userId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  if (subscription.sub_status === 'canceled') {
    throw Object.assign(new Error('이미 취소된 구독입니다'), { status: 400 })
  }

  // 빌링키 복호화 → 토스 측 빌링키 삭제 시도 (외부 호출 - 트랜잭션/락 밖에서 수행. G4-4)
  if (subscription.toss_billing_key_encrypted) {
    try {
      const billingKey = await decryptString(
        subscription.toss_billing_key_encrypted,
        subscription.billing_kms_key_id
      )
      const deleteResult = await subscriptionTossClient.deleteBillingKey({ billingKey })
      if (!deleteResult.ok) {
        console.warn(
          `[subscriptionService] 빌링키 삭제 실패 (무시하고 DB 취소 진행): ${deleteResult.errorCode} - ${deleteResult.errorMessage}`
        )
      }
    } catch (err) {
      console.warn('[subscriptionService] 빌링키 복호화/삭제 실패 (무시):', err.message)
    }
  }

  // DB 상태 변경 + 로그 + 알림 - 단일 트랜잭션으로 원자 처리.
  // [G4-3 수정] 위 외부 호출을 기다리는 동안 자동결제(billingWorker) 등 다른 경로가
  // 구독 상태를 바꿨을 수 있으므로, 실제로 상태를 바꾸기 직전 FOR UPDATE로 다시
  // 잠그고 재확인한다 (conn을 실제로 넘겨 락이 트랜잭션 동안 유지되게 한다).
  let updated
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const locked = await subscriptionRepository.findSubscriptionForBilling(subscriptionId, conn)
    if (!locked) {
      throw Object.assign(new Error('구독 정보를 찾을 수 없습니다'), { status: 404 })
    }
    if (locked.sub_status === 'canceled') {
      // 외부 호출 대기 중 이미 다른 요청으로 취소된 경우 - 멱등 처리
      await conn.commit()
      updated = await subscriptionRepository.findSubscriptionById(subscriptionId)
      return updated
    }

    await subscriptionRepository.updateSubscriptionStatus(subscriptionId, {
      subStatus: 'canceled',
      prevStatus: locked.sub_status,
      changedBy: userId,
      changedByType: 'user',
      reason: '사용자 취소',
      conn,
    })

    updated = await subscriptionRepository.cancelSubscription(subscriptionId, {
      cancelReason: '사용자 취소',
      conn,
    })

    const notificationId = uuidv4()
    await conn.execute(
      `INSERT INTO notifications
         (notification_id, user_id, notification_type, target_type, target_id, title, message, created_at)
       VALUES (?, ?, 'subscription_canceled', 'subscription', ?, '구독 취소 완료', ?, NOW())`,
      [
        notificationId,
        userId,
        subscriptionId,
        `${PLANS[subscription.plan]?.name ?? subscription.plan} 구독이 취소되었습니다.`,
      ],
    )

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  return updated
}

/**
 * 결제 수동 재시도 (past_due, suspended 상태에서 사용자가 직접 재시도)
 */
export const retryPayment = async (userId, subscriptionId) => {
  const billingCycleDate = todayKST()

  // [G4-3 수정] 상태 확인(과 소유권 확인) + 당일 중복 결제 체크(멱등성 판정)를
  // 하나의 트랜잭션/락 구간에서 수행한다. 이전에는 findSubscriptionForBilling을
  // conn 없이 호출해 락이 즉시 풀렸고, 그 직후(락 없는 상태)에서 findTodayLog를
  // 별도로 확인해 "상태확인 → 멱등성 판정" 구간이 실제로는 보호되지 않았다
  // (billingWorker.handleExecuteBilling과 동일한 사고 패턴 - 이제 그와 동일하게
  // 맞춘다). 빌링키 복호화·토스 API 호출 같은 외부 작업은 이 락 밖에서 수행한다(G4-4).
  //
  // [CRITICAL #2 수정] 멱등성 판정만으로는 부족하다 - attempt_no 채번 + pending
  // 로그 INSERT(reserveBillingAttempt)까지 같은 락 구간 안에서 끝내야 한다.
  // 그러지 않으면 "재시도" 버튼 더블클릭 시 두 요청이 모두 findTodayLog 통과 →
  // 락 해제 → 각자 attempt_no를 채번해 실결제 2건이 될 수 있다. 이제 pending 예약이
  // 커밋된 뒤에만 락을 놓는다.
  const conn = await pool.getConnection()
  let subscription
  let reservation
  let amount
  try {
    await conn.beginTransaction()

    subscription = await subscriptionRepository.findSubscriptionForBilling(subscriptionId, conn)
    if (!subscription) {
      throw Object.assign(new Error('구독 정보를 찾을 수 없습니다'), { status: 404 })
    }
    if (subscription.user_id !== userId) {
      throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
    }
    if (!['past_due', 'suspended'].includes(subscription.sub_status)) {
      throw Object.assign(
        new Error('결제 재시도는 연체 또는 정지 상태에서만 가능합니다'),
        { status: 400 }
      )
    }
    if (!subscription.toss_billing_key_encrypted) {
      throw Object.assign(new Error('빌링키가 없어 결제를 진행할 수 없습니다'), { status: 400 })
    }

    // 당일 이미 성공/처리중인 로그가 있으면 재시도 차단(reserveBillingAttempt가
    // null 반환) - 03:00 크론 자동결제와 사용자의 수동 재시도가 겹치면 같은 날
    // 2건 결제가 될 수 있다. 위 상태 확인과 같은 락 구간에서 예약까지 끝내므로
    // 이제 실제로 직렬화된다.
    const planInfo = PLANS[subscription.plan]
    amount = planInfo?.price ?? subscription.price_krw
    reservation = await reserveBillingAttempt({
      subscriptionId,
      userId,
      billingCycleDate,
      attemptType: 'retry',
      amount,
      conn,
    })

    await conn.commit()
  } catch (err) {
    await conn.rollback().catch(() => {})
    throw err
  } finally {
    conn.release()
  }

  if (!reservation) {
    throw Object.assign(
      new Error('오늘 이미 결제가 처리되었거나 진행 중입니다. 잠시 후 다시 시도해 주세요'),
      { status: 409 }
    )
  }

  // 빌링키 복호화 (락 밖)
  const billingKey = await decryptString(
    subscription.toss_billing_key_encrypted,
    subscription.billing_kms_key_id
  )

  // 사용자 이메일 조회
  const [[userRow]] = await pool.execute(
    'SELECT email FROM users WHERE user_id = ? LIMIT 1',
    [userId]
  )
  const customerEmail = userRow?.email ?? ''

  const planInfo = PLANS[subscription.plan]
  const orderName = `온담 ${planInfo?.name ?? subscription.plan} 정기구독`

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
  })

  if (!result.success) {
    throw Object.assign(
      new Error(result.failReason ?? '결제 재시도에 실패했습니다'),
      { status: 402 }
    )
  }

  // 성공 알림 - notification_type ENUM에 'payment_success'는 없다(정답은 'payment_done').
  // 이 오타로 인해 결제 성공 이후 INSERT가 던지는 예외가 그대로 500으로 응답되어
  // "사용자는 결제 실패로 인지 → 재시도 → 이중결제" 위험이 있었다. ENUM 값을
  // 고치는 것과 별개로, 알림 INSERT 실패가 이미 성공한 결제 응답을 뒤집지 않도록
  // 비차단으로 처리한다 (G6) - 알림은 실패해도 로깅만 하고 결제 결과는 성공 응답.
  try {
    const notificationId = uuidv4()
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
  } catch (notifyErr) {
    console.error('[subscriptionService] retryPayment 알림 INSERT 실패 (결제는 성공 처리):', notifyErr.message)
  }

  const updated = await subscriptionRepository.findSubscriptionById(subscriptionId)
  return {
    subscriptionId: updated.subscription_id,
    plan: updated.plan,
    subStatus: updated.sub_status,
    nextBillingAt: updated.next_billing_at,
    lastBilledAt: updated.last_billed_at,
  }
}

/**
 * 구독 결제 로그 조회 (소유권 검증 포함)
 */
export const getPaymentLogs = async (userId, subscriptionId, { page = 1, limit = 20 } = {}) => {
  const subscription = await subscriptionRepository.findSubscriptionById(subscriptionId)
  if (!subscription) {
    throw Object.assign(new Error('구독 정보를 찾을 수 없습니다'), { status: 404 })
  }
  if (subscription.user_id !== userId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }

  const safeLimit = Math.min(Number(limit), 100)
  const offset = (Number(page) - 1) * safeLimit

  const { logs, total } = await subscriptionPaymentLogRepository.findLogsBySubscriptionId(
    subscriptionId,
    { limit: safeLimit, offset }
  )

  return {
    logs,
    meta: {
      total,
      page: Number(page),
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
  }
}
