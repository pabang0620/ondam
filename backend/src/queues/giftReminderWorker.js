/**
 * 선물 미수행 리마인드 워커 (SPEC-01 3-3, 4-6)
 *
 * giftReminderQueue.js가 등록한 반복 job('scan-reminders')을 소비한다. 매 실행마다
 * 두 가지 스캔을 순서대로 수행한다:
 *   1) scanAndSendReminders  - 아직 만료 전인 미수행 선물에 리마인드 발송
 *   2) scanAndExpireOverdueGifts - 이미 만료된 미수행 선물을 'expired'로 전이 + giver 통지
 * 둘 다 PK 커서 배치로 순회한다(LIMIT/OFFSET 금지 - willReminderWorker와 동일 이유,
 * 스캔 도중 상태 전이가 섞여도 후보가 밀리지 않는다).
 *
 * 시점 판단 근거 (완료 보고 3절):
 *   - 수행자(무계정 가능) SMS 최대 2회: 만료 30일 전 / 7일 전. 토큰 TTL이 90일(SPEC-01
 *     4-1)이라 30일 전이면 이미 60일이 지나도록 미수행이라는 뜻 - 첫 리마인드로 적절한
 *     시점이라 판단했다. 7일 전은 실질적인 마지막 기회 안내.
 *   - 구매자 1회: 만료 7일 전, in-app + SMS. 구매자는 회원이라 항상 in-app이 가능하고,
 *     "환불 또는 재발급"을 실제로 조작할 수 있는 사람이므로(4-6) 만료 임박 시점에
 *     맞춰 1회만 알리고 판단은 구매자에게 맡긴다(강요 금지 원칙 - SPEC-01 4-5와 동일 철학).
 *
 * 링크 미포함 설계 결정: gift_orders.perform_token_hash는 SHA-256 해시만 저장한다
 * (giftRepository.js 상단 주석 - "원본 토큰은 DB에 저장하지 않음"). will_beneficiaries.
 * invite_token(평문 저장)과 달리 gift 리마인드는 원본 토큰을 복원할 방법이 없다 - 매
 * 리마인드마다 giftService.resendLink처럼 토큰을 재발급하면 이전에 전달된 링크가
 * 매번 무효화되어 오히려 혼란을 준다. 그래서 수행자 리마인드는 "이전에 받은 링크를
 * 다시 찾아 이어가라"고 안내하고, 새 링크가 필요하면 구매자에게 재요청하도록 안내한다
 * (기존 토큰 보안 설계를 재구현하지 않고 그대로 존중 - 완료 보고 6절에 명시).
 */

import { Worker } from 'bullmq'
import redis from '../config/redis.js'
import { notificationQueue } from '../jobs/queue.js'
import * as notificationService from '../domains/notification/notificationService.js'
import * as authRepository from '../domains/auth/authRepository.js'
import * as giftRepository from '../domains/gift/giftRepository.js'
import { CLIENT_URL, transitionGift, notifyGiver } from '../domains/gift/giftShared.js'

const QUEUE_NAME = 'gift-reminder'
const BATCH_SIZE = 500

// SPEC-01 4-1: 토큰 TTL 90일 기준 - 리마인드 시점 상수 (판단 근거는 파일 상단 주석)
const RECIPIENT_FAR_WINDOW_DAYS = 30
const NEAR_WINDOW_DAYS = 7

// audit_logs.action - 마일스톤별 독립 1회 제한 (giftRepository.hasGiftReminderBeenSent)
const RECIPIENT_FAR_ACTION = 'gift_reminder_recipient_30d'
const RECIPIENT_NEAR_ACTION = 'gift_reminder_recipient_7d'
const GIVER_NEAR_ACTION = 'gift_reminder_giver_7d'

const daysUntil = (date) => (new Date(date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)

// 5060 배려 문구 원칙(SPEC-01 3-3): 죽음 언급 최소화, 열람/수행 강요 금지, 쉬운 말.
// isNear=false(30일 전)는 여유 있게, isNear=true(7일 전)는 조금 더 명확하게 안내한다.
const buildRecipientMessage = (gift, isNear) => {
  const name = gift.recipient_name ? `${gift.recipient_name}님, ` : ''
  if (!isNear) {
    return (
      `${name}이전에 받으신 선물 준비가 아직 진행 중이에요. 받으신 문자나 카카오톡에서 ` +
      '링크를 다시 찾아 천천히 이어서 진행해 주세요.'
    )
  }
  return (
    `${name}이전에 받으신 선물 준비가 아직 완료되지 않았어요. 받으신 문자나 카카오톡에서 ` +
    '링크를 다시 찾아 이어서 진행해 주세요. 링크를 찾기 어려우시면 보내주신 분께 다시 ' +
    '요청하시면 새로 받으실 수 있어요.'
  )
}

const buildGiverNearMessage = (gift) =>
  `${gift.recipient_name}님께 보낸 선물이 아직 준비 중이에요. 도움이 필요하시면 ` +
  `마이페이지에서 링크를 다시 보내드릴 수 있어요. ${CLIENT_URL}/gift/mine`

const buildGiverExpiredMessage = (gift) =>
  `${gift.recipient_name}님께 보낸 선물의 수행 기한이 지났어요. 자동으로 환불되지 않으니, ` +
  `마이페이지에서 환불받으시거나 링크를 다시 보내 기한을 연장하실 수 있어요. ${CLIENT_URL}/gift/mine`

// ─── 1) 만료 전 리마인드 ─────────────────────────────────────────────────────────

const sendRecipientReminder = async (gift, isNear, action) => {
  if (!gift.recipient_phone) return // 스키마상 NOT NULL이라 정상 경로에서는 발생하지 않음(방어)
  await notificationQueue.add('gift_perform_reminder', {
    type: 'sms',
    to: gift.recipient_phone,
    message: buildRecipientMessage(gift, isNear),
  })
  await giftRepository.recordGiftReminderSent(gift.gift_id, action, {
    productType: gift.product_type,
  })
}

const sendGiverReminder = async (gift) => {
  await notificationService
    .sendNotification(gift.giver_user_id, {
      // 전용 "선물 진행 리마인드" 타입이 없어(enums 확장 금지 - 완료 보고 참고) 선물
      // 링크 관련 통지 중 가장 근접한 'gift_link_sent'를 재사용한다(petPortrait가
      // photo_complete를 재사용하는 것과 동일한 기존 컨벤션).
      type: 'gift_link_sent',
      targetType: 'gift_order',
      targetId: gift.gift_id,
      title: '선물이 아직 진행 중이에요',
      message: buildGiverNearMessage(gift),
    })
    .catch((e) => console.error('[giftReminderWorker] giver in-app 알림 실패:', gift.gift_id, e.message))

  const giver = await authRepository.findByUserId(gift.giver_user_id).catch(() => null)
  if (giver?.phone) {
    await notificationQueue
      .add('gift_perform_reminder_giver', {
        type: 'sms',
        to: giver.phone,
        message: buildGiverNearMessage(gift),
      })
      .catch((e) => console.error('[giftReminderWorker] giver SMS 큐 등록 실패:', gift.gift_id, e.message))
  }

  await giftRepository.recordGiftReminderSent(gift.gift_id, GIVER_NEAR_ACTION, {
    productType: gift.product_type,
  })
}

const scanAndSendReminders = async () => {
  let cursorId = 0
  const stats = { candidates: 0, recipientFar: 0, recipientNear: 0, giverNear: 0 }

  for (;;) {
    const candidates = await giftRepository.findActiveReminderCandidatesBatch({ cursorId, batchSize: BATCH_SIZE })
    if (candidates.length === 0) break

    for (const gift of candidates) {
      stats.candidates += 1
      try {
        const daysLeft = daysUntil(gift.token_expires_at)

        if (daysLeft <= RECIPIENT_FAR_WINDOW_DAYS) {
          const alreadySentFar = await giftRepository.hasGiftReminderBeenSent(gift.gift_id, RECIPIENT_FAR_ACTION)
          if (!alreadySentFar) {
            await sendRecipientReminder(gift, false, RECIPIENT_FAR_ACTION)
            stats.recipientFar += 1
          }
        }

        if (daysLeft <= NEAR_WINDOW_DAYS) {
          const alreadySentNear = await giftRepository.hasGiftReminderBeenSent(gift.gift_id, RECIPIENT_NEAR_ACTION)
          if (!alreadySentNear) {
            await sendRecipientReminder(gift, true, RECIPIENT_NEAR_ACTION)
            stats.recipientNear += 1
          }

          const giverAlreadySent = await giftRepository.hasGiftReminderBeenSent(gift.gift_id, GIVER_NEAR_ACTION)
          if (!giverAlreadySent) {
            await sendGiverReminder(gift)
            stats.giverNear += 1
          }
        }
      } catch (err) {
        // 선물 1건 처리 실패가 배치 전체를 막지 않는다 (willReminderWorker와 동일 원칙)
        console.error(`[giftReminderWorker] giftId=${gift.gift_id} 리마인드 처리 실패:`, err.message)
      }
    }

    cursorId = candidates[candidates.length - 1].id
  }

  console.log(
    `[giftReminderWorker] scan-reminders 완료 - 후보 ${stats.candidates}건, ` +
      `수행자(30일전) ${stats.recipientFar}건, 수행자(7일전) ${stats.recipientNear}건, 구매자(7일전) ${stats.giverNear}건`,
  )
}

// ─── 2) 만료 도달 - 자동 환불하지 않고 giver에게 선택지 통지 (SPEC-01 4-6) ─────────────

const scanAndExpireOverdueGifts = async () => {
  let cursorId = 0
  let expiredCount = 0

  for (;;) {
    const candidates = await giftRepository.findExpiredCandidatesBatch({ cursorId, batchSize: BATCH_SIZE })
    if (candidates.length === 0) break

    for (const gift of candidates) {
      try {
        await transitionGift(gift, 'expired', {
          changedBy: null,
          changedByType: 'system',
          reason: '토큰 만료 - 리마인드 스캔 자동 전이 (SPEC-01 4-6)',
        })

        const giver = await authRepository.findByUserId(gift.giver_user_id).catch(() => null)
        await notifyGiver(gift, giver, {
          // 전용 "선물 만료" 타입이 없어(enums 확장 금지) giver의 조치가 필요하다는
          // 점에서 의미상 가장 가까운 'gift_declined'를 재사용한다(위 sendGiverReminder
          // 주석과 동일한 기존 컨벤션 - 신규 값 없이 근접값 재사용).
          type: 'gift_declined',
          title: '선물 수행 기한이 지났어요',
          message: buildGiverExpiredMessage(gift),
        })

        expiredCount += 1
      } catch (err) {
        console.error(`[giftReminderWorker] giftId=${gift.gift_id} 만료 전이 실패:`, err.message)
      }
    }

    cursorId = candidates[candidates.length - 1].id
  }

  console.log(`[giftReminderWorker] scan-expire 완료 - 만료 전이 ${expiredCount}건`)
}

// ─── 워커 등록 ────────────────────────────────────────────────────────────────

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    if (job.name === 'scan-reminders') {
      await scanAndSendReminders()
      await scanAndExpireOverdueGifts()
    }
  },
  {
    connection: redis,
    concurrency: 1,
    stalledInterval: 30000,
  },
)

worker.on('completed', (job) => {
  console.log(`[giftReminderWorker] job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  const maxAttempts = job?.opts?.attempts ?? 1
  console.error(
    `[giftReminderWorker] job ${job?.id} failed (attempt ${job?.attemptsMade}/${maxAttempts}):`,
    err.message,
  )
})

worker.on('error', (err) => {
  console.error('[giftReminderWorker] worker error:', err.message)
})

export default worker
