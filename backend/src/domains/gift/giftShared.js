/**
 * Gift 도메인 공용 헬퍼 - giftService(구매자 측)와 giftPerformService(수행자 측)가
 * 함께 쓴다. 파일 줄수 규약(최대 500줄) 때문에 giftService.js에서 분리했다.
 */

import crypto from 'node:crypto'
import { v4 as uuidv4 } from 'uuid'
import * as giftRepository from './giftRepository.js'
import * as notificationService from '../notification/notificationService.js'
import * as authRepository from '../auth/authRepository.js'
// [마감 공백 처리] paymentService만 import한다(giftService/giftPerformService가 아님) -
// paymentService → giftRepository 단방향 의존이라(paymentService.js 상단 주석 참고),
// 여기서 paymentService를 들여와도 순환 import가 생기지 않는다.
import * as paymentService from '../payment/paymentService.js'
import { notificationQueue } from '../../jobs/queue.js'

export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

// 수행 완료/거절 이후에는 어떤 조작도 허용하지 않는 종결 상태
export const TERMINAL_STATUSES = ['completed', 'declined', 'refunded', 'expired']

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

export const issuePerformToken = () => {
  const performTokenPlain = crypto.randomBytes(32).toString('hex')
  return {
    performTokenPlain,
    performTokenHash: hashToken(performTokenPlain),
    tokenExpiresAt: new Date(Date.now() + giftRepository.GIFT_TOKEN_TTL_MS),
  }
}

export const extractPhoneLast4 = (phone) => {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : null
}

export const performLink = (token) => `${CLIENT_URL}/gift/perform/${token}`

/**
 * 상태 전이 + gift_order_logs 기록을 한 쌍으로 처리
 */
export const transitionGift = async (gift, nextStatus, { changedBy, changedByType, reason }) => {
  await giftRepository.updateStatus(gift.gift_id, nextStatus)
  await giftRepository
    .addLog({
      logId: uuidv4(),
      giftId: gift.gift_id,
      prevStatus: gift.status,
      nextStatus,
      changedBy,
      changedByType,
      reason,
    })
    .catch((e) => console.error('[giftShared] gift_order_logs 기록 실패:', gift.gift_id, e.message))
}

/**
 * 구매자에게 in-app + (이메일 있으면) 이메일 통지
 */
export const notifyGiver = async (gift, giver, { type, title, message }) => {
  await notificationService
    .sendNotification(gift.giver_user_id, {
      type,
      targetType: 'gift_order',
      targetId: gift.gift_id,
      title,
      message,
    })
    .catch((e) => console.error('[giftShared] in-app 알림 기록 실패:', gift.gift_id, e.message))

  if (giver?.email) {
    await notificationQueue
      .add(type, { type: 'email', to: giver.email, subject: `[리멤버미] ${title}`, message })
      .catch((e) => console.error('[giftShared] 이메일 알림 큐 등록 실패:', gift.gift_id, e.message))
  }
}

/**
 * AI 처리 최종 실패 후 photoWorker/videoWorker의 refundForAiFailure('photo_order'|
 * 'will_order', id) 호출이 'no_completed_payment'(결제를 못 찾음)로 끝났을 때 쓴다.
 * 선물 결제 콘텐츠는 payments 행이 target_type='gift_order'로 잡혀 있어 그 경로로는
 * 못 찾는다 - 여기서 giftRepository 역조회로 gift_id를 찾아 'gift_order' 경로로
 * 환불을 재시도한다(완료 보고 2절). 중복 환불 가드는 paymentService.refundForAiFailure
 * 내부의 claim UPDATE(cancel_reason IS NULL)를 그대로 신뢰한다 - 재구현하지 않는다.
 *
 * @param {'photo'|'will'} productType
 * @param {string} contentId - orderId(photo) 또는 willId(will)
 * @param {string} reason
 * @returns {Promise<{gift: object, refundResult: object}|null>} 선물 결제 콘텐츠가
 *   아니면 null (호출자는 기존 일반 실패 처리 경로를 그대로 유지하면 된다)
 */
export const refundGiftFallback = async ({ productType, contentId, reason }) => {
  const gift = productType === 'photo'
    ? await giftRepository.findByPhotoOrderId(contentId)
    : await giftRepository.findByWillId(contentId)

  if (!gift) return null

  const refundResult = await paymentService
    .refundForAiFailure('gift_order', gift.gift_id, { reason })
    .catch((err) => {
      console.error('[giftShared] refundGiftFallback 환불 호출 자체 실패:', gift.gift_id, err.message)
      return { refunded: false, reason: 'refund_call_threw' }
    })

  if (refundResult.refunded) {
    // paymentService._revertTargetStatus가 이미 gift_orders.status를 'refunded'로
    // 전이했다(호출하지 않는다 - 재구현 금지) - 여기서는 append-only 로그와 통지만 남긴다.
    await giftRepository
      .addLog({
        logId: uuidv4(),
        giftId: gift.gift_id,
        prevStatus: gift.status,
        nextStatus: 'refunded',
        changedBy: null,
        changedByType: 'system',
        reason,
      })
      .catch((e) => console.error('[giftShared] refundGiftFallback 로그 기록 실패:', gift.gift_id, e.message))

    const giver = await authRepository.findByUserId(gift.giver_user_id).catch(() => null)
    await notifyGiver(gift, giver, {
      type: 'ai_processing_refunded',
      title: 'AI 처리 실패로 환불되었습니다',
      message:
        `${gift.recipient_name}님께 보낸 선물을 만드는 중 문제가 발생해 결제하신 금액을 ` +
        '전액 환불해 드렸어요. 카드사에 따라 환불 반영까지 며칠 걸릴 수 있어요.',
    })
  }

  return { gift, refundResult }
}
