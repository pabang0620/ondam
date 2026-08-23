import { v4 as uuidv4 } from 'uuid'
import { photoQueue } from '../../jobs/queue.js'
import * as photoRepository from './photoRepository.js'
import { extractS3KeyFromUrl, getPresignedUrl } from '../../utils/s3.js'
import { getVariantMetaByKey } from './photoResultSet.js'
import pool from '../../config/db.js'
import { omitId, pick } from '../../utils/dto.js'
import { toSafeFailureMessage } from '../../utils/failureMessages.js'

// ─── 실패 사유 응답 매핑 (보안 갭 2 수정) ──────────────────────────────────────
// [보안 수정] photoWorker.js는 실패 시 err.message(내부 원문 - 환경변수명, 벤더
// 응답 원문 등)를 photo_orders.fail_reason에 그대로 저장한다(운영 진단 목적,
// 그대로 둔다). 문제는 getOrder/getResult가 order 행을 통째로(omitId만 거쳐)
// 응답으로 흘려보내면서 fail_reason 원문까지 소유자에게 그대로 노출됐다는 점 -
// DB 저장은 건드리지 않고 응답 변환 시점에만 안전한 문구로 치환한다.
const toSafeOrderDto = (order) => ({
  ...omitId(order),
  fail_reason: toSafeFailureMessage(order.fail_reason),
})

// ─── 응답 화이트리스트 (내부 S3 키 원본 경로 유출 방지) ───────────────────────────
// [보안 수정] photo_files 행을 그대로(스프레드로) 응답에 흘려보내면 s3_key(내부
// 버킷 저장 경로, `photos/{userUuid}/{jobUuid}/...` 형태 - S3 업로드 폴더 컨벤션
// 문서 참고)까지 그대로 새어나간다. 클라이언트는 file_url(presigned/공개 URL)만
// 있으면 되고 원본 s3_key는 필요 없다 - 새 컬럼이 추가돼도 자동으로 새지 않도록
// 블랙리스트(omitId)가 아닌 화이트리스트(pick)로 필드를 명시한다.
const PHOTO_FILE_PUBLIC_FIELDS = [
  'file_id', 'order_id', 'kind', 'variant', 'file_url',
  'mime_type', 'file_size', 'width', 'height', 'created_at',
]
const toPhotoFileDto = (file) => pick(file, PHOTO_FILE_PUBLIC_FIELDS)

// ─── 주문 생성 ────────────────────────────────────────────────────────────────

export const createOrder = async (userId, { photoType, sourceImageUrl }) => {
  const orderId = uuidv4()
  const priceKrw = 9900

  await photoRepository.createOrder({ orderId, userId, photoType, priceKrw, sourceImageUrl })

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
  // 내부 AUTO_INCREMENT id는 외부에 노출하지 않는다(order_id UUID만 노출) - DEV-33
  // fail_reason은 안전한 문구로 치환한다(보안 갭 2 수정, toSafeOrderDto 참고)
  return toSafeOrderDto(order)
}

// ─── 주문 목록 조회 (paginated) ───────────────────────────────────────────────

export const getOrders = async (userId, { page, limit }) => {
  const offset = (page - 1) * limit
  const { orders, total } = await photoRepository.findOrdersByUserId(userId, { limit, offset })
  return {
    // 내부 AUTO_INCREMENT id는 외부에 노출하지 않는다(order_id UUID만 노출) - DEV-33
    // fail_reason은 안전한 문구로 치환한다(보안 갭 2 수정, toSafeOrderDto 참고)
    orders: orders.map(toSafeOrderDto),
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
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // FOR UPDATE - 동일 주문에 대한 동시 처리 시작 요청 경쟁 조건 방지
    const [[order]] = await conn.execute(
      'SELECT * FROM photo_orders WHERE order_id = ? AND deleted_at IS NULL FOR UPDATE',
      [orderId],
    )
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

    await conn.execute(
      'UPDATE photo_orders SET status = ?, updated_at = NOW() WHERE order_id = ?',
      ['processing', orderId],
    )

    await conn.commit()
    return { jobId }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
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

  const files = await photoRepository.findFilesByOrderId(orderId)

  // SPEC-02 2절(부분 실패): 세트 4종 중 일부만 실패하면 주문 상태는 'failed'로
  // 확정되지만(전액 환불 대상), 이미 성공한 결과물은 그대로 제공해야 한다
  // ("결과물은 그대로 가져가게 둔다"). completed가 아니어도 결과물이 하나라도
  // 있으면 조회를 허용한다. 결과물이 전혀 없는 처리중/실패 주문은 기존대로 차단.
  if (order.status !== 'completed' && !(order.status === 'failed' && files.length > 0)) {
    throw Object.assign(
      new Error(`처리가 완료되지 않았습니다 (현재: ${order.status})`),
      { status: 400 },
    )
  }

  const filesWithUrls = await Promise.all(
    files.map(async (file) => {
      const s3Key = file.s3_key || extractS3KeyFromUrl(file.file_url)
      // [2026-08-22 컷오버] SPEC-08 결정1: 세트 4종 구분은 이제 photo_files.variant
      // 컬럼이 SSOT다 - s3_key 파일명 파싱 우회는 제거했다(photoResultSet.js 헤더 참고).
      const variant = getVariantMetaByKey(file.variant)
      const variantFields = {
        variantKey: file.variant ?? null,
        variantLabel: variant?.label ?? null,
        variantOrder: variant?.order ?? null,
      }

      // 응답 화이트리스트 적용 - s3_key(내부 원본 경로)는 PHOTO_FILE_PUBLIC_FIELDS에
      // 없으므로 여기서부터 제외된다. s3Key 자체는 위에서 이미 presigned URL 발급에
      // 다 쓴 뒤라 응답 구성에는 필요 없다.
      const base = toPhotoFileDto(file)
      if (!s3Key) return { ...base, ...variantFields }
      try {
        const presignedUrl = await getPresignedUrl(s3Key, 3600) // 1시간
        return { ...base, file_url: presignedUrl, ...variantFields }
      } catch (err) {
        console.error('[photoService] presignedUrl 생성 실패:', err.message)
        return { ...base, file_url: null, ...variantFields }
      }
    }),
  )

  // 표시 순서: 원본(raw) 먼저, 그 다음 세트 정의 순서(복원본→색감유지본→규격본→
  // 정장본), 순서정보 없는 레거시 결과물은 생성 순서(findFilesByOrderId가 이미
  // created_at ASC로 정렬) 그대로 맨 뒤에 유지한다.
  const sortedFiles = [...filesWithUrls].sort((a, b) => {
    if (a.kind === 'raw' && b.kind !== 'raw') return -1
    if (b.kind === 'raw' && a.kind !== 'raw') return 1
    if (a.variantOrder == null && b.variantOrder == null) return 0
    if (a.variantOrder == null) return 1
    if (b.variantOrder == null) return -1
    return a.variantOrder - b.variantOrder
  })

  // order: 내부 AUTO_INCREMENT id는 외부에 노출하지 않는다(order_id UUID만 노출, DEV-33).
  // fail_reason은 안전한 문구로 치환한다(보안 갭 2 수정, toSafeOrderDto 참고)
  // files: 위에서 이미 PHOTO_FILE_PUBLIC_FIELDS 화이트리스트를 거쳐 id/s3_key 모두 제외됨.
  return { order: toSafeOrderDto(order), files: sortedFiles }
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
