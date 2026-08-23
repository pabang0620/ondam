import { v4 as uuidv4 } from 'uuid'
import { encryptString, decryptString } from '../../utils/kms.js'
import * as subscriptionRepository from './subscriptionRepository.js'
import * as subscriptionPaymentLogRepository from './subscriptionPaymentLogRepository.js'
import * as subscriptionTossClient from './subscriptionTossClient.js'
import {
  runBilling,
  reserveBillingAttempt,
  reserveInitialBillingAttempt,
  resolveBillingOutcome,
  categorizeFailCode,
  addOneMonth,
  todayKST,
  isPaymentAlreadyRecorded,
} from './subscriptionBillingService.js'
import { registerBillingScanDueScheduler } from '../../queues/billingQueue.js'
import pool from '../../config/db.js'
import { pick, pickAll } from '../../utils/dto.js'

// ─── 응답 화이트리스트 (결함2 수정 - 민감 필드 노출 방지) ───────────────────────
// payment 도메인(paymentService.js PAYMENT_PUBLIC_FIELDS)과 동일한 패턴을 그대로
// 따른다 - subscription_payment_logs 행을 가공 없이 그대로 응답에 흘려보내면
// toss_payment_key(토스 결제 키)와 내부 식별자 user_id가 새어나간다(G11 위반).
// SELECT 자체는 건드리지 않는다 - repository는 내부 로직(재시도 판정 등)에
// toss_payment_key가 필요해 계속 조회한다. toss_payment_key는 절대 이 목록에
// 넣지 않는다.
const SUBSCRIPTION_PAYMENT_LOG_PUBLIC_FIELDS = [
  'log_id', 'subscription_id', 'billing_cycle_date', 'attempt_no', 'attempt_type',
  'toss_order_id', 'amount_krw', 'log_status', 'attempted_at', 'succeeded_at',
  'failed_at', 'fail_code', 'fail_category', 'fail_reason', 'next_retry_at', 'created_at',
]
const toPaymentLogDtoList = (logs) => pickAll(logs, SUBSCRIPTION_PAYMENT_LOG_PUBLIC_FIELDS)

// [G11 - 다른 응답 함께 점검] getSubscriptions(목록 조회)가 findSubscriptionsByUserId
// 행을 `{ ...row, subStatus }`로 그대로 스프레드해 응답에 흘려보내고 있었다 - 현재
// SELECT 목록에는 toss_billing_key_encrypted/billing_kms_key_id가 없어 당장 그 자체가
// 새지는 않지만, user_id(내부 식별자)는 스프레드로 그대로 나가고 있었고 앞으로 테이블에
// 민감 컬럼이 추가돼도(dto.js pick 유틸 문서의 경고와 동일한 이유) 자동으로 새어나가는
// 구조였다. payment 도메인과 동일하게 화이트리스트로 명시한다 - 프론트가 쓰는 필드
// (plan/price_krw/subStatus/next_billing_at 등, SubscriptionStatusCard.jsx 실측)는 모두 유지.
const SUBSCRIPTION_PUBLIC_FIELDS = [
  'subscription_id', 'plan', 'sub_status', 'subStatus', 'price_krw',
  'next_billing_at', 'last_billed_at', 'canceled_at', 'cancel_reason',
  'created_at', 'updated_at',
]
const toSubscriptionDtoList = (rows) => pickAll(rows, SUBSCRIPTION_PUBLIC_FIELDS)

/**
 * 구독 플랜 상수
 *
 * [DEV-17, 2026-08-21 오너 확정] 유언장 보관 구독(will_premium, 월 1,900원)은
 * 폐지 - 보관비를 단건 가격에 내재화하기로 했다.
 *
 * [DEV-32, 2026-08-22 오너 확정] `all`(9,900원, 전체 이용권) 플랜도 폐지한다.
 * 어느 기획 문서에도 근거가 없는 유령 플랜이었다. 펫 아카이브는 티어를 나누지
 * 않고 `pet_archive` 4,900원 단일가로 확정한다(영상 편지도 베이직 단일가로
 * 동일 원칙 적용, 데이터 없이 티어를 나누지 않는다는 일관성).
 *
 * 위 두 플랜 모두 여기서 제거하면 getPlans() 목록·subscribe()의
 * `if (!PLANS[plan])` 체크·subscriptionRoutes.js의 zod enum에서 신규 가입이
 * 막힌다. 이미 all/will_premium으로 구독 중인 기존 행은 삭제·강제취소하지
 * 않았으므로, 아래처럼 PLANS에 없는 plan 값을 조회할 수 있는 모든 지점
 * (cancelSubscription/retryPayment/billingWorker)은 이미
 * `PLANS[plan] ?? 대체값` 폴백을 갖고 있어 죽지 않는다.
 */
export const PLANS = {
  pet_archive: { price: 4900, name: '반려동물 아카이브' },
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
  const withSubStatus = rows.map((row) => ({
    ...row,
    subStatus: row.sub_status,
  }))
  // [결함2 수정] user_id(내부 식별자) 등 비공개 필드를 화이트리스트로 제외
  return toSubscriptionDtoList(withSubStatus)
}

/**
 * 구독 시작
 * 1. 중복 활성 구독 체크
 * 2. [B-1] 최초 결제 시도 예약 (pending 선기록) - 정기결제 reserveBillingAttempt와
 *    동일 구조. 재시도 시 같은 orderId를 재사용해 이중청구를 막는다.
 * 3. authKey → billingKey 교환 (토스)
 * 4. 빌링키 KMS 암호화
 * 5. 즉시 첫 결제 실행 (attempt_type='initial')
 * 6. 결제 성공 시에만 subscriptions INSERT
 * 7. 결제 실패 시 402 throw / 불확정 시 indeterminate 반환 (컨트롤러가 202로 응답)
 * 8. scan-due repeat job 등록 (최초 1회)
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

  const planInfo = PLANS[plan]
  const amount = planInfo.price
  const orderName = `온담 ${planInfo.name} 정기구독`
  const billingCycleDate = todayKST()

  // [B-1 수정] 정기결제(reserveBillingAttempt)와 동일하게 pending 로그를 먼저
  // 예약한다. 구독 레코드가 아직 없으므로 reserveInitialBillingAttempt가
  // user_id+billing_cycle_date+amount_krw 기준으로 오늘자 시도를 식별/재사용한다
  // (근거는 subscriptionBillingService.js의 reserveInitialBillingAttempt 주석,
  // 완료 보고 참조). 이후 확보한 subscriptionId/orderId를 끝까지 그대로 써야
  // 재시도 시 동일 orderId 재사용(reclaim)이 성립해 이중청구를 막는다.
  const reservation = await reserveInitialBillingAttempt({ userId, plan, amount, billingCycleDate })

  // [#3 수정] null이면 신선한(fresh) pending이 다른 요청으로 지금 진행 중이라는
  // 뜻이다(reserveInitialBillingAttempt 참조) - 여기서 그대로 재선점을 시도하면
  // 두 탭이 같은 orderId로 동시에 결제를 진행하다 정상 결제가 잘못 환불되는
  // 사고로 이어진다(완료 보고 3번 참조). 재시도(reserveBillingAttempt가 null일
  // 때의 retryPayment/billingWorker 처리와 동일하게) 409로 안내한다.
  if (!reservation) {
    throw Object.assign(
      new Error('이미 진행 중인 결제가 있습니다. 잠시 후 다시 시도해 주세요'),
      { status: 409 }
    )
  }

  if (reservation.alreadySucceeded) {
    // 동시 요청 경합(TOCTOU) - 위 findBlockingSubscription 통과 직후 다른 요청이
    // 이미 전체 흐름(결제+구독 생성)을 끝낸 경우. 카드 재청구 없이 그 결과를
    // 그대로 반환한다 (이중청구 방지 최우선).
    const finishedSub = await subscriptionRepository.findSubscriptionById(reservation.subscriptionId)
    if (finishedSub) {
      return {
        subscriptionId: finishedSub.subscription_id,
        plan: finishedSub.plan,
        subStatus: finishedSub.sub_status,
        priceKrw: finishedSub.price_krw,
        nextBillingAt: finishedSub.next_billing_at,
        lastBilledAt: finishedSub.last_billed_at,
      }
    }
    // 로그는 success인데 구독 행이 아직 안 보이는 극히 드문 커밋 지연 - 재청구는
    // 위험하므로 사용자에게 재확인을 요청한다.
    throw Object.assign(
      new Error('이전 결제 처리 결과를 확인하는 중입니다. 잠시 후 다시 확인해 주세요'),
      { status: 409 }
    )
  }

  const subscriptionId = reservation.subscriptionId
  const orderId = reservation.orderId

  // authKey → billingKey 교환 (authKey는 1회용이라 매 시도마다 새로 발급받는다 -
  // 이 교환 자체는 과금이 아니므로 재시도해도 안전하다)
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

  let tossPaymentKey = null
  let shouldCharge = true

  if (reservation.isReclaim) {
    // 방치된(stale) 이전 시도 재선점 - 같은 orderId로 실제 결제가 이미 이뤄졌는지
    // 먼저 조회한다 (runBilling의 isReclaim 분기와 동일 원칙 - CRITICAL #1).
    const lookup = await subscriptionTossClient.getPaymentByOrderId({ orderId })
    if (lookup.ok && lookup.data?.status === 'DONE') {
      tossPaymentKey = lookup.data.paymentKey
      shouldCharge = false
    }
    // 미결제로 확인됐거나 조회 자체가 실패한 경우 - 그대로 재청구한다. 실제로
    // 결제가 있었다면 토스가 동일 orderId를 거부하므로, 이 재청구 자체가 이중청구를
    // 막는 최후 방어선이 된다.
  }

  if (shouldCharge) {
    const tossResult = await subscriptionTossClient.executeBilling({
      billingKey,
      customerKey: userId,
      amount,
      orderId,
      orderName,
      customerEmail,
    })

    // [B-1] 정기결제와 동일한 판정 기준(resolveBillingOutcome)을 공유해 "이미
    // 처리됨"·"불확정" 코드 목록이 두 경로에서 각자 관리되며 drift하는 것을 막는다.
    const decision = await resolveBillingOutcome({ tossResult, orderId, subscriptionId })

    if (decision.outcome === 'indeterminate') {
      // [C-4] 실패로 확정하지 않고 로그를 pending인 채로 둔다 - 다음 재시도(재호출)가
      // reserveInitialBillingAttempt를 통해 같은 orderId를 재선점한다. 컨트롤러가
      // 이 결과를 402가 아닌 202로 응답해야 한다 (완료 보고 4번 참조).
      return {
        subscriptionId,
        plan,
        indeterminate: true,
        message: decision.failReason ?? '결제 결과를 확인하는 중입니다. 잠시 후 다시 확인해 주세요',
      }
    }

    if (decision.outcome === 'failed') {
      const failCode = decision.tossResult.errorCode
      const failReason = decision.tossResult.errorMessage ?? '첫 결제에 실패했습니다'
      // 확정 실패이므로 로그를 failed로 닫는다 - 다음 시도는
      // reserveInitialBillingAttempt가 새 attempt_no + 새 orderId를 발급한다.
      await subscriptionPaymentLogRepository.updateLogResult(reservation.log.log_id, {
        logStatus: 'failed',
        failCode,
        failCategory: categorizeFailCode(failCode),
        failReason,
        failedAt: new Date(),
      })
      throw Object.assign(new Error(failReason), { status: 402 })
    }

    tossPaymentKey = decision.tossData?.paymentKey ?? null
  }

  const nextBillingAt = addOneMonth(new Date())

  // 결제 성공 후 DB 작업(구독 생성 + 결제 로그 업데이트 + payments)은 하나의
  // 트랜잭션으로 묶는다 (G4) - 이전에는 4개의 독립 pool.execute라 중간 INSERT가
  // 실패하면 "결제 없이 구독 active" 같은 정합성 파손이 가능했다. 트랜잭션 자체가
  // 실패하면 이미 승인된 토스 결제를 보상 환불한다 - 단, payments.toss_payment_key
  // UNIQUE 충돌은 예외다 (C-3, 완료 보고 참조).
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

    // 결제 로그 업데이트 (pending → success) - reserveInitialBillingAttempt가
    // 이미 pending으로 선기록해뒀으므로 여기서는 INSERT가 아니라 UPDATE한다.
    await subscriptionPaymentLogRepository.updateLogResult(reservation.log.log_id, {
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

    // [C-3/#6 수정] payments.toss_payment_key UNIQUE 충돌은 "이 결제가 이미 다른
    // 시도(동시 실행·재시도 경합)로 정상 기록됐다"는 신호일 가능성이 높다 - 환불
    // 대신 이미 만들어진 구독을 재조회해 그대로 반환한다. 어느 테이블 충돌인지는
    // payments를 직접 조회해 판별한다(isPaymentAlreadyRecorded) - 에러 메시지의
    // 인덱스명 문자열 매칭은 payments.toss_payment_key와
    // subscription_payment_logs.toss_payment_key가 같은 이름의 UNIQUE 인덱스를
    // 가져 신뢰할 수 없다(#6, subscriptionBillingService.js 참조).
    const isPaymentKeyDuplicate =
      dbErr.code === 'ER_DUP_ENTRY' && await isPaymentAlreadyRecorded(tossPaymentKey)
    if (isPaymentKeyDuplicate) {
      console.warn(
        '[subscribe] payments.toss_payment_key 이미 존재 - 다른 시도가 정상 기록한 결제로 판단, 보상 환불 생략:',
        subscriptionId, tossPaymentKey, dbErr.message,
      )
      const finishedSub = await subscriptionRepository.findSubscriptionById(subscriptionId)
      if (finishedSub) {
        return {
          subscriptionId: finishedSub.subscription_id,
          plan: finishedSub.plan,
          subStatus: finishedSub.sub_status,
          priceKrw: finishedSub.price_krw,
          nextBillingAt: finishedSub.next_billing_at,
          lastBilledAt: finishedSub.last_billed_at,
        }
      }
      throw Object.assign(
        new Error('이전 결제 처리 결과를 확인하는 중입니다. 잠시 후 다시 확인해 주세요'),
        { status: 409 }
      )
    }

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
      // [결함2 수정 - G11] billing_kms_key_id 등 raw 행을 그대로 응답하지 않는다
      return pick(updated, SUBSCRIPTION_PUBLIC_FIELDS)
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

  // [결함2 수정 - G11] billing_kms_key_id 등 raw 행을 그대로 응답하지 않는다
  return pick(updated, SUBSCRIPTION_PUBLIC_FIELDS)
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
    // [C-2/#5 수정] 다음 청구일 드리프트 방지 - subscription.next_billing_at은
    // 실패 재시도 중 _finalizeFailure가 재시도 스케줄(nextRetryAt)로 덮어써
    // "원래 예정일"을 더 이상 신뢰할 수 없다. last_billed_at은 성공 시에만
    // 갱신되므로 재시도 동안 불변이다 - 여기서 +1개월 해 이번 사이클이 원래
    // 청구됐어야 할 날짜를 재구성한다(완료 보고 5번 참조).
    currentNextBillingAt: addOneMonth(
      subscription.last_billed_at ?? subscription.next_billing_at ?? new Date()
    ),
  })

  if (!result.success) {
    if (result.indeterminate) {
      // [C-4 수정] 이중청구는 서버가 막지만(runBilling의 pending 유지), 사용자에게
      // "실패"로 보이면 불필요한 재시도를 유발한다. 402(실패)가 아니라 "확인 중"
      // 취지로 반환하고, 컨트롤러가 202로 응답한다.
      return {
        subscriptionId,
        subStatus: subscription.sub_status,
        indeterminate: true,
        message: result.failReason ?? '결제 결과를 확인하는 중입니다. 잠시 후 다시 확인해 주세요',
      }
    }
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
    // [결함2 수정] toss_payment_key(토스 결제 키)/user_id(내부 식별자) 제외
    logs: toPaymentLogDtoList(logs),
    meta: {
      total,
      page: Number(page),
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
  }
}
