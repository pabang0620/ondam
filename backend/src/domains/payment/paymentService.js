import { v4 as uuidv4 } from 'uuid'
import * as paymentRepository from './paymentRepository.js'
import * as photoRepository from '../photo/photoRepository.js'
import * as willRepository from '../will/willRepository.js'
import * as subscriptionRepository from '../subscription/subscriptionRepository.js'
import { PLANS } from '../subscription/subscriptionService.js'
import pool from '../../config/db.js'

const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm'
const TOSS_CANCEL_URL = (tossPaymentKey) =>
  `https://api.tosspayments.com/v1/payments/${tossPaymentKey}/cancel`
const TOSS_PAYMENT_LOOKUP_URL = (tossPaymentKey) =>
  `https://api.tosspayments.com/v1/payments/${tossPaymentKey}`

// [HIGH #4] 토스 confirm이 에러를 반환했을 때, 그 에러가 "이미 처리된 결제"류인지
// 판별하는 코드 목록. 45초 재선점(CLAIM_STALE_MS) 이후 confirm이 중복 호출되면
// 토스가 이 계열 에러를 돌려줄 수 있는데, 이를 무조건 실패로 확정하면 이미 승인된
// 결제를 failed로 뒤집는 사고가 난다.
const ALREADY_PROCESSED_ERROR_CODES = new Set([
  'ALREADY_PROCESSED_PAYMENT',
  'PROVIDER_INCONSISTENCY',
])

// 토스 confirm 호출에 반드시 부여하는 타임아웃 (G4-4) - 응답이 지연돼도 커넥션을
// 무한정 물고 있지 않게 한다. 이 값은 락을 쥐지 않은 구간에서만 쓰이므로 커넥션
// 풀 고갈과는 무관하다.
//
// [LOW#3] 10초는 카드 승인 호출로는 짧다 (subscriptionTossClient.js와 동일 사유).
// 30초로 늘리고 환경변수로 조정 가능하게 한다. NaN 방어 포함.
const TOSS_CONFIRM_TIMEOUT_MS = (() => {
  const raw = Number(process.env.TOSS_CONFIRM_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : 30_000
})()

// 선점(claim) 후 이 시간(ms)이 지나도 확정(트랜잭션 #2)되지 않으면 서버 크래시 등으로
// 방치된 것으로 보고 재선점을 허용한다. TOSS_CONFIRM_TIMEOUT_MS보다 충분히 길게 잡아
// 정상적으로 처리 중인 요청을 오탐(false positive)하지 않게 한다.
// [LOW#3] TOSS_CONFIRM_TIMEOUT_MS 기본값이 10초 -> 30초로 늘어나면서 기존 45초
// 마진(35초)이 15초로 좁아진다. 정상 처리 중인 요청을 방치로 오판하지 않도록
// 60초로 함께 늘려 30초 이상의 여유를 유지한다.
const CLAIM_STALE_MS = 60_000

/**
 * 토스페이먼츠 Basic 인증 헤더 생성
 * secretKey 뒤에 ':' 붙여 base64 인코딩
 */
const getTossAuthHeader = () => {
  const secretKey = process.env.TOSS_SECRET_KEY
  if (!secretKey) throw Object.assign(new Error('TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다'), { status: 500 })
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`
}

/**
 * [HIGH #4] paymentKey로 토스 실제 결제 상태를 조회한다 (GET /v1/payments/{paymentKey}).
 * confirm 에러가 "이미 처리됨" 계열일 때, 실패로 확정하기 전에 진짜 상태를 확인하는 용도.
 * 조회 자체가 실패(네트워크/타임아웃 등)하면 null을 반환해 호출자가 보수적으로 처리하게 한다.
 */
const _lookupTossPayment = async (tossPaymentKey) => {
  try {
    const res = await fetch(TOSS_PAYMENT_LOOKUP_URL(tossPaymentKey), {
      method: 'GET',
      headers: { Authorization: getTossAuthHeader() },
      signal: AbortSignal.timeout(TOSS_CONFIRM_TIMEOUT_MS),
    })
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.error('[paymentService] _lookupTossPayment 실패:', tossPaymentKey, err.message)
    return null
  }
}

const VALID_TARGET_TYPES = ['photo_order', 'will_order', 'subscription']

/**
 * 결제 대상별 서버 정본 가격 조회 + 소유권 검증 (G3-1, G3-2)
 * 클라이언트가 보낸 금액은 애초에 받지 않는다 - 서버가 조회한 값만 결제 금액의 정본으로 사용한다.
 * target이 존재하지 않으면 404, 호출자 소유가 아니면 403으로 거부한다 (IDOR 방지).
 */
const _resolveServerPrice = async (targetType, targetId, userId) => {
  if (targetType === 'photo_order') {
    const order = await photoRepository.findOrderById(targetId)
    if (!order) throw Object.assign(new Error('주문을 찾을 수 없습니다'), { status: 404 })
    if (order.user_id !== userId) throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
    // photo_orders.status ENUM: pending_payment/paid/processing/completed/failed/refunded.
    // 결제(prepare)는 아직 한 번도 결제되지 않은 pending_payment 상태에서만 허용한다 -
    // 그러지 않으면 이미 paid로 넘어간 주문에 새 payment를 만들어 재청구할 수 있다 (G3).
    if (order.status !== 'pending_payment') {
      throw Object.assign(
        new Error(`이미 처리된 주문입니다 (현재 상태: ${order.status})`),
        { status: 409 },
      )
    }
    return Number(order.price_krw)
  }
  if (targetType === 'will_order') {
    const will = await willRepository.findWillById(targetId)
    if (!will) throw Object.assign(new Error('유언장을 찾을 수 없습니다'), { status: 404 })
    if (will.user_id !== userId) throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
    // wills.status ENUM: draft/paid/active/released/revoked. 결제 전 초안(draft)
    // 상태에서만 결제를 허용한다 - 이미 paid로 넘어간 유언장에 재청구되는 것을 막는다.
    if (will.status !== 'draft') {
      throw Object.assign(
        new Error(`이미 처리된 유언장입니다 (현재 상태: ${will.status})`),
        { status: 409 },
      )
    }
    return Number(will.price_krw)
  }
  if (targetType === 'subscription') {
    const subscription = await subscriptionRepository.findSubscriptionById(targetId)
    if (!subscription) throw Object.assign(new Error('구독 정보를 찾을 수 없습니다'), { status: 404 })
    if (subscription.user_id !== userId) throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
    // subscriptions.sub_status ENUM: active/past_due/suspended/canceled. 구독 결제는
    // subscribe()/retryPayment()의 빌링키 경로가 정본이라 여기로는 실사용되지 않지만,
    // 스키마상 남아있는 대상이므로 최소한 취소된 구독에는 결제를 허용하지 않는다.
    if (subscription.sub_status === 'canceled') {
      throw Object.assign(new Error('취소된 구독은 결제할 수 없습니다'), { status: 409 })
    }
    const planInfo = PLANS[subscription.plan]
    return planInfo ? planInfo.price : Number(subscription.price_krw)
  }
  throw Object.assign(new Error('유효하지 않은 결제 대상 유형입니다'), { status: 400 })
}

/**
 * 결제 준비
 * - targetType은 유효성만 검증하고, 결제 금액은 클라이언트 입력을 받지 않는다.
 *   targetId가 가리키는 실제 리소스(photo_orders/wills/subscriptions)의 가격을 서버가 직접 조회해 사용한다.
 * - paymentId(UUID) + tossOrderId 생성 후 payments 레코드 INSERT
 */
export const preparePayment = async (userId, { targetType, targetId }) => {
  if (!VALID_TARGET_TYPES.includes(targetType)) {
    throw Object.assign(new Error('유효하지 않은 결제 대상 유형입니다'), { status: 400 })
  }

  const amountKrw = await _resolveServerPrice(targetType, targetId, userId)

  const paymentId = uuidv4()
  const tossOrderId = `ondam_${Date.now()}_${paymentId.slice(0, 8)}`

  await paymentRepository.createPayment({
    paymentId,
    userId,
    targetType,
    targetId,
    tossOrderId,
    amountKrw,
  })

  return { paymentId, tossOrderId, amountKrw }
}

/**
 * 결제 승인 (토스페이먼츠 confirm API 호출)
 * - 멱등성: paymentKey가 이미 done이면 기존 payment 반환
 * - 경쟁 조건 방지: 동일 orderId로 confirm이 동시에 두 번 들어오면 둘 다 status='ready'를 보고
 *   통과해 각자 토스 승인을 호출할 수 있다. FOR UPDATE 비관적 락으로 직렬화한다.
 *
 * [G4-4 수정] 이전에는 FOR UPDATE 락 + 트랜잭션을 쥔 채로 토스 confirm fetch를 직접
 * 호출했다. connectionLimit=10인 풀에서 토스 응답이 지연되면 그 시간만큼 커넥션을
 * 점유해 결제와 무관한 다른 API까지 멈출 수 있었고, fetch에 타임아웃도 없었다.
 * 이제 락 구간과 외부 호출 구간을 분리한다:
 *   1) 짧은 트랜잭션 #1 - FOR UPDATE로 상태 확인 후, payments.status ENUM에
 *      'processing' 같은 중간 상태가 없으므로 toss_payment_key 컬럼을 선점(claim)
 *      마커로 활용해 "확정 처리 중"을 표시하고 즉시 commit(락 해제).
 *      (createPayment 시점엔 toss_payment_key=payment_id 임시값이므로, 이 값이
 *       아니게 바뀌어 있으면 이미 누군가 선점한 것으로 판단한다)
 *   2) 락 밖에서 토스 confirm 호출 (AbortSignal.timeout으로 타임아웃 부여)
 *   3) 짧은 트랜잭션 #2 - 결과(done/failed)를 반영
 * 동일 orderId로 confirm이 거의 동시에 들어오면, 뒤에 온 요청은 트랜잭션 #1에서
 * "이미 선점됨"을 보고 409로 즉시 거부되어 CLAIM_STALE_MS(60초) 이내에는 토스를 두 번
 * 호출하지 않는다. 하지만 선점만 되고 확정되지 않은 채 CLAIM_STALE_MS 이상 지난
 * 경우(서버 크래시, 또는 아래 CRITICAL #2의 네트워크/타임아웃 불확정 응답)는
 * 재선점을 허용해 결제가 영구히 막히지 않게 하는데, 이 경우는 토스 confirm이
 * 실제로 두 번 호출될 수 있다 - 토스가 "이미 처리됨" 에러를 돌려주면 실패로
 * 확정하지 않고 결제 조회 API로 실상태를 확인한 뒤 판정한다 (HIGH #4).
 *
 * [CRITICAL #2] 락 밖 토스 confirm 호출이 네트워크 오류/타임아웃으로 예외를 던지면
 * (2) 구간 catch에서 실패로 확정(status='failed')하지 않고 선점 상태를 그대로 둔 채
 * 502만 반환한다. 실패로 확정하면 toss_payment_key가 payment_id로 원복돼 선점
 * 마커가 사라지고, target 주문이 pending_payment로 남아 사용자가 재시도하면
 * preparePayment가 새 payment를 만들어 이중청구로 이어지기 때문이다. 대신 위
 * CLAIM_STALE_MS 재선점 경로를 타게 해 자가치유되도록 한다.
 */
export const confirmPayment = async (userId, { paymentKey, orderId, amount }) => {
  // 멱등성 빠른 경로 - paymentKey 재시도(첫 요청 타임아웃 후 재시도 등)를 락 없이 먼저 처리
  // [HIGH #5 수정] 소유권 검증 누락(IDOR) - paymentKey를 아는 임의 인증 사용자가 타인의
  // 결제 정보를 조회하고 _updateTargetStatus로 타인 주문을 paid로 뒤집을 수 있었다.
  // TX#1(:155-157 상당)과 동일하게 소유권을 검증한다.
  const existingByKey = await paymentRepository.findPaymentByTossKey(paymentKey)
  if (existingByKey && existingByKey.status === 'done') {
    if (existingByKey.user_id !== userId) {
      throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
    }
    await _updateTargetStatus(existingByKey.target_type, existingByKey.target_id)
    return { success: true, payment: existingByKey, idempotent: true }
  }

  // ── 짧은 트랜잭션 #1: 상태 확인 + 선점(claim), 즉시 commit ──
  const conn1 = await pool.getConnection()
  let claim
  try {
    await conn1.beginTransaction()

    // FOR UPDATE - 동일 orderId에 대한 동시 confirm 요청 직렬화 (경쟁 조건 방지)
    const payment = await paymentRepository.findPaymentByOrderIdForUpdate(conn1, orderId)
    if (!payment) {
      throw Object.assign(new Error('결제 정보를 찾을 수 없습니다'), { status: 404 })
    }
    if (payment.user_id !== userId) {
      throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
    }

    // 락 획득 후 재확인 - 락 대기 중 먼저 들어온 요청이 이미 완료 처리했을 수 있음 (멱등)
    // [HIGH #3 수정] 'ready' 뿐 아니라 'failed'도 재시도 가능한 상태로 취급한다.
    // updatePaymentFailed가 실패 확정 시 toss_payment_key를 payment_id로 원복하므로
    // 'failed' 건도 'ready'와 동일하게 선점→토스 재호출 경로를 탈 수 있다. 이걸 막으면
    // 실패한 결제가 영구 데드엔드(400 고정)가 되어 사용자가 다시 결제할 방법이 없다.
    if (payment.status === 'done') {
      await conn1.commit()
      claim = { kind: 'done', payment }
    } else if (payment.status !== 'ready' && payment.status !== 'failed') {
      throw Object.assign(
        new Error(`승인할 수 없는 결제 상태입니다 (현재: ${payment.status})`),
        { status: 400 },
      )
    } else if (Number(payment.amount_krw) !== Number(amount)) {
      await conn1.execute(
        `UPDATE payments SET status = 'failed', fail_reason = ?, updated_at = NOW()
         WHERE payment_id = ?`,
        [`금액 불일치: 요청=${amount}, 원본=${payment.amount_krw}`, payment.payment_id],
      )
      await conn1.commit()
      throw Object.assign(new Error('결제 금액이 일치하지 않습니다'), { status: 400 })
    } else {
      // status === 'ready' 또는 'failed' - 결제(재)시도 가능한 상태. 이미 선점(claim)됐는지 확인한다.
      const alreadyClaimed = payment.toss_payment_key !== payment.payment_id
      if (alreadyClaimed) {
        const claimedAgoMs = Date.now() - new Date(payment.updated_at).getTime()
        if (claimedAgoMs < CLAIM_STALE_MS) {
          throw Object.assign(
            new Error('결제가 이미 처리 중입니다. 잠시 후 다시 시도해 주세요'),
            { status: 409 },
          )
        }
        // CLAIM_STALE_MS 이상 지난 선점은 크래시로 방치된 것으로 보고 재선점을 허용한다.
      }

      if (process.env.PAYMENT_MOCK === 'true') {
        // PAYMENT_MOCK=true 환경에서는 토스 API 호출 생략하고 락을 쥔 채로 바로 완료
        // 처리한다(외부 호출이 없으므로 락을 오래 쥐는 문제가 없다).
        await conn1.execute(
          `UPDATE payments SET status = 'done', paid_at = NOW(), updated_at = NOW()
           WHERE payment_id = ?`,
          [payment.payment_id],
        )
        await _updateTargetStatus(payment.target_type, payment.target_id, conn1)
        await conn1.commit()
        const done = await paymentRepository.findPaymentById(payment.payment_id)
        claim = { kind: 'mock', payment: done }
      } else {
        // 실제 선점 - toss_payment_key를 임시값(payment_id)에서 실제 paymentKey로
        // 바꿔 "확정 처리 중" 상태를 표시하고 즉시 commit해 락을 해제한다.
        // [MEDIUM #6] toss_payment_key는 UNIQUE 컬럼이다. 실제 토스 키는 전역
        // 유일하지만, PAYMENT_MOCK이 아닌 경로로 mock 식별자(mock_${Date.now()} 등)를
        // paymentKey로 넘기는 테스트/개발 경로에서는 같은 밀리초 두 요청이 동일 키를
        // 만들어 충돌할 수 있다. raw 500 대신 의미 있는 409로 변환한다.
        try {
          await conn1.execute(
            `UPDATE payments SET toss_payment_key = ?, updated_at = NOW() WHERE payment_id = ?`,
            [paymentKey, payment.payment_id],
          )
        } catch (updateErr) {
          if (updateErr.code === 'ER_DUP_ENTRY') {
            throw Object.assign(
              new Error('이미 사용된 결제 키입니다. 다시 시도해 주세요'),
              { status: 409 },
            )
          }
          throw updateErr
        }
        await conn1.commit()
        claim = { kind: 'claimed', payment }
      }
    }
  } catch (err) {
    await conn1.rollback().catch(() => {})
    throw err
  } finally {
    conn1.release()
  }

  if (claim.kind === 'done') {
    await _updateTargetStatus(claim.payment.target_type, claim.payment.target_id)
    return { success: true, payment: claim.payment, idempotent: true }
  }
  if (claim.kind === 'mock') {
    return { success: true, payment: claim.payment, mock: true }
  }

  // ── 락 밖: 토스페이먼츠 승인 API 호출 (반드시 타임아웃 부여) ──
  const payment = claim.payment
  let tossResponse
  let tossOk
  try {
    const res = await fetch(TOSS_CONFIRM_URL, {
      method: 'POST',
      headers: {
        Authorization: getTossAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
      signal: AbortSignal.timeout(TOSS_CONFIRM_TIMEOUT_MS),
    })
    tossOk = res.ok
    tossResponse = await res.json()
  } catch (err) {
    // [CRITICAL #2 수정] 네트워크 오류/타임아웃 - 토스 승인이 실제로 이뤄졌는지
    // 알 수 없다(불확정). 이전에는 이 경로에서 updatePaymentFailed를 호출했는데,
    // 그 함수는 status='failed'로 확정하면서 toss_payment_key를 payment_id로
    // 원복해 선점(claim) 마커까지 지워버린다. 그러면 target 주문은 여전히
    // pending_payment로 남아있는 상태에서 payments.status만 failed가 되고,
    // 사용자가 재시도하면 preparePayment가 새 payment를 만들어 새 결제창을
    // 열어준다 - 토스는 이걸 완전히 다른 신규 주문으로 보고 실제로 승인됐을 수도
    // 있는 첫 번째 결제와 별개로 두 번째 청구를 한다(이중청구).
    //
    // 여기서는 실패로 확정하지 않고 선점(claim) 상태(payments.status='ready',
    // toss_payment_key=paymentKey)를 그대로 둔 채 502만 반환한다. 그러면
    // CLAIM_STALE_MS(60초) 후 같은 orderId/paymentKey로 재선점이 일어나
    // 토스 confirm이 다시 호출되고, 실제로 이미 승인됐던 경우 토스가
    // ALREADY_PROCESSED_PAYMENT류 에러를 반환해 위 _lookupTossPayment
    // 자가치유 경로가 진짜 상태를 조회해 done으로 확정한다. 실제로 승인되지
    // 않았던 경우는 재시도 confirm이 정상적으로 새로 승인을 받는다.
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError'
    console.error('[paymentService] confirmPayment 토스 호출 실패 - 선점 유지, failed 확정 안 함:', {
      orderId,
      paymentKey,
      timeout: isTimeout,
      error: err.message,
    })
    throw Object.assign(
      new Error('결제 승인 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요'),
      { status: 502 },
    )
  }

  if (!tossOk) {
    // [HIGH #4] 45초 재선점으로 confirm이 중복 호출된 경우, 토스는 "이미 처리됨"류
    // 에러를 반환할 수 있다. 이 계열 에러를 무조건 실패로 확정하면 이미 승인된
    // 결제를 failed로 뒤집게 되므로, 실패 확정 전에 실제 결제 상태를 조회해 판정한다.
    const errCode = tossResponse?.code
    const looksAlreadyProcessed =
      typeof errCode === 'string' && ALREADY_PROCESSED_ERROR_CODES.has(errCode)

    if (looksAlreadyProcessed) {
      const actual = await _lookupTossPayment(paymentKey)
      if (actual?.status === 'DONE') {
        tossResponse = actual
        tossOk = true
      }
    }

    if (!tossOk) {
      const failReason = tossResponse?.message ?? '토스 승인 실패'
      await paymentRepository
        .updatePaymentFailed(payment.payment_id, { failReason })
        .catch((e) => console.error('[paymentService] 실패 사유 기록 실패:', e.message))
      throw Object.assign(new Error(failReason), { status: 400 })
    }
  }

  // ── 짧은 트랜잭션 #2: 결과 반영 ──
  const conn2 = await pool.getConnection()
  try {
    await conn2.beginTransaction()

    const paidAt = tossResponse.approvedAt ? new Date(tossResponse.approvedAt) : new Date()
    await conn2.execute(
      `UPDATE payments
       SET status = 'done', toss_payment_key = ?, paid_at = ?, updated_at = NOW()
       WHERE payment_id = ?`,
      [paymentKey, paidAt, payment.payment_id],
    )
    await _updateTargetStatus(payment.target_type, payment.target_id, conn2)
    await conn2.commit()
  } catch (dbErr) {
    await conn2.rollback().catch(() => {})
    // 토스는 이미 승인됐으나 이후 DB 반영 실패 - 심각한 불일치이므로 상태를 임의로 바꾸지 않고
    // 상세 로그만 남긴 뒤 원본 에러를 그대로 던진다 (수동 확인 필요)
    console.error(
      '[paymentService] confirmPayment DB 반영 실패 - 토스 승인 완료 후 DB 미반영 (수동 확인 필요):',
      { paymentId: payment.payment_id, orderId, paymentKey, error: dbErr.message },
    )
    throw dbErr
  } finally {
    conn2.release()
  }

  const updatedPayment = await paymentRepository.findPaymentById(payment.payment_id)
  return { success: true, payment: updatedPayment }
}

/**
 * 결제 취소 (토스페이먼츠 cancel API 호출)
 */
export const cancelPayment = async (userId, paymentId, { cancelReason }) => {
  const payment = await paymentRepository.findPaymentById(paymentId)
  if (!payment) throw Object.assign(new Error('결제 정보를 찾을 수 없습니다'), { status: 404 })
  if (payment.user_id !== userId) throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  if (payment.status !== 'done') {
    throw Object.assign(new Error('완료된 결제만 취소할 수 있습니다'), { status: 400 })
  }

  // 토스페이먼츠 취소 API 호출
  let tossResponse
  try {
    const res = await fetch(TOSS_CANCEL_URL(payment.toss_payment_key), {
      method: 'POST',
      headers: {
        Authorization: getTossAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cancelReason: cancelReason ?? '사용자 취소' }),
    })
    tossResponse = await res.json()

    if (!res.ok) {
      throw Object.assign(new Error(tossResponse?.message ?? '취소 실패'), { status: 400 })
    }
  } catch (err) {
    if (err.status) throw err
    throw Object.assign(new Error('결제 취소 중 오류가 발생했습니다'), { status: 502 })
  }

  const updatedPayment = await paymentRepository.updatePaymentCanceled(paymentId, {
    cancelReason: cancelReason ?? '사용자 취소',
  })

  // target 상태 환원 - 실패해도 환불 자체는 이미 완료된 상태이므로 응답 흐름은 유지하되,
  // 주문이 'paid'로 남는 불일치가 조용히 묻히지 않도록 명확히 로그로 남긴다 (수동 확인 필요)
  await _revertTargetStatus(payment.target_type, payment.target_id).catch((e) =>
    console.error(
      '[paymentService] cancelPayment target 상태 환원 실패 - 수동 확인 필요:',
      { paymentId: payment.payment_id, targetType: payment.target_type, targetId: payment.target_id, error: e.message },
    ),
  )

  return { success: true, payment: updatedPayment }
}

/**
 * AI 처리 최종 실패 시 시스템 자동 환불 (SPEC-02 2절, DEV-08)
 * - photoWorker/videoWorker가 ai_jobs 최종 실패(재시도 소진)를 확정한 뒤 호출한다.
 * - cancelPayment(사용자 셀프 취소)와 달리 호출자 userId 소유권 검증이 없다 - 워커가
 *   시스템 주체로 호출하기 때문. 대신 target_type/target_id로 결제를 찾는다.
 * - **중복 환불 가드**: `status='done' AND cancel_reason IS NULL` 조건의 단일 UPDATE로
 *   원자적 선점(claim)한다 - confirmPayment가 toss_payment_key를 선점 마커로 쓰는 것과
 *   동일한 아이디어(멱등키 역할). 두 번째 호출은 이미 cancel_reason이 채워져 있어
 *   WHERE절에 걸리지 않고 affectedRows=0이 되어 자연스럽게 스킵된다. 토스 API를 두 번
 *   호출할 일이 없다.
 * - **불확정 결제 방어**: 선점(claim)에 실패했는데 완료(done) 결제 자체가 없다면,
 *   결제가 아직 확정되지 않은 상태(선점 중/미결제)에서 AI가 실패한 것이다. 이 경우
 *   토스에 청구된 적이 없으므로 취소 API를 호출하지 않고 그대로 반환한다(청구도
 *   안 됐는데 "환불했다"고 안내하면 거짓 안내가 된다).
 * @returns {Promise<{refunded: boolean, reason?: string, payment: object|null}>}
 */
export const refundForAiFailure = async (targetType, targetId, { reason }) => {
  const claimMarker = `[SYSTEM_REFUND_CLAIMED] ${reason ?? 'AI 처리 실패'}`.slice(0, 500)

  const [claimResult] = await pool.execute(
    `UPDATE payments
     SET cancel_reason = ?, updated_at = NOW()
     WHERE target_type = ? AND target_id = ? AND status = 'done' AND cancel_reason IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [claimMarker, targetType, targetId],
  )

  if (claimResult.affectedRows === 0) {
    const existing = await paymentRepository.findLatestPaymentByTarget(targetType, targetId)
    if (!existing || existing.status !== 'done') {
      // 완료된 결제가 없다 - 선점 중(아직 confirm 전)이거나 애초에 결제가 시작되지
      // 않은 상태에서 AI가 실패했다는 뜻. 환불할 대상이 없으므로 토스를 호출하지 않는다.
      return { refunded: false, reason: 'no_completed_payment', payment: existing ?? null }
    }
    // done인데 claim에 실패했다면 cancel_reason이 이미 채워져 있다는 뜻 - 직전에
    // 이 함수(또는 사용자의 셀프 취소)가 이미 처리했거나 처리를 시도한 것이다.
    return { refunded: false, reason: 'already_processed', payment: existing }
  }

  const payment = await paymentRepository.findLatestPaymentByTarget(targetType, targetId)

  // ── 토스페이먼츠 취소 API 호출 (cancelPayment와 동일한 엔드포인트 재사용) ──
  let tossResponse
  try {
    const res = await fetch(TOSS_CANCEL_URL(payment.toss_payment_key), {
      method: 'POST',
      headers: {
        Authorization: getTossAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cancelReason: reason ?? 'AI 처리 실패로 인한 자동 환불' }),
      signal: AbortSignal.timeout(TOSS_CONFIRM_TIMEOUT_MS),
    })
    tossResponse = await res.json()
    if (!res.ok) {
      throw new Error(tossResponse?.message ?? '토스 환불 실패')
    }
  } catch (err) {
    // 환불 실패 - 조용히 삼키지 않는다. payments.status는 실제 청구 상태를 정확히
    // 반영해야 하므로 'done'을 그대로 둔다(돈이 실제로는 반환되지 않았으므로 임의로
    // 'canceled'로 바꾸면 거짓 기록이 된다). fail_reason에 사유를 남기고 크게
    // 로그를 찍어 관리자가 수동 환불하도록 한다. cancel_reason의 claim 마커는
    // [SYSTEM_REFUND_FAILED]로 갱신해 실패 사실 자체는 남기되, 무한 자동 재시도는
    // 막는다(다음 자동 호출도 cancel_reason IS NULL 조건에 걸려 스킵된다 - 수동
    // 개입이 필요한 건이라 자동 재시도 대상이 아니다).
    const failMsg = err.message ?? '토스 환불 API 오류'
    await pool.execute(
      `UPDATE payments SET fail_reason = ?, cancel_reason = ?, updated_at = NOW() WHERE payment_id = ?`,
      [
        `자동 환불 실패 (수동 환불 필요): ${failMsg}`.slice(0, 500),
        `[SYSTEM_REFUND_FAILED] ${reason ?? 'AI 처리 실패'}`.slice(0, 500),
        payment.payment_id,
      ],
    )
    console.error(
      '[paymentService] AI 실패 자동 환불 - 토스 취소 API 오류 (수동 환불 필요):',
      { paymentId: payment.payment_id, targetType, targetId, tossPaymentKey: payment.toss_payment_key, error: failMsg },
    )
    return { refunded: false, reason: 'refund_api_failed', payment }
  }

  const updatedPayment = await paymentRepository.updatePaymentCanceled(payment.payment_id, {
    cancelReason: reason ?? 'AI 처리 실패로 인한 자동 환불',
  })

  // target 상태 환원 - cancelPayment와 동일한 기존 함수 재사용 (photo_order→refunded,
  // will_order→draft). 실패해도 환불 자체는 이미 완료된 상태이므로 로그만 남긴다
  // (cancelPayment와 동일한 관례).
  await _revertTargetStatus(targetType, targetId).catch((e) =>
    console.error(
      '[paymentService] refundForAiFailure target 상태 환원 실패 - 수동 확인 필요:',
      { paymentId: payment.payment_id, targetType, targetId, error: e.message },
    ),
  )

  return { refunded: true, payment: updatedPayment }
}

/**
 * 내 결제 목록 조회 (페이지네이션)
 */
export const getPayments = async (userId, { page = 1, limit = 20 }) => {
  const safeLimit = Math.min(Number(limit), 100)
  const offset = (Number(page) - 1) * safeLimit
  const { payments, total } = await paymentRepository.findPaymentsByUserId(userId, {
    limit: safeLimit,
    offset,
  })
  return {
    payments,
    meta: { total, page: Number(page), limit: safeLimit, totalPages: Math.ceil(total / safeLimit) },
  }
}

/**
 * 마이페이지용 결제 히스토리 (최근 50건)
 */
export const getPaymentHistory = async (userId) => {
  const { payments } = await paymentRepository.findPaymentsByUserId(userId, {
    limit: 50,
    offset: 0,
  })
  return payments
}

/**
 * 토스 웹훅 처리
 * - TOSS_WEBHOOK_SECRET 서명 검증 후 결제 상태 동기화
 */
/**
 * @param {string} signature   - toss-signature 헤더 값
 * @param {string} rawBody     - 서명 검증용 원본 요청 바디 문자열
 * @param {object} payload     - 파싱된 JSON 페이로드 (이벤트 처리용)
 */
export const handleWebhook = async (signature, rawBody, payload) => {
  const webhookSecret = process.env.TOSS_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw Object.assign(new Error('웹훅 서명 검증을 위한 TOSS_WEBHOOK_SECRET이 설정되지 않았습니다'), { status: 500 })
  }
  const { createHmac, timingSafeEqual } = await import('node:crypto')
  const expected = createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex')
  // timing-safe 비교로 타이밍 공격 방지
  const sigBuf = Buffer.from(signature ?? '', 'utf8')
  const expBuf = Buffer.from(expected, 'utf8')
  const isValid = sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)
  if (!isValid) {
    throw Object.assign(new Error('웹훅 서명이 유효하지 않습니다'), { status: 401 })
  }

  const { eventType, data } = payload

  // 빌링키 삭제 이벤트 - 암호화된 키라 직접 매칭 불가, 로그만 기록 후 수동 확인
  if (eventType === 'BILLING_DELETED') {
    const billingKey = payload.billingKey
    console.warn(
      '[webhook] BILLING_DELETED 수신 - 수동 확인 필요. billingKey prefix:',
      billingKey ? billingKey.slice(0, 8) + '...' : 'unknown',
    )
    return { synced: true }
  }

  if (!data?.paymentKey) return { synced: false, reason: 'paymentKey 없음' }

  const payment = await paymentRepository.findPaymentByTossKey(data.paymentKey)
  if (!payment) {
    // tossOrderId로 fallback 조회
    const byOrder = data.orderId
      ? await paymentRepository.findPaymentByOrderId(data.orderId)
      : null
    if (!byOrder) return { synced: false, reason: '결제 레코드 없음' }

    if (eventType === 'PAYMENT_STATUS_CHANGED' && data.status === 'DONE') {
      await paymentRepository.updatePaymentDone(byOrder.payment_id, {
        tossPaymentKey: data.paymentKey,
        paidAt: data.approvedAt ? new Date(data.approvedAt) : new Date(),
      })
    }
    return { synced: true }
  }

  // 이미 처리된 경우 멱등성 보장
  if (eventType === 'PAYMENT_STATUS_CHANGED') {
    if (data.status === 'DONE' && payment.status !== 'done') {
      await paymentRepository.updatePaymentDone(payment.payment_id, {
        tossPaymentKey: data.paymentKey,
        paidAt: data.approvedAt ? new Date(data.approvedAt) : new Date(),
      })
      await _updateTargetStatus(payment.target_type, payment.target_id).catch((e) =>
        console.error(
          '[paymentService] 웹훅 _updateTargetStatus 실패 - 수동 확인 필요:',
          { paymentId: payment.payment_id, targetType: payment.target_type, targetId: payment.target_id, error: e.message },
        ),
      )
    } else if (data.status === 'CANCELED' && payment.status !== 'canceled') {
      await paymentRepository.updatePaymentCanceled(payment.payment_id, {
        cancelReason: data.cancels?.[0]?.cancelReason ?? '웹훅 취소 동기화',
      })
    } else if (data.status === 'ABORTED' && payment.status !== 'failed') {
      await paymentRepository.updatePaymentFailed(payment.payment_id, {
        failReason: data.failure?.message ?? '결제 중단',
      })
    }
  }

  return { synced: true }
}

/**
 * target 상태 업데이트 - 결제 완료 시
 * photo_orders.status='paid' 또는 wills.status='active'
 * @param {string} targetType
 * @param {string} targetId
 * @param {object} [conn] - 트랜잭션 커넥션 (없으면 pool 직접 사용)
 */
const _updateTargetStatus = async (targetType, targetId, conn) => {
  const executor = conn ?? pool
  if (targetType === 'photo_order') {
    await executor.execute(
      `UPDATE photo_orders SET status = 'paid', updated_at = NOW() WHERE order_id = ? AND deleted_at IS NULL`,
      [targetId],
    )
  } else if (targetType === 'will_order') {
    await executor.execute(
      `UPDATE wills SET status = 'paid', updated_at = NOW() WHERE will_id = ? AND deleted_at IS NULL`,
      [targetId],
    )
  }
}

/**
 * target 상태 환원 - 결제 취소 시
 * photo_orders.status ENUM에는 'canceled'가 없다('refunded'만 존재) - 잘못된 값으로 UPDATE하면
 * SQL 에러가 나서 환불은 완료됐는데 주문은 계속 'paid'로 남는 불일치가 발생한다.
 */
const _revertTargetStatus = async (targetType, targetId) => {
  if (targetType === 'photo_order') {
    await pool.execute(
      `UPDATE photo_orders SET status = 'refunded', updated_at = NOW() WHERE order_id = ? AND deleted_at IS NULL`,
      [targetId]
    )
  } else if (targetType === 'will_order') {
    await pool.execute(
      `UPDATE wills SET status = 'draft', updated_at = NOW() WHERE will_id = ? AND deleted_at IS NULL`,
      [targetId]
    )
  }
}
