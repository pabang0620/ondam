import { v4 as uuidv4 } from 'uuid'
import { photoQueue } from '../../jobs/queue.js'
import * as photoRepository from './photoRepository.js'
import { extractS3KeyFromUrl } from '../../utils/s3.js'

// ─── 주문 생성 ────────────────────────────────────────────────────────────────

export const createOrder = async (userId, { photoType }) => {
  const orderId = uuidv4()
  const priceKrw = 9900

  await photoRepository.createOrder({ orderId, userId, photoType, priceKrw })

  return {
    orderId,
    photoType,
    priceKrw,
    status: 'pending_payment',
  }
}

// ─── 주문 단건 조회 ───────────────────────────────────────────────────────────

export const getOrder = async (userId, orderId) => {
  const order = await photoRepository.findOrderById(orderId)
  if (!order) {
    throw Object.assign(new Error('주문을 찾을 수 없습니다'), { status: 404 })
  }
  if (order.user_id !== userId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  return order
}

// ─── 주문 목록 조회 (paginated) ───────────────────────────────────────────────

export const getOrders = async (userId, { page, limit }) => {
  const offset = (page - 1) * limit
  const { orders, total } = await photoRepository.findOrdersByUserId(userId, { limit, offset })
  return {
    orders,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

// ─── AI 처리 시작 ─────────────────────────────────────────────────────────────

export const startProcessing = async (orderId, userId) => {
  const order = await photoRepository.findOrderById(orderId)
  if (!order) {
    throw Object.assign(new Error('주문을 찾을 수 없습니다'), { status: 404 })
  }
  if (order.user_id !== userId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  if (order.status !== 'paid') {
    throw Object.assign(
      new Error(`처리를 시작할 수 없는 상태입니다 (현재: ${order.status})`),
      { status: 400 },
    )
  }

  const jobId = uuidv4()
  const bullmqJob = await photoQueue.add('enhance', {
    orderId,
    userId,
    s3Key: extractS3KeyFromUrl(order.source_image_url),
    photoType: order.photo_type,
  })

  await photoRepository.createAiJob({
    jobId,
    userId,
    bullmqJobId: String(bullmqJob.id),
    targetId: orderId,
  })

  await photoRepository.updateOrderStatus(orderId, {
    prevStatus: 'paid',
    nextStatus: 'processing',
    changedBy: userId,
    changedByType: 'system',
    reason: 'AI 처리 시작',
  })

  return { jobId }
}

// ─── 작업 상태 조회 (폴링) ────────────────────────────────────────────────────

export const getJobStatus = async (orderId, userId) => {
  const order = await photoRepository.findOrderById(orderId)
  if (!order) {
    throw Object.assign(new Error('주문을 찾을 수 없습니다'), { status: 404 })
  }
  if (order.user_id !== userId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }

  const aiJob = await photoRepository.findAiJobByTargetId(orderId)

  return {
    orderId,
    status: order.status,
    jobStatus: aiJob?.job_status ?? null,
    progress: aiJob?.progress ?? 0,
    jobId: aiJob?.job_id ?? null,
  }
}

// ─── 처리 결과 조회 ───────────────────────────────────────────────────────────

export const getResult = async (orderId, userId) => {
  const order = await photoRepository.findOrderById(orderId)
  if (!order) {
    throw Object.assign(new Error('주문을 찾을 수 없습니다'), { status: 404 })
  }
  if (order.user_id !== userId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  if (order.status !== 'completed') {
    throw Object.assign(
      new Error(`처리가 완료되지 않았습니다 (현재: ${order.status})`),
      { status: 400 },
    )
  }

  const files = await photoRepository.findFilesByOrderId(orderId)
  return { order, files }
}

// ─── 실패 주문 재처리 ─────────────────────────────────────────────────────────

export const retryOrder = async (orderId, userId) => {
  const order = await photoRepository.findOrderById(orderId)
  if (!order) {
    throw Object.assign(new Error('주문을 찾을 수 없습니다'), { status: 404 })
  }
  if (order.user_id !== userId) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  if (order.status !== 'failed') {
    throw Object.assign(
      new Error(`실패 상태인 주문만 재처리할 수 있습니다 (현재: ${order.status})`),
      { status: 400 },
    )
  }

  // 재처리: paid 상태로 되돌린 뒤 startProcessing 재호출
  await photoRepository.updateOrderStatus(orderId, {
    prevStatus: 'failed',
    nextStatus: 'paid',
    changedBy: userId,
    changedByType: 'user',
    reason: '사용자 재처리 요청',
  })

  return startProcessing(orderId, userId)
}
