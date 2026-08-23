/**
 * Gift Perform Service - 수행자(무계정 부모) 측 비즈니스 로직 (SPEC-01 3-2)
 * 구매자(giver) 측 로직은 giftService.js 참고 (파일 줄수 규약 분리)
 *
 * 판단 포인트 1 (완료 보고 3절): will 선물 수행 플로우는 기존 will 제작 플로우를
 * "재사용"한다 - 재구현하지 않는다. photo_orders.user_id/wills.user_id가 NOT NULL이고
 * voice_samples/will_beneficiaries 등 소유 체인 전체가 인증 사용자를 전제하므로,
 * 스키마 변경 없이 무계정 수행자를 지원할 방법이 없다. 대신 "본인확인 통과 → 계정
 * 생성/로그인(linkAccount) → 이후 전 과정은 photo/will 도메인의 기존 인증 엔드포인트를
 * 그대로 사용"하는 다리를 놓는다. 이 파일은 (a) 본인확인/계정연결 (b) 이미 결제된
 * gift를 photo_orders/wills와 연결(attach) (c) 완료 확정, 세 지점만 관여한다.
 *
 * 판단 포인트 2 (완료 보고 3절): 소유자는 attach 시점이 아니라 계정 연결(linkAccount)
 * 시점에 이미 확정된다 - "임시 소유 후 계정 생성 유도"가 아니라 "계정 생성/로그인을
 * 먼저 강제하고 그 계정으로 콘텐츠를 만든다" 순서로 뒤집었다(스키마의 NOT NULL user_id
 * 제약상 유일한 방법).
 *
 * [마감 공백 처리 완료] gift_orders에 photo_order_id/will_id 참조 컬럼을 추가해
 * attach 계열이 소유권 검증뿐 아니라 연결 자체를 영속화한다. 이미 다른 ID로 연결된
 * gift에 다른 ID로 재시도하면 409, 같은 ID로 재시도하면 멱등 성공. complete 호출
 * 시에는 클라이언트가 보낸 orderId/willId가 이 저장된 연결과 일치하는지도 검증한다.
 */

import { v4 as uuidv4 } from 'uuid'
import * as giftRepository from './giftRepository.js'
import * as paymentService from '../payment/paymentService.js'
import * as photoRepository from '../photo/photoRepository.js'
import * as willRepository from '../will/willRepository.js'
import * as authService from '../auth/authService.js'
import * as authRepository from '../auth/authRepository.js'
import { TERMINAL_STATUSES, hashToken, extractPhoneLast4, transitionGift, notifyGiver } from './giftShared.js'

// ─── 링크 진입 (본인확인 이전) ──────────────────────────────────────────────────

export const getPerformInfo = async (token) => {
  const gift = await giftRepository.findByPerformTokenHash(hashToken(token))
  if (!gift || !gift.payment_id) {
    throw Object.assign(new Error('유효하지 않은 링크입니다'), { status: 404 })
  }

  if (new Date(gift.token_expires_at) < new Date() && gift.status !== 'expired') {
    await transitionGift(gift, 'expired', { changedBy: null, changedByType: 'system', reason: '토큰 만료' })
    gift.status = 'expired'
  }

  if (TERMINAL_STATUSES.includes(gift.status)) {
    const messages = {
      completed: '이미 완성된 선물입니다',
      declined: '거절 처리된 선물입니다',
      refunded: '환불 처리된 선물입니다',
      expired: '링크가 만료되었습니다. 구매자에게 재발급을 요청해 주세요',
    }
    throw Object.assign(new Error(messages[gift.status] ?? '더 이상 유효하지 않은 링크입니다'), { status: 410 })
  }

  const giver = await authRepository.findByUserId(gift.giver_user_id)
  const locked = await giftRepository.isLocked(token)

  return {
    giftId: gift.gift_id,
    productType: gift.product_type,
    giverNickname: giver?.nickname ?? null,
    locked,
    alreadyVerified: await giftRepository.isVerified(token),
  }
}

/**
 * 휴대폰 뒤 4자리 본인확인 (5회 잠금, willService.verifyWatchAccess와 동일 패턴)
 */
export const verifyPerform = async (token, phoneLast4) => {
  const gift = await giftRepository.findByPerformTokenHash(hashToken(token))
  if (!gift || !gift.payment_id) {
    throw Object.assign(new Error('유효하지 않은 링크입니다'), { status: 404 })
  }
  if (TERMINAL_STATUSES.includes(gift.status)) {
    throw Object.assign(new Error('더 이상 유효하지 않은 링크입니다'), { status: 410 })
  }

  if (await giftRepository.isLocked(token)) {
    throw Object.assign(
      new Error('본인 확인 시도 횟수를 초과했습니다. 고객센터로 문의해 주세요'),
      { status: 423 },
    )
  }

  const expected = extractPhoneLast4(gift.recipient_phone)
  const matched = expected !== null && expected === phoneLast4

  if (!matched) {
    const attempts = await giftRepository.incrAttempts(token)
    if (attempts >= giftRepository.VERIFY_MAX_ATTEMPTS) {
      await giftRepository.setLocked(token)
      throw Object.assign(
        new Error('본인 확인 시도 횟수를 초과했습니다. 고객센터로 문의해 주세요'),
        { status: 423 },
      )
    }
    throw Object.assign(
      new Error(`휴대폰 번호 뒤 4자리가 일치하지 않습니다. (${giftRepository.VERIFY_MAX_ATTEMPTS - attempts}회 남음)`),
      { status: 401 },
    )
  }

  await giftRepository.resetAttempts(token)
  await giftRepository.markVerified(token)

  if (gift.status === 'link_sent') {
    await transitionGift(gift, 'opened', {
      changedBy: null,
      changedByType: 'system',
      reason: '무계정 수행자 본인확인 통과',
    })
  }

  const giver = await authRepository.findByUserId(gift.giver_user_id)
  return { giftId: gift.gift_id, productType: gift.product_type, giverNickname: giver?.nickname ?? null }
}

// ─── 계정 연결 (4-3) ────────────────────────────────────────────────────────────

/**
 * 본인확인 통과 후 계정 연결(로그인) 또는 신규 가입.
 * 이후 사진/유언장 제작은 이 계정의 accessToken으로 photo/will 도메인의 기존
 * 인증 엔드포인트를 그대로 사용한다(재설계 없음).
 */
export const linkAccount = async (token, { mode, email, password, nickname, consents, ipAddress, userAgent }) => {
  const verified = await giftRepository.isVerified(token)
  if (!verified) throw Object.assign(new Error('본인 확인이 먼저 필요합니다'), { status: 401 })

  const gift = await giftRepository.findByPerformTokenHash(hashToken(token))
  if (!gift || !gift.payment_id) {
    throw Object.assign(new Error('유효하지 않은 링크입니다'), { status: 404 })
  }
  if (TERMINAL_STATUSES.includes(gift.status)) {
    throw Object.assign(new Error('더 이상 유효하지 않은 링크입니다'), { status: 410 })
  }

  let authResult
  if (mode === 'signup') {
    authResult = await authService.register({
      email,
      password,
      nickname,
      consents: consents ?? [],
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    })
  } else if (mode === 'login') {
    authResult = await authService.login({ email, password })
  } else {
    throw Object.assign(new Error('mode는 signup 또는 login이어야 합니다'), { status: 400 })
  }

  const recipientUserId = authResult.user.userId

  // 이미 다른 계정으로 연결된 선물에 다른 계정을 또 연결하려는 시도만 막는다
  // (같은 계정으로 재로그인/새로고침 재시도는 멱등하게 통과)
  if (gift.recipient_user_id && gift.recipient_user_id !== recipientUserId) {
    throw Object.assign(new Error('이미 다른 계정과 연결된 선물입니다'), { status: 403 })
  }
  if (!gift.recipient_user_id) {
    await giftRepository.updateRecipientUserId(gift.gift_id, recipientUserId)
  }
  if (gift.status === 'opened') {
    await transitionGift(gift, 'in_progress', {
      changedBy: recipientUserId,
      changedByType: 'user',
      reason: '계정 연결 완료',
    })
  }

  return {
    accessToken: authResult.accessToken,
    refreshToken: authResult.refreshToken,
    user: authResult.user,
    gift: { giftId: gift.gift_id, productType: gift.product_type },
  }
}

/**
 * 4-5: 수행자 거절 - 상태 전이 + paymentService.refundForAiFailure(시스템 자동환불
 * 경로) 그대로 재사용해 전액 환불한다.
 */
export const declinePerform = async (token) => {
  const gift = await giftRepository.findByPerformTokenHash(hashToken(token))
  if (!gift || !gift.payment_id) {
    throw Object.assign(new Error('유효하지 않은 링크입니다'), { status: 404 })
  }
  if (!['opened', 'in_progress'].includes(gift.status)) {
    throw Object.assign(new Error('거절할 수 없는 상태입니다'), { status: 400 })
  }

  await transitionGift(gift, 'declined', {
    changedBy: gift.recipient_user_id ?? null,
    changedByType: gift.recipient_user_id ? 'user' : 'system',
    reason: '수행자가 선물 수행을 정중히 거절함',
  })

  const refundResult = await paymentService
    .refundForAiFailure('gift_order', gift.gift_id, { reason: '수행자가 선물 수행을 거절했습니다' })
    .catch((err) => {
      console.error('[giftPerformService] declinePerform 환불 호출 자체 실패:', gift.gift_id, err.message)
      return { refunded: false, reason: 'refund_call_threw' }
    })

  const giver = await authRepository.findByUserId(gift.giver_user_id)
  const message = refundResult.refunded
    ? `${gift.recipient_name}님이 선물을 정중히 거절하셨어요. 결제하신 금액은 전액 환불해 드렸습니다.`
    : `${gift.recipient_name}님이 선물을 정중히 거절하셨어요. 환불 처리 중 문제가 발생해 저희가 곧 확인해서 처리해 드릴게요.`

  await notifyGiver(gift, giver, { type: 'gift_declined', title: '선물이 거절되었습니다', message })

  return { declined: true, refunded: refundResult.refunded }
}

// ─── 콘텐츠 브리지 (attach/complete) ────────────────────────────────────────────

/**
 * 이미 선물로 결제된 photo_order를 "결제 완료"로 표시한다(이중결제 방지).
 * photoRepository.updateOrderStatus는 UPDATE+로그를 이미 트랜잭션으로 처리하는
 * 기존 함수를 그대로 재사용한다(재설계 없음).
 */
export const attachPhotoOrder = async (recipientUserId, giftId, orderId) => {
  const gift = await giftRepository.findByGiftId(giftId)
  if (!gift) throw Object.assign(new Error('선물 주문을 찾을 수 없습니다'), { status: 404 })
  if (gift.recipient_user_id !== recipientUserId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  if (gift.product_type !== 'photo') {
    throw Object.assign(new Error('사진관 선물이 아닙니다'), { status: 400 })
  }
  if (!['opened', 'in_progress'].includes(gift.status)) {
    throw Object.assign(new Error('진행할 수 없는 선물 상태입니다'), { status: 400 })
  }

  // 이미 다른 주문과 연결된 선물에 다른 주문을 또 연결하려는 시도만 막는다
  // (같은 orderId 재시도는 멱등하게 통과 - 완료 보고 1절)
  if (gift.photo_order_id && gift.photo_order_id !== orderId) {
    throw Object.assign(new Error('이미 다른 사진 주문과 연결된 선물입니다'), { status: 409 })
  }
  const alreadyLinked = gift.photo_order_id === orderId

  const order = await photoRepository.findOrderById(orderId)
  if (!order) throw Object.assign(new Error('주문을 찾을 수 없습니다'), { status: 404 })
  if (order.user_id !== recipientUserId) throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  if (!alreadyLinked && order.status !== 'pending_payment') {
    throw Object.assign(new Error(`이미 처리된 주문입니다 (현재: ${order.status})`), { status: 409 })
  }

  if (!alreadyLinked) {
    await photoRepository.updateOrderStatus(orderId, {
      prevStatus: 'pending_payment',
      nextStatus: 'paid',
      changedBy: recipientUserId,
      changedByType: 'user',
      reason: '선물 결제로 결제 완료 처리',
    })
    await giftRepository.setPhotoOrderId(gift.gift_id, orderId)
  }

  if (gift.status === 'opened') {
    await transitionGift(gift, 'in_progress', {
      changedBy: recipientUserId,
      changedByType: 'user',
      reason: '사진 주문 연결',
    })
  }

  return { orderId }
}

/**
 * 이미 선물로 결제된 will을 "결제 완료"로 표시한다 - willRepository.updateWill의
 * status 컬럼 화이트리스트를 그대로 재사용한다(재설계 없음).
 */
export const attachWillOrder = async (recipientUserId, giftId, willId) => {
  const gift = await giftRepository.findByGiftId(giftId)
  if (!gift) throw Object.assign(new Error('선물 주문을 찾을 수 없습니다'), { status: 404 })
  if (gift.recipient_user_id !== recipientUserId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  if (gift.product_type !== 'will') {
    throw Object.assign(new Error('영상 편지 선물이 아닙니다'), { status: 400 })
  }
  if (!['opened', 'in_progress'].includes(gift.status)) {
    throw Object.assign(new Error('진행할 수 없는 선물 상태입니다'), { status: 400 })
  }

  // 이미 다른 유언장과 연결된 선물에 다른 유언장을 또 연결하려는 시도만 막는다
  // (같은 willId 재시도는 멱등하게 통과 - 완료 보고 1절)
  if (gift.will_id && gift.will_id !== willId) {
    throw Object.assign(new Error('이미 다른 영상 편지와 연결된 선물입니다'), { status: 409 })
  }
  const alreadyLinked = gift.will_id === willId

  const will = await willRepository.findWillById(willId)
  if (!will) throw Object.assign(new Error('영상 편지를 찾을 수 없습니다'), { status: 404 })
  if (String(will.user_id) !== String(recipientUserId)) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  if (!alreadyLinked && will.status !== 'draft') {
    throw Object.assign(new Error(`이미 처리된 영상 편지입니다 (현재: ${will.status})`), { status: 409 })
  }

  if (!alreadyLinked) {
    await willRepository.updateWill(willId, { status: 'paid' })
    await willRepository.addWillStatusLog({
      logId: uuidv4(),
      willId,
      prevStatus: 'draft',
      nextStatus: 'paid',
      changedBy: recipientUserId,
      changedByType: 'user',
      reason: '선물 결제로 결제 완료 처리',
    })
    await giftRepository.setWillId(gift.gift_id, willId)
  }

  if (gift.status === 'opened') {
    await transitionGift(gift, 'in_progress', {
      changedBy: recipientUserId,
      changedByType: 'user',
      reason: '영상 편지 연결',
    })
  }

  return { willId }
}

/**
 * 수행 완료 - 실제 콘텐츠 상태(완료)를 확인한 뒤에만 gift를 completed로 전이하고
 * 구매자에게 "완료되었습니다" 통지(내용은 절대 포함하지 않음 - SPEC-01 2절/7-4)
 */
export const completeGift = async (recipientUserId, giftId, { orderId, willId } = {}) => {
  const gift = await giftRepository.findByGiftId(giftId)
  if (!gift) throw Object.assign(new Error('선물 주문을 찾을 수 없습니다'), { status: 404 })
  if (gift.recipient_user_id !== recipientUserId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  if (gift.status === 'completed') {
    return { giftId, status: 'completed', idempotent: true }
  }
  if (gift.status !== 'in_progress') {
    throw Object.assign(new Error('아직 진행 중이 아닙니다'), { status: 400 })
  }

  if (gift.product_type === 'photo') {
    if (!orderId) throw Object.assign(new Error('orderId가 필요합니다'), { status: 400 })
    // 연결 존재 검증 - attach-photo-order로 저장된 연결과 다른 orderId를 들이밀어
    // 완료 처리하려는 시도를 막는다(완료 보고 1절 (c))
    if (gift.photo_order_id !== orderId) {
      throw Object.assign(new Error('연결된 사진 주문과 일치하지 않습니다. attach-photo-order를 먼저 호출하세요'), { status: 400 })
    }
    const order = await photoRepository.findOrderById(orderId)
    if (!order || order.user_id !== recipientUserId) {
      throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
    }
    if (order.status !== 'completed') {
      throw Object.assign(new Error('아직 제작이 완료되지 않았습니다'), { status: 400 })
    }
  } else {
    if (!willId) throw Object.assign(new Error('willId가 필요합니다'), { status: 400 })
    if (gift.will_id !== willId) {
      throw Object.assign(new Error('연결된 영상 편지와 일치하지 않습니다. attach-will을 먼저 호출하세요'), { status: 400 })
    }
    const will = await willRepository.findWillById(willId)
    if (!will || String(will.user_id) !== String(recipientUserId)) {
      throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
    }
    if (will.status !== 'active') {
      throw Object.assign(new Error('아직 제작이 완료되지 않았습니다'), { status: 400 })
    }
  }

  await transitionGift(gift, 'completed', {
    changedBy: recipientUserId,
    changedByType: 'user',
    reason: '수행자 제작 완료',
  })

  const giver = await authRepository.findByUserId(gift.giver_user_id)
  await notifyGiver(gift, giver, {
    type: 'gift_completed',
    title: '선물이 완성되었어요',
    // SPEC-01 2절: 영상 편지 내용은 구매자에게 노출하지 않는다 - 완료 사실만 통지
    message: `${gift.recipient_name}님께 보낸 선물이 완성되었어요. 소중한 마음이 잘 전해졌습니다.`,
  })

  return { giftId, status: 'completed' }
}
