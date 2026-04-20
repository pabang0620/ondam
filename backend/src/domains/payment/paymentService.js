import { v4 as uuidv4 } from 'uuid'
import * as paymentRepository from './paymentRepository.js'
import pool from '../../config/db.js'

const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm'
const TOSS_CANCEL_URL = (tossPaymentKey) =>
  `https://api.tosspayments.com/v1/payments/${tossPaymentKey}/cancel`

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
 * 결제 준비
 * - paymentId(UUID) + tossOrderId 생성 후 payments 레코드 INSERT
 */
export const preparePayment = async (userId, { targetType, targetId, amountKrw }) => {
  const VALID_TARGET_TYPES = ['photo_order', 'will_order', 'subscription']
  if (!VALID_TARGET_TYPES.includes(targetType)) {
    throw Object.assign(new Error('유효하지 않은 결제 대상 유형입니다'), { status: 400 })
  }
  if (!amountKrw || amountKrw <= 0) {
    throw Object.assign(new Error('결제 금액이 올바르지 않습니다'), { status: 400 })
  }

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
 */
export const confirmPayment = async (userId, { paymentKey, orderId, amount }) => {
  // 멱등성 확인 — 이미 처리된 paymentKey
  const existing = await paymentRepository.findPaymentByTossKey(paymentKey)
  if (existing && existing.status === 'done') {
    // 첫 번째 요청 타임아웃 후 재시도 케이스 대응 — target 상태 재동기화
    await _updateTargetStatus(existing.target_type, existing.target_id)
    return { success: true, payment: existing, idempotent: true }
  }

  // orderId로 내부 결제 레코드 찾기
  const payment = await paymentRepository.findPaymentByOrderId(orderId)
  if (!payment) {
    throw Object.assign(new Error('결제 정보를 찾을 수 없습니다'), { status: 404 })
  }
  if (payment.user_id !== userId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  if (payment.amount_krw !== Number(amount)) {
    await paymentRepository.updatePaymentFailed(payment.payment_id, {
      failReason: `금액 불일치: 요청=${amount}, 원본=${payment.amount_krw}`,
    })
    throw Object.assign(new Error('결제 금액이 일치하지 않습니다'), { status: 400 })
  }

  // PAYMENT_MOCK=true 환경에서는 토스 API 호출 생략하고 즉시 완료 처리
  if (process.env.PAYMENT_MOCK === 'true') {
    const mockConn = await pool.getConnection()
    try {
      await mockConn.beginTransaction()
      await mockConn.execute(
        `UPDATE payments SET status = 'done', paid_at = NOW(), updated_at = NOW()
         WHERE payment_id = ? AND deleted_at IS NULL`,
        [payment.payment_id],
      )
      await _updateTargetStatus(payment.target_type, payment.target_id, mockConn)
      await mockConn.commit()
    } catch (err) {
      await mockConn.rollback()
      throw err
    } finally {
      mockConn.release()
    }
    return { success: true, mock: true }
  }

  // 토스페이먼츠 승인 API 호출 (외부 HTTP — 트랜잭션 밖에서 먼저 수행)
  let tossResponse
  try {
    const res = await fetch(TOSS_CONFIRM_URL, {
      method: 'POST',
      headers: {
        Authorization: getTossAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
    tossResponse = await res.json()

    if (!res.ok) {
      const failReason = tossResponse?.message ?? '토스 승인 실패'
      await paymentRepository.updatePaymentFailed(payment.payment_id, { failReason })
      throw Object.assign(new Error(failReason), { status: 400 })
    }
  } catch (err) {
    if (err.status) throw err
    await paymentRepository.updatePaymentFailed(payment.payment_id, {
      failReason: err.message ?? '네트워크 오류',
    })
    throw Object.assign(new Error('결제 승인 중 오류가 발생했습니다'), { status: 502 })
  }

  // payments + target 상태 업데이트 — 원자적으로 처리
  const paidAt = tossResponse.approvedAt ? new Date(tossResponse.approvedAt) : new Date()
  let updatedPayment
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `UPDATE payments
       SET status = 'done', toss_payment_key = ?, paid_at = ?, updated_at = NOW()
       WHERE payment_id = ? AND deleted_at IS NULL`,
      [paymentKey, paidAt, payment.payment_id],
    )
    await _updateTargetStatus(payment.target_type, payment.target_id, conn)
    await conn.commit()
    updatedPayment = await paymentRepository.findPaymentById(payment.payment_id)
  } catch (err) {
    await conn.rollback()
    // 토스는 이미 승인됐으나 DB 업데이트 실패 — 심각한 불일치이므로 상세 로그 후 throw
    console.error(
      '[paymentService] confirmPayment DB 트랜잭션 실패 — 토스 승인 완료 후 DB 미반영:',
      { paymentId: payment.payment_id, paymentKey, error: err.message },
    )
    throw err
  } finally {
    conn.release()
  }

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

  // target 상태 환원
  await _revertTargetStatus(payment.target_type, payment.target_id).catch((e) =>
    console.error('[paymentService] _revertTargetStatus 실패:', e.message),
  )

  return { success: true, payment: updatedPayment }
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
 * @param {string} signature   — toss-signature 헤더 값
 * @param {string} rawBody     — 서명 검증용 원본 요청 바디 문자열
 * @param {object} payload     — 파싱된 JSON 페이로드 (이벤트 처리용)
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
          '[paymentService] 웹훅 _updateTargetStatus 실패 — 수동 확인 필요:',
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
 * target 상태 업데이트 — 결제 완료 시
 * photo_orders.status='paid' 또는 wills.status='active'
 * @param {string} targetType
 * @param {string} targetId
 * @param {object} [conn] — 트랜잭션 커넥션 (없으면 pool 직접 사용)
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
 * target 상태 환원 — 결제 취소 시
 */
const _revertTargetStatus = async (targetType, targetId) => {
  if (targetType === 'photo_order') {
    await pool.execute(
      `UPDATE photo_orders SET status = 'canceled', updated_at = NOW() WHERE order_id = ? AND deleted_at IS NULL`,
      [targetId]
    )
  } else if (targetType === 'will_order') {
    await pool.execute(
      `UPDATE wills SET status = 'draft', updated_at = NOW() WHERE will_id = ? AND deleted_at IS NULL`,
      [targetId]
    )
  }
}
