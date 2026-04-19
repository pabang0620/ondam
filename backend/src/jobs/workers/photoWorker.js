import { Worker } from 'bullmq'
import { v4 as uuidv4 } from 'uuid'
import redis from '../../config/redis.js'
import pool from '../../config/db.js'
import { downloadFromS3, uploadToS3 } from '../../utils/s3.js'

const QUEUE_NAME = 'photo'
const AI_MOCK = process.env.AI_MOCK === 'true'

// ─── DB 헬퍼 ─────────────────────────────────────────────────────────────────

const updateAiJob = async (jobId, fields) => {
  const ALLOWED = ['job_status', 'progress', 'result_url', 'error_message', 'started_at', 'completed_at']
  const entries = Object.entries(fields).filter(([k]) => ALLOWED.includes(k))
  if (!entries.length) return

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), jobId]

  await pool.query(
    `UPDATE ai_jobs SET ${setClauses}, updated_at = NOW() WHERE bullmq_job_id = ?`,
    values,
  )
}

const updatePhotoOrder = async (orderId, fields) => {
  const ALLOWED = ['status', 'completed_at', 'fail_reason']
  const entries = Object.entries(fields).filter(([k]) => ALLOWED.includes(k))
  if (!entries.length) return

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), orderId]

  await pool.query(
    `UPDATE photo_orders SET ${setClauses}, updated_at = NOW() WHERE order_id = ?`,
    values,
  )
}

const insertPhotoFile = async ({ fileId, orderId, kind, fileUrl, s3Key }) => {
  await pool.query(
    `INSERT INTO photo_files (file_id, order_id, kind, file_url, s3_key, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [fileId, orderId, kind, fileUrl, s3Key],
  )
}

const insertNotification = async ({ userId, type, referenceId }) => {
  const notifId = uuidv4()
  await pool.query(
    `INSERT INTO notifications
       (notification_id, user_id, notification_type, target_type, target_id,
        title, message, is_read)
     VALUES (?, ?, ?, 'photo_order', ?, '사진 처리 완료', '사진 AI 처리가 완료되었습니다.', 0)`,
    [notifId, userId, type, referenceId ?? null],
  )
}

// ─── Gemini 설정 ──────────────────────────────────────────────────────────────

const PHOTO_PROMPTS = {
  funeral:  '이 사람의 얼굴을 유지하면서 깔끔한 검은 정장 착용 영정사진 스타일로 편집해 주세요. 배경은 흰색으로, 정면 상반신 구도.',
  id:       '이 사람의 얼굴을 유지하면서 밝은 배경의 증명사진 스타일로 편집해 주세요. 정장 착용, 단색 배경.',
  job:      '이 사람의 얼굴을 유지하면서 취업 프로필 사진 스타일로 편집해 주세요. 비즈니스 캐주얼, 깔끔한 배경.',
  portrait: '이 사람의 얼굴과 신체를 유지하면서 단정한 격식체 초상화 스타일로 편집해 주세요. 자연스러운 표정, 중립 배경.',
  casual:   '이 사람의 얼굴과 신체를 유지하면서 자연스러운 일상복 캐주얼 스타일로 편집해 주세요. 편안한 복장, 자연스러운 배경.',
  enhance:  '이 사진의 화질을 향상시켜 주세요. 노이즈 제거, 선명도 개선, 색상 보정.',
  colorize: '이 흑백 사진을 자연스럽게 컬러 사진으로 변환해 주세요.',
  restore:  '이 손상되거나 오래된 사진을 복원해 주세요. 스크래치 제거, 색바램 복원, 화질 개선.',
  removebg: '이 사진의 배경을 제거하고 흰색 배경으로 교체해 주세요. 인물/피사체만 남기세요.',
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

  // 3. AI 처리 (mock or 실제)
  let resultUrl
  if (AI_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    resultUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/photos/${userId}/${orderId}/result_${photoType}.jpg`
  } else {
    const { GoogleGenAI, Modality } = await import('@google/genai')
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    // S3에서 원본 이미지 다운로드
    const imageBuffer = await downloadFromS3(s3Key)
    const base64 = imageBuffer.toString('base64')

    const prompt = PHOTO_PROMPTS[photoType]
    if (!prompt) {
      throw Object.assign(new Error(`지원하지 않는 photoType: ${photoType}`), { status: 400 })
    }

    // Gemini 이미지 편집 요청
    const response = await genai.models.generateContent({
      model: 'gemini-2.0-flash-exp-image-generation',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
            { text: prompt },
          ],
        },
      ],
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    })

    // 응답에서 이미지 파트 추출
    const candidates = response.candidates ?? []
    let resultImageData = null
    for (const candidate of candidates) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.inlineData?.data) {
          resultImageData = part.inlineData.data
          break
        }
      }
      if (resultImageData) break
    }

    if (!resultImageData) {
      throw new Error('Gemini API 응답에서 이미지 데이터를 찾을 수 없습니다')
    }

    const resultBuffer = Buffer.from(resultImageData, 'base64')
    const resultS3KeyTemp = `photos/${userId}/${orderId}/result_${photoType}.jpg`
    resultUrl = await uploadToS3(resultS3KeyTemp, resultBuffer, { contentType: 'image/jpeg' })
  }

  const resultS3Key = `photos/${userId}/${orderId}/result_${photoType}.jpg`

  // 4. photo_files INSERT (결과물)
  await insertPhotoFile({
    fileId: uuidv4(),
    orderId,
    kind: 'enhanced',
    fileUrl: resultUrl,
    s3Key: resultS3Key,
  })

  // 5. ai_jobs: completed
  await updateAiJob(bullmqJobId, {
    job_status: 'completed',
    progress: 100,
    result_url: resultUrl,
    completed_at: new Date(),
  })

  // 6. photo_orders: completed
  await updatePhotoOrder(orderId, {
    status: 'completed',
    completed_at: new Date(),
  })

  // 7. notifications INSERT
  await insertNotification({
    userId,
    type: 'photo_complete',
    referenceId: orderId,
  })
}

// ─── 워커 등록 ────────────────────────────────────────────────────────────────

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    await processPhoto(job.data, String(job.id))
  },
  {
    connection: redis,
    concurrency: Number(process.env.PHOTO_WORKER_CONCURRENCY) || 3,
    stalledInterval: 30000,
  },
)

worker.on('completed', (job) => {
  console.error(`[photoWorker] job ${job.id} completed`)
})

// 최대 재시도 소진 후에만 DB 상태를 failed로 확정
worker.on('failed', async (job, err) => {
  const maxAttempts = job?.opts?.attempts ?? 1
  console.error(`[photoWorker] job ${job?.id} failed (attempt ${job?.attemptsMade}/${maxAttempts}):`, err.message)

  if (!job || job.attemptsMade < maxAttempts) return

  const { orderId } = job.data

  await updateAiJob(String(job.id), {
    job_status: 'failed',
    error_message: err.message,
    completed_at: new Date(),
  }).catch((dbErr) => console.error('[photoWorker] ai_jobs failed 업데이트 오류:', dbErr.message))

  await updatePhotoOrder(orderId, {
    status: 'failed',
    fail_reason: err.message,
  }).catch((dbErr) => console.error('[photoWorker] photo_orders failed 업데이트 오류:', dbErr.message))
})

worker.on('error', (err) => {
  console.error('[photoWorker] worker error:', err.message)
})

export default worker
