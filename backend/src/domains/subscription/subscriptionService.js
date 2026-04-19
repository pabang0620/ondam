import { v4 as uuidv4 } from 'uuid'
import { encryptString } from '../../utils/kms.js'
import * as subscriptionRepository from './subscriptionRepository.js'

/**
 * 구독 플랜 상수
 */
export const PLANS = {
  pet_archive: { price: 4900, name: '반려동물 스탠다드' },
  will_premium: { price: 1900, name: '유언장 보관' },
  all: { price: 9900, name: '전체' },
}

/**
 * 날짜에 1개월 추가 (월말 처리 포함)
 * @param {Date} date
 * @returns {Date}
 */
const addOneMonth = (date) => {
  const result = new Date(date)
  result.setMonth(result.getMonth() + 1)
  return result
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
 * 구독 시작
 * - 중복 활성 구독 확인
 * - 빌링키 KMS 암호화 후 저장
 * - nextBillingAt = now + 1개월
 */
export const subscribe = async (userId, { plan, tossBillingKey }) => {
  if (!PLANS[plan]) {
    throw Object.assign(new Error('유효하지 않은 구독 플랜입니다'), { status: 400 })
  }
  if (!tossBillingKey) {
    throw Object.assign(new Error('빌링키는 필수입니다'), { status: 400 })
  }

  // 중복 활성 구독 확인
  const existing = await subscriptionRepository.findActiveSubscription(userId, plan)
  if (existing) {
    throw Object.assign(new Error('이미 활성 중인 구독이 있습니다'), { status: 409 })
  }

  // 빌링키 KMS 암호화
  const { encrypted, kmsKeyId } = await encryptString(tossBillingKey)

  const subscriptionId = uuidv4()
  const nextBillingAt = addOneMonth(new Date())

  const subscription = await subscriptionRepository.createSubscription({
    subscriptionId,
    userId,
    plan,
    billingKeyEncrypted: encrypted,
    billingKmsKeyId: kmsKeyId,
    priceKrw: PLANS[plan].price,
    nextBillingAt,
  })

  return {
    subscriptionId: subscription.subscription_id,
    plan: subscription.plan,
    priceKrw: subscription.price_krw,
    nextBillingAt: subscription.next_billing_at,
  }
}

/**
 * 사용자 구독 목록 조회
 */
export const getSubscriptions = async (userId) => {
  return subscriptionRepository.findSubscriptionsByUserId(userId)
}

/**
 * 구독 취소
 * - 소유권 확인
 * - sub_status='canceled' + 로그 INSERT
 */
export const cancelSubscription = async (userId, subscriptionId) => {
  const subscription = await subscriptionRepository.findSubscriptionById(subscriptionId)
  if (!subscription) {
    throw Object.assign(new Error('구독 정보를 찾을 수 없습니다'), { status: 404 })
  }
  if (subscription.user_id !== userId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  if (subscription.sub_status === 'canceled') {
    throw Object.assign(new Error('이미 취소된 구독입니다'), { status: 400 })
  }

  // 상태 변경 + 로그 기록
  await subscriptionRepository.updateSubscriptionStatus(subscriptionId, {
    subStatus: 'canceled',
    prevStatus: subscription.sub_status,
    changedBy: userId,
    changedByType: 'user',
    reason: '사용자 취소',
  })

  // canceled_at, cancel_reason 필드 업데이트
  const updated = await subscriptionRepository.cancelSubscription(subscriptionId, {
    cancelReason: '사용자 취소',
  })

  return updated
}
