import { Worker } from 'bullmq'
import { v4 as uuidv4 } from 'uuid'
import redis from '../../config/redis.js'
import pool from '../../config/db.js'
import { notificationQueue } from '../queue.js'
import { downloadFromS3, uploadToS3, extractS3KeyFromUrl } from '../../utils/s3.js'
import { getIo } from '../../config/socket.js'
import { buildResultSet } from '../../domains/photo/photoResultSet.js'
import * as paymentService from '../../domains/payment/paymentService.js'
import { refundGiftFallback } from '../../domains/gift/giftShared.js'
import * as photoRepository from '../../domains/photo/photoRepository.js'

const QUEUE_NAME = 'photo'
const AI_MOCK = process.env.AI_MOCK === 'true'
// 세트(4종) 결과물당 실패 시 자동 재시도 횟수 (SPEC-02 2절 "실패 항목은 재시도").
// BullMQ 잡 레벨 attempts(queue.js defaultJobOptions, 현재 3)와는 별개다 - 잡 레벨
// 재시도는 세트 전체를 처음부터 다시 돌려 이미 성공한 항목까지 낭비하므로, 항목
// 단위 실패는 여기서 먼저 소진하고 잡 레벨 재시도는 "사전 단계(전처리) 오류"에만
// 맡긴다.
const VARIANT_MAX_ATTEMPTS = 2

// ─── DB 헬퍼 ─────────────────────────────────────────────────────────────────

const updateAiJob = async (jobId, fields) => {
  const ALLOWED = ['job_status', 'progress', 'result_url', 'error_message', 'started_at', 'completed_at']
  const entries = Object.entries(fields).filter(([k]) => ALLOWED.includes(k))
  if (!entries.length) return

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), jobId]

  await pool.execute(
    `UPDATE ai_jobs SET ${setClauses}, updated_at = NOW() WHERE bullmq_job_id = ? AND deleted_at IS NULL`,
    values,
  )
}

const updatePhotoOrder = async (orderId, fields) => {
  const ALLOWED = ['status', 'completed_at', 'fail_reason']
  const entries = Object.entries(fields).filter(([k]) => ALLOWED.includes(k))
  if (!entries.length) return

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), orderId]

  await pool.execute(
    `UPDATE photo_orders SET ${setClauses}, updated_at = NOW() WHERE order_id = ? AND deleted_at IS NULL`,
    values,
  )
}

// photo_files.mime_type/file_size는 NOT NULL(기본값 없음) - 누락 시 INSERT가 항상
// 실패해 AI 처리 성공 후 결과 저장이 깨진다. photoRepository.savePhotoFile과 동일하게 채운다.
// [2026-08-22 컷오버] variant 컬럼 신설(마이그레이션 c) - s3_key 파일명 접미사 우회를
// 걷어내고 컬럼에 직접 기록한다. raw(원본) 기록 경로는 variant 개념이 없으므로 null.
const insertPhotoFile = async ({ fileId, orderId, kind, variant, fileUrl, s3Key, mimeType, fileSize }) => {
  await pool.execute(
    `INSERT INTO photo_files (file_id, order_id, kind, variant, file_url, s3_key, mime_type, file_size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [fileId, orderId, kind, variant ?? null, fileUrl, s3Key, mimeType, fileSize],
  )
}

const insertNotification = async ({ userId, type, targetType = 'photo_order', referenceId, title, message }) => {
  const notifId = uuidv4()
  await pool.execute(
    `INSERT INTO notifications
       (notification_id, user_id, notification_type, target_type, target_id,
        title, message, is_read)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [notifId, userId, type, targetType, referenceId ?? null, title, message],
  )
}

const findUserEmail = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT email FROM users WHERE user_id = ? AND deleted_at IS NULL LIMIT 1`,
    [userId],
  )
  return rows[0]?.email ?? null
}

// ─── SPEC-02 2절(DEV-08): AI 처리 최종 실패 시 후처리 (로그 + 자동 환불 + 통지) ──────
// processPhoto의 부분 실패 분기(세트 일부만 실패)와 worker.on('failed')의 전량 실패
// 분기 양쪽에서 공유한다 - 두 경로가 각자 구현하면 환불 로직이 어긋날 위험이 크다.
// 호출 시점에는 이미 photo_orders.status='failed'로 UPDATE된 뒤라고 가정한다.
const finalizeOrderFailure = async ({ orderId, userId, failReason }) => {
  // photo_order_logs 기록 (append-only). photo_orders 상태 머신상 AI 처리 실패는
  // 항상 'processing'에서만 전이되므로(startProcessing만 processing으로 바꾸고,
  // 그 다음 도달 가능한 상태는 completed/failed뿐) prevStatus를 다시 조회하지 않고
  // 'processing'으로 고정해도 안전하다.
  await pool.execute(
    `INSERT INTO photo_order_logs
       (log_id, order_id, prev_status, next_status, changed_by, changed_by_type, reason, created_at)
     VALUES (?, ?, 'processing', 'failed', ?, 'system', ?, NOW())`,
    [uuidv4(), orderId, userId, String(failReason).slice(0, 500)],
  ).catch((err) => console.error('[photoWorker] photo_order_logs 기록 실패:', err.message))

  // 자동 환불 (payment 도메인의 기존 취소 로직을 재사용하는 refundForAiFailure 경유,
  // 결제 도메인 로직 자체는 재설계하지 않는다)
  const refundResult = await paymentService
    .refundForAiFailure('photo_order', orderId, { reason: `AI 처리 실패: ${failReason}` })
    .catch((err) => {
      console.error('[photoWorker] refundForAiFailure 호출 자체 실패 (수동 환불 필요):', orderId, err.message)
      return { refunded: false, reason: 'refund_call_threw' }
    })

  // [마감 공백 처리] photo_order 경로에서 결제를 못 찾았다면(no_completed_payment)
  // 선물로 결제된 콘텐츠일 수 있다 - gift 역조회로 환불을 재시도한다(완료 보고 2절).
  // 자녀가 선물했는데 AI가 실패하면 지금까지는 환불이 전혀 나가지 않았다.
  let effectiveRefund = refundResult
  if (refundResult.reason === 'no_completed_payment') {
    const giftFallback = await refundGiftFallback({
      productType: 'photo',
      contentId: orderId,
      reason: `AI 처리 실패: ${failReason}`,
    }).catch((err) => {
      console.error('[photoWorker] gift 환불 역조회 실패:', orderId, err.message)
      return null
    })
    if (giftFallback?.refundResult?.refunded) {
      effectiveRefund = giftFallback.refundResult
    }
  }

  const message = effectiveRefund.refunded
    ? '죄송합니다. 사진 처리에 실패해 결제하신 금액을 전액 환불해 드렸어요. 카드사에 따라 환불 반영까지 며칠 걸릴 수 있어요. 다시 시도해 보시겠어요?'
    : effectiveRefund.reason === 'no_completed_payment'
      ? '사진 처리에 실패했습니다. 결제된 내역이 없어 별도 환불 없이 종료돼요. 다시 시도해 보시겠어요?'
      : '죄송합니다. 사진 처리에 실패했고, 환불 처리 중 문제가 발생했습니다. 저희가 곧 확인해서 환불해 드릴게요. 급하시면 고객센터로 연락해 주세요.'

  // [2026-08-22 컷오버] AI 실패 자동 환불 통지는 payment_failed(결제 자체 실패)를
  // 의미상 오용해 왔다. 마이그레이션 c로 notifications.notification_type ENUM에
  // 전용 값 'ai_processing_refunded'가 추가되어 이제 정확한 타입으로 기록한다.
  await insertNotification({
    userId,
    type: 'ai_processing_refunded',
    targetType: 'photo_order',
    referenceId: orderId,
    title: '사진 처리 실패 안내',
    message,
  }).catch((err) => console.error('[photoWorker] 실패 알림 INSERT 오류:', err.message))

  const email = await findUserEmail(userId).catch((err) => {
    console.error('[photoWorker] 사용자 이메일 조회 실패:', err.message)
    return null
  })
  if (email) {
    await notificationQueue.add('photo_order_failed_refund', {
      type: 'email',
      to: email,
      subject: '[온담] 사진 처리 실패 안내',
      message,
    }).catch((err) => console.error('[photoWorker] 실패 알림 큐 등록 오류:', err.message))
  }
}

// ─── Gemini 설정 ──────────────────────────────────────────────────────────────

// 레거시 단일 처리 타입 (SPEC-08 결정1 이전에 생성된 주문과의 하위호환용).
// funeral/id/job은 이제 photoResultSet.buildResultSet()의 "세트" 경로로만 처리된다 -
// 여기 남겨두면 프롬프트 텍스트가 photoResultSet.js(SUIT_PROMPTS)와 이중 관리되므로
// 제거했다. photo_orders.photo_type ENUM에는 여전히 이 값들이 남아있으니(스키마
// 변경 금지) 과거에 이 타입으로 생성된 주문은 기존과 동일하게 단일 결과물만 받는다.
const LEGACY_PHOTO_PROMPTS = {
  enhance:  '이 사진의 화질을 향상시켜 주세요. 노이즈 제거, 선명도 개선, 색상 보정.',
  colorize: '이 흑백 사진을 자연스럽게 컬러 사진으로 변환해 주세요.',
  restore:  '이 손상되거나 오래된 사진을 복원해 주세요. 스크래치 제거, 색바램 복원, 화질 개선.',
  removebg: '이 사진의 배경을 제거하고 흰색 배경으로 교체해 주세요. 인물/피사체만 남기세요.',
}

// 반려동물 AI 초상화 스타일별 프롬프트 (petService.requestPortrait가 큐에 함께
// 실어 보내는 `style` 값을 여기서 소비한다). 허용값은 zod 스키마 기준 oil/
// watercolor/illustration 3종, 미전송 시 zod가 'oil'을 기본값으로 채운다.
// 반려동물 "추모" 초상화라는 맥락 - 화풍만 입히고 생김새·털무늬·표정은
// 왜곡하지 않는 방향으로 작성했다(과장된 만화체 금지, 추모 정서 훼손 방지).
// 알 수 없는 값이 와도 죽지 않도록 항상 PORTRAIT_STYLE_PROMPTS[style] ??
// PORTRAIT_STYLE_PROMPTS.oil 형태로 폴백한다.
const PORTRAIT_STYLE_PROMPTS = {
  oil: '이 반려동물의 생김새와 털 무늬, 눈빛, 특징적인 표정을 정확히 유지하면서 ' +
    '클래식 유화(oil painting) 화풍의 추모 초상화로 편집해 주세요. 붓터치와 ' +
    '은은한 색감이 느껴지는 격조 있는 스타일로 표현하되, 반려동물의 실제 ' +
    '이목구비 비율은 왜곡하지 마세요. 배경은 차분하고 따뜻한 단색 톤으로.',
  watercolor: '이 반려동물의 생김새와 털 무늬, 눈빛, 특징적인 표정을 정확히 ' +
    '유지하면서 은은하게 번지는 수채화(watercolor) 화풍의 추모 초상화로 ' +
    '편집해 주세요. 부드럽고 투명한 색감으로 따뜻한 분위기를 내되, 반려동물의 ' +
    '실제 생김새는 사실적으로 유지하세요. 배경은 여백이 있는 담백한 톤으로.',
  illustration: '이 반려동물의 생김새와 털 무늬, 눈빛, 특징적인 표정을 정확히 ' +
    '유지하면서 정갈한 손그림 일러스트 화풍의 추모 초상화로 편집해 주세요. ' +
    '선이 깔끔하고 색감이 차분한 스타일로 표현하되, 과장되거나 만화적으로 ' +
    '왜곡하지 말고 반려동물의 실제 생김새를 사실적으로 담아주세요.',
}

// ─── Gemini 이미지 편집 공통 호출 ───────────────────────────────────────────────

const callGeminiImageEdit = async (genai, Modality, base64, promptText) => {
  const response = await genai.models.generateContent({
    model: 'gemini-2.0-flash-exp-image-generation',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: promptText },
        ],
      },
    ],
    config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
  })

  const candidates = response.candidates ?? []
  for (const candidate of candidates) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, 'base64')
      }
    }
  }

  throw new Error('Gemini API 응답에서 이미지 데이터를 찾을 수 없습니다')
}

// 원본 업로드 사진도 photo_files에 kind='raw'로 기록해 결과 화면 Before/After에
// 쓴다 (기존에는 어디서도 INSERT되지 않아 rawFile이 항상 비어있던 결함).
// append-only 테이블이므로 재처리(retryOrder) 시 중복 기록을 피하려 존재 여부를
// 먼저 확인한다.
const ensureRawFileRecorded = async ({ orderId, s3Key, sourceFileSize }) => {
  if (!s3Key) return
  const [existing] = await pool.execute(
    `SELECT file_id FROM photo_files WHERE order_id = ? AND kind = 'raw' AND deleted_at IS NULL LIMIT 1`,
    [orderId],
  )
  if (existing.length > 0) return

  await insertPhotoFile({
    fileId: uuidv4(),
    orderId,
    kind: 'raw',
    variant: null, // 원본에는 세트 변형 개념이 없다 (3-2절 참고)
    fileUrl: `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`,
    s3Key,
    mimeType: 'image/jpeg',
    fileSize: sourceFileSize ?? 0,
  }).catch((err) => {
    // 원본 기록 실패는 세트 처리 자체를 막지 않는다 - Before 이미지 없이도 결과는 제공한다
    console.error('[photoWorker] raw 파일 기록 실패:', err.message)
  })
}

// 결과물 항목 1개 생성 + 저장, 실패 시 VARIANT_MAX_ATTEMPTS까지 자동 재시도
// (SPEC-02 2절). 성공 시 photo_files INSERT까지 완료한 상태로 반환한다.
const runVariantWithRetry = async ({ variant, genai, Modality, base64, orderId, userId }) => {
  let lastErr = null

  for (let attempt = 1; attempt <= VARIANT_MAX_ATTEMPTS; attempt++) {
    try {
      const resultS3Key = `photos/${userId}/${orderId}/result_${variant.key}.jpg`
      let resultUrl
      let fileSize = 0

      if (AI_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 800))
        resultUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${resultS3Key}`
      } else {
        const resultBuffer = await callGeminiImageEdit(genai, Modality, base64, variant.prompt)
        fileSize = resultBuffer.length
        resultUrl = await uploadToS3(resultS3Key, resultBuffer, { contentType: 'image/jpeg' })
      }

      await insertPhotoFile({
        fileId: uuidv4(),
        orderId,
        kind: 'enhanced',
        variant: variant.key,
        fileUrl: resultUrl,
        s3Key: resultS3Key,
        mimeType: 'image/jpeg',
        fileSize,
      })

      return { ok: true, key: variant.key, label: variant.label, url: resultUrl }
    } catch (err) {
      lastErr = err
      console.error(
        `[photoWorker] variant ${variant.key} 시도 ${attempt}/${VARIANT_MAX_ATTEMPTS} 실패:`,
        err.message,
      )
    }
  }

  return { ok: false, key: variant.key, label: variant.label, error: lastErr?.message ?? 'unknown error' }
}

// ─── AI 처리 로직 ─────────────────────────────────────────────────────────────

const processPhoto = async (jobData, bullmqJobId) => {
  const { orderId, userId, photoType, s3Key } = jobData

  // 1. ai_jobs: running
  await updateAiJob(bullmqJobId, {
    job_status: 'running',
    started_at: new Date(),
  })

  // 2. photo_orders: processing
  await updatePhotoOrder(orderId, { status: 'processing' })

  // [보안 수정 - defense in depth] 초상권/AI 생성물 동의 재확인. 큐 등록
  // (startProcessing) 시점에는 동의가 있었더라도, BullMQ 대기열에서 실제 워커가
  // 이 잡을 집는 시점 사이에 사용자가 동의를 철회했을 수 있다(설정 화면에서
  // 언제든 재동의/철회 가능 - user_consents는 append-only라 철회도 새 행으로
  // 즉시 반영된다). 벤더 API(Gemini) 호출 직전, 서비스 계층 게이트(assertPhotoConsents)
  // 와 동일한 조건으로 다시 확인한다. 실패 시 throw해 BullMQ 잡 레벨 재시도
  // (backoff)에 맡긴다 - 재시도를 거쳐도 동의가 복원되지 않으면 최종적으로
  // worker.on('failed')가 자동 환불을 수행한다.
  const [portraitConsent, aiGenConsent] = await Promise.all([
    photoRepository.findPortraitConsent(userId),
    photoRepository.findAiGenerationConsent(userId),
  ])
  const photoConsentOk = (c) => Boolean(c && c.is_agreed === 1)
  if (!photoConsentOk(portraitConsent) || !photoConsentOk(aiGenConsent)) {
    throw Object.assign(new Error('동의가 확인되지 않아 처리를 중단합니다'), { status: 400 })
  }

  getIo()?.to(`user:${userId}`).emit('job:progress', {
    jobId: bullmqJobId,
    jobType: 'photo',
    status: 'running',
    progress: 0,
    resultUrl: null,
  })

  // 3. 세트(용도) 또는 레거시(단일 처리) 결과물 정의 확정 - 사전 단계 오류는
  // 여기서 throw해 BullMQ 잡 레벨 재시도(backoff)에 맡긴다.
  const resultSet = buildResultSet(photoType)
    ?? (LEGACY_PHOTO_PROMPTS[photoType]
      ? [{ key: photoType, label: '보정본', prompt: LEGACY_PHOTO_PROMPTS[photoType] }]
      : null)

  if (!resultSet) {
    throw Object.assign(new Error(`지원하지 않는 photoType: ${photoType}`), { status: 400 })
  }

  let genai = null
  let Modality = null
  let base64 = null
  let sourceFileSize = 0

  if (AI_MOCK) {
    await ensureRawFileRecorded({ orderId, s3Key, sourceFileSize: 0 })
  } else {
    if (!process.env.GEMINI_API_KEY) {
      throw Object.assign(new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다'), { status: 500 })
    }

    const genaiModule = await import('@google/genai')
    Modality = genaiModule.Modality
    genai = new genaiModule.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    // S3에서 원본 이미지 1회만 다운로드 - raw 기록과 세트 생성 양쪽에 재사용
    const imageBuffer = await downloadFromS3(s3Key)
    base64 = imageBuffer.toString('base64')
    sourceFileSize = imageBuffer.length

    await ensureRawFileRecorded({ orderId, s3Key, sourceFileSize })
  }

  // 4. 세트 항목별 생성 (실패해도 다른 항목은 계속 진행 - SPEC-02 "성공분은 제공")
  const succeeded = []
  const failed = []
  for (const variant of resultSet) {
    const outcome = await runVariantWithRetry({ variant, genai, Modality, base64, orderId, userId })
    if (outcome.ok) succeeded.push(outcome)
    else failed.push(outcome)
  }

  if (succeeded.length === 0) {
    // 전량 실패 - 인프라/일시 장애일 가능성이 높다. 이 시점까지 저장된 결과물이
    // 없으므로 throw해 BullMQ 잡 레벨 재시도(backoff)에 맡긴다.
    throw new Error(failed.map((f) => `${f.label}(${f.key}): ${f.error}`).join(' / '))
  }

  if (failed.length > 0) {
    // 부분 실패 - SPEC-02 2절: 성공분은 그대로 보관하고(이미 INSERT됨), 세트 전체를
    // 다시 실행하지 않는다(BullMQ 재시도 X, throw하지 않음). 주문은 failed로 확정한
    // 뒤 finalizeOrderFailure가 전액 자동 환불 + 통지 + 로그까지 수행한다.
    const failReason =
      `일부 결과물 생성 실패: ${failed.map((f) => f.label).join(', ')} ` +
      `(성공분 ${succeeded.length}건은 보관됨, 전액 환불 대상)`

    await updateAiJob(bullmqJobId, {
      job_status: 'failed',
      error_message: failReason,
      completed_at: new Date(),
    })
    await updatePhotoOrder(orderId, { status: 'failed', fail_reason: failReason })

    getIo()?.to(`user:${userId}`).emit('job:progress', {
      jobId: bullmqJobId,
      jobType: 'photo',
      status: 'failed',
      progress: 0,
      resultUrl: null,
    })

    console.error(`[photoWorker] order ${orderId} 부분 실패:`, failReason)

    await finalizeOrderFailure({ orderId, userId, failReason })
    return
  }

  // 5. 전량 성공 - ai_jobs: completed (result_url은 세트 중 첫 항목을 대표값으로 기록)
  await updateAiJob(bullmqJobId, {
    job_status: 'completed',
    progress: 100,
    result_url: succeeded[0].url,
    completed_at: new Date(),
  })

  // 6. photo_orders: completed
  await updatePhotoOrder(orderId, {
    status: 'completed',
    completed_at: new Date(),
  })

  getIo()?.to(`user:${userId}`).emit('job:progress', {
    jobId: bullmqJobId,
    jobType: 'photo',
    status: 'completed',
    progress: 100,
    resultUrl: succeeded[0].url,
  })

  // 7. notifications INSERT
  await insertNotification({
    userId,
    type: 'photo_complete',
    targetType: 'photo_order',
    referenceId: orderId,
    title: '사진 처리 완료',
    message: `사진 AI 처리가 완료되었습니다. 결과물 ${succeeded.length}장을 확인해 보세요.`,
  })
}

// ─── 펫 AI 초상화 처리 (petService.requestPortrait 프로듀서 계약) ──────────────────
// jobData: { petId, userId, photoUrl, style } - photo_orders/photo_files는 관여하지
// 않는다. ai_jobs.result_url에 결과 이미지 URL을 기록하면 petService.getPortraitStatus가
// 그 값을 읽어 상태를 반환한다. pet_media.portrait_style 컬럼은 DB에 존재하지 않으므로
// (PRD 기획 메모였을 뿐 실제 스키마엔 없음) style을 별도 저장하지 않는다 - 결과
// 이미지 자체에 화풍이 반영되는 것으로 끝난다.

const processPetPortrait = async (jobData, bullmqJobId) => {
  const { petId, userId, photoUrl, style } = jobData

  await updateAiJob(bullmqJobId, {
    job_status: 'running',
    started_at: new Date(),
  })

  getIo()?.to(`user:${userId}`).emit('job:progress', {
    jobId: bullmqJobId,
    jobType: 'photo',
    status: 'running',
    progress: 0,
    resultUrl: null,
  })

  const resultS3Key = `pets/${userId}/${petId}/portrait_result.jpg`
  let resultUrl

  if (AI_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    resultUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${resultS3Key}`
  } else {
    if (!process.env.GEMINI_API_KEY) {
      throw Object.assign(new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다'), { status: 500 })
    }

    const s3Key = extractS3KeyFromUrl(photoUrl)
    if (!s3Key) {
      throw Object.assign(new Error('원본 사진 URL이 올바르지 않습니다'), { status: 400 })
    }

    const genaiModule = await import('@google/genai')
    const genai = new genaiModule.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const imageBuffer = await downloadFromS3(s3Key)
    const base64 = imageBuffer.toString('base64')

    // 알 수 없거나 누락된 style이 와도 죽지 않게 oil로 폴백 (zod가 기본값으로
    // 'oil'을 채우지만, 큐 재시도 등으로 옛 페이로드가 들어올 가능성까지 방어)
    const stylePrompt = PORTRAIT_STYLE_PROMPTS[style] ?? PORTRAIT_STYLE_PROMPTS.oil
    const resultBuffer = await callGeminiImageEdit(genai, genaiModule.Modality, base64, stylePrompt)
    resultUrl = await uploadToS3(resultS3Key, resultBuffer, { contentType: 'image/jpeg' })
  }

  await updateAiJob(bullmqJobId, {
    job_status: 'completed',
    progress: 100,
    result_url: resultUrl,
    completed_at: new Date(),
  })

  getIo()?.to(`user:${userId}`).emit('job:progress', {
    jobId: bullmqJobId,
    jobType: 'photo',
    status: 'completed',
    progress: 100,
    resultUrl,
  })

  // notifications - 'pet_portrait' 전용 타입이 NOTIFICATION_TYPE ENUM에 없어
  // 가장 근접한 'photo_complete'(AI 사진 처리 완료)를 재사용, target_type='pet'
  await insertNotification({
    userId,
    type: 'photo_complete',
    targetType: 'pet',
    referenceId: petId,
    title: 'AI 초상화 완료',
    message: '반려동물 AI 초상화 생성이 완료되었습니다.',
  })
}

// ─── 워커 등록 ────────────────────────────────────────────────────────────────

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    // petService.requestPortrait는 petId를 담아 큐에 등록한다 - orderId 기반
    // 사진주문 흐름과 데이터 계약이 다르므로 분기한다 (G6-1)
    if (job.data.petId) {
      await processPetPortrait(job.data, String(job.id))
    } else {
      await processPhoto(job.data, String(job.id))
    }
  },
  {
    connection: redis,
    concurrency: Number(process.env.PHOTO_WORKER_CONCURRENCY) || 3,
    stalledInterval: 30000,
  },
)

worker.on('completed', (job) => {
  console.log(`[photoWorker] job ${job.id} completed`)
})

// 최대 재시도 소진 후에만 DB 상태를 failed로 확정
worker.on('failed', async (job, err) => {
  const maxAttempts = job?.opts?.attempts ?? 1
  console.error(`[photoWorker] job ${job?.id} failed (attempt ${job?.attemptsMade}/${maxAttempts}):`, err.message)

  if (!job || job.attemptsMade < maxAttempts) return

  const { orderId, petId, userId } = job.data

  await updateAiJob(String(job.id), {
    job_status: 'failed',
    error_message: err.message,
    completed_at: new Date(),
  }).catch((dbErr) => console.error('[photoWorker] ai_jobs failed 업데이트 오류:', dbErr.message))

  // 펫 초상화 잡은 photo_orders/결제 대상과 무관 - orderId가 있을 때만 주문 실패
  // 처리(로그+환불+통지)를 수행한다. 펫 초상화는 별도 결제 target_type이 없다
  // (payments.target_type ENUM에 'pet' 없음) - 구독료에 포함된 부가 기능이라
  // 환불 대상 자체가 아니다.
  if (!petId && orderId) {
    await updatePhotoOrder(orderId, {
      status: 'failed',
      fail_reason: err.message,
    }).catch((dbErr) => console.error('[photoWorker] photo_orders failed 업데이트 오류:', dbErr.message))

    await finalizeOrderFailure({ orderId, userId, failReason: err.message })
  }

  getIo()?.to(`user:${userId}`).emit('job:progress', {
    jobId: String(job.id),
    jobType: 'photo',
    status: 'failed',
    progress: 0,
    resultUrl: null,
  })
})

worker.on('error', (err) => {
  console.error('[photoWorker] worker error:', err.message)
})

export default worker
