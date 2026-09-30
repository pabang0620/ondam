/**
 * Gift Service - 구매자(giver) 측 비즈니스 로직 (SPEC-01)
 * 수행자(무계정 부모) 측 로직은 giftPerformService.js 참고 (파일 줄수 규약 분리)
 *
 * 결제 연동 설계(완료 보고 2절): gift_orders 행을 payment_id=NULL("결제 대기")로 먼저
 * 만들고, paymentService.preparePayment/confirmPayment의 검증된 핵심 로직을 그대로
 * 재사용한다 - targetType에 'gift_order'만 새로 추가했을 뿐 결제 승인/멱등성/락 로직은
 * 손대지 않았다. 자세한 근거는 giftRepository.js 상단 주석 참고.
 */

import { v4 as uuidv4 } from 'uuid'
import * as giftRepository from './giftRepository.js'
import * as paymentService from '../payment/paymentService.js'
import * as paymentRepository from '../payment/paymentRepository.js'
import { notificationQueue } from '../../jobs/queue.js'
import { GIFT_PRODUCT_TYPE } from '../../../../shared/constants/enums.js'
import { TERMINAL_STATUSES, issuePerformToken, performLink } from './giftShared.js'
import { omitIds } from '../../utils/dto.js'

/**
 * 선물 주문 생성 + 결제 준비 (SPEC-01 6절 POST /api/gifts)
 */
export const createGiftOrder = async (giverUserId, { productType, recipientName, recipientPhone }) => {
  if (!GIFT_PRODUCT_TYPE.includes(productType)) {
    throw Object.assign(new Error('유효하지 않은 선물 상품입니다'), { status: 400 })
  }

  const giftId = uuidv4()
  const { performTokenPlain, performTokenHash, tokenExpiresAt } = issuePerformToken()

  await giftRepository.insertGiftOrder({
    giftId,
    giverUserId,
    productType,
    recipientName,
    recipientPhone,
    performTokenHash,
    tokenExpiresAt,
  })

  // preparePayment가 실패해도 gift_orders 행은 payment_id=NULL("결제 대기")로 정직하게
  // 남는다 - giftRepository.js 상단 주석 참고. 거짓으로 완료된 상태가 아니므로 G4가
  // 우려하는 "일부만 커밋된 완료 상태"에 해당하지 않는다.
  const prepared = await paymentService.preparePayment(giverUserId, {
    targetType: 'gift_order',
    targetId: giftId,
  })

  return {
    giftId,
    performToken: performTokenPlain, // 프론트가 결제 왕복 동안 sessionStorage에 보관 (1회 노출)
    paymentId: prepared.paymentId,
    tossOrderId: prepared.tossOrderId,
    amountKrw: prepared.amountKrw,
  }
}

export const getMyGifts = async (giverUserId, { page = 1, limit = 20 }) => {
  const safeLimit = Math.min(Number(limit), 100)
  const offset = (Number(page) - 1) * safeLimit
  const { gifts, total } = await giftRepository.findGiftsByGiverUserId(giverUserId, {
    limit: safeLimit,
    offset,
  })
  return {
    // 내부 AUTO_INCREMENT id는 외부에 노출하지 않는다(gift_id UUID만 노출) - DEV-33
    gifts: omitIds(gifts),
    meta: { total, page: Number(page), limit: safeLimit, totalPages: Math.ceil(total / safeLimit) },
  }
}

/**
 * 4-1: 링크 재발급 - 새 토큰 발급 + 기존 토큰 무효화 + SMS 재전송
 * (최초 링크는 구매자가 카카오톡/문자/복사로 "직접" 공유하지만, 재발급은 "재전송"이라는
 * 표현대로 서버가 대신 SMS로 보낸다)
 */
export const resendLink = async (giverUserId, giftId) => {
  const gift = await giftRepository.findByGiftId(giftId)
  if (!gift) throw Object.assign(new Error('선물 주문을 찾을 수 없습니다'), { status: 404 })
  if (gift.giver_user_id !== giverUserId) throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  if (!gift.payment_id) throw Object.assign(new Error('결제가 완료되지 않은 선물입니다'), { status: 400 })
  // [D3] expired는 TERMINAL_STATUSES(종결)에 속하지만, "기한 연장"의 대상이기도 하다 -
  // giftReminderWorker.buildGiverExpiredMessage가 실제로 안내하는 두 경로(환불/재발급)
  // 중 하나다. TERMINAL_STATUSES 자체에서 expired를 빼면 getPerformInfo/verifyPerform/
  // linkAccount 등 수행자(무계정) 측 게이트까지 함께 풀려 만료된 링크로 그대로 진입할
  // 수 있게 되므로, 여기 giver 측 재발급 판정에서만 예외로 허용한다. 재발급이 실행되면
  // 아래 reissueToken이 새 토큰을 발급하고 status를 link_sent로 되돌리므로, 옛 토큰은
  // perform_token_hash가 교체되어 자연히 무효화된다(수행자 측 게이트 우회 아님).
  if (TERMINAL_STATUSES.includes(gift.status) && gift.status !== 'expired') {
    throw Object.assign(new Error('이미 종료된 선물입니다. 재발급할 수 없습니다'), { status: 400 })
  }

  const { performTokenPlain, performTokenHash, tokenExpiresAt } = issuePerformToken()
  await giftRepository.reissueToken(giftId, { performTokenHash, tokenExpiresAt })
  await giftRepository.addLog({
    logId: uuidv4(),
    giftId,
    prevStatus: gift.status,
    nextStatus: 'link_sent',
    changedBy: giverUserId,
    changedByType: 'user',
    reason: '구매자 링크 재발급 요청',
  })

  const link = performLink(performTokenPlain)
  await notificationQueue
    .add('gift_resend', {
      type: 'sms',
      to: gift.recipient_phone,
      message: `[온담] ${gift.recipient_name}님께 보내는 선물 링크가 다시 발송됐어요. ${link}`,
    })
    .catch((e) => console.error('[giftService] resendLink SMS 큐 등록 실패:', giftId, e.message))

  return { giftId, performToken: performTokenPlain, link }
}

/**
 * 4-4 / D3: 구매자 셀프 환불
 * paymentService.cancelPayment의 검증된 취소 로직을 그대로 재사용한다.
 *
 * [D3] 환불 가능 상태를 link_sent(수행 전) 뿐 아니라 expired(만료)까지 확장한다 -
 * 기존에는 만료된 선물이 환불도 재발급(resendLink)도 API에서 거부되어 결제만 완료된
 * 채 돈이 묶이는 막다른 길이었다(giftReminderWorker.js:71 안내 문구와 실제 동작
 * 불일치). 단, 수행자가 이미 콘텐츠 제작을 시작한 경우(photo_order_id/will_id가
 * gift_orders에 연결됨)는 리소스가 이미 소비된 것이므로 이 목록에 들어있어도 환불을
 * 차단한다 - opened/in_progress 상태에서 attach까지 마친 뒤 아무도 완료하지 못하고
 * 토큰만 만료돼도(giftReminderWorker.scanAndExpireOverdueGifts) status는 'expired'로
 * 바뀌지만 photo_order_id/will_id는 그대로 남아있어 이 판별에 쓸 수 있다.
 */
const REFUNDABLE_GIFT_STATUSES = ['link_sent', 'expired']

export const cancelGift = async (giverUserId, giftId, { cancelReason } = {}) => {
  const gift = await giftRepository.findByGiftId(giftId)
  if (!gift) throw Object.assign(new Error('선물 주문을 찾을 수 없습니다'), { status: 404 })
  if (gift.giver_user_id !== giverUserId) throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  if (!gift.payment_id) {
    throw Object.assign(new Error('결제가 완료되지 않은 선물입니다'), { status: 400 })
  }
  // [D3] 거부 사유는 실제 판정 근거(status)를 있는 그대로 안내한다 - 예전 문구
  // "이미 링크를 열람한 이후에는"은 link_sent 외 상태를 전부 "열람했다"고 단정해
  // 부정확했다(예: expired는 열람 여부와 무관하게 이 조건에 걸릴 수 있었다).
  if (!REFUNDABLE_GIFT_STATUSES.includes(gift.status)) {
    throw Object.assign(
      new Error(`현재 상태(${gift.status})에서는 직접 취소할 수 없습니다. 고객센터로 문의해 주세요`),
      { status: 400 },
    )
  }
  if (gift.photo_order_id || gift.will_id) {
    throw Object.assign(
      new Error('이미 받는 분이 제작을 시작한 선물은 직접 취소할 수 없습니다. 고객센터로 문의해 주세요'),
      { status: 400 },
    )
  }

  const payment = await paymentRepository.findLatestPaymentByTarget('gift_order', giftId)
  if (!payment) throw Object.assign(new Error('결제 정보를 찾을 수 없습니다'), { status: 404 })

  const result = await paymentService.cancelPayment(giverUserId, payment.payment_id, {
    cancelReason: cancelReason ?? '수행 전 환불 요청 (SPEC-01 4-4)',
  })

  await giftRepository
    .addLog({
      logId: uuidv4(),
      giftId,
      prevStatus: gift.status,
      nextStatus: 'refunded',
      changedBy: giverUserId,
      changedByType: 'user',
      reason: cancelReason ?? '구매자 요청(수행 전 환불)',
    })
    .catch((e) => console.error('[giftService] cancelGift 로그 기록 실패:', giftId, e.message))

  return result
}
