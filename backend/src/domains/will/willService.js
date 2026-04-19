import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import * as repo from './willRepository.js'
import { encryptString, decryptBuffer } from '../../utils/kms.js'
import { getPresignedUrl, extractS3KeyFromUrl } from '../../utils/s3.js'
import { voiceCloneQueue, videoGenerateQueue } from '../../jobs/queue.js'

// 90일(초)
const WATCH_URL_EXPIRES = 90 * 24 * 60 * 60

// ─── 음성 샘플 ────────────────────────────────────────────────────────────────

/**
 * 음성 샘플 업로드 등록
 * S3 업로드는 클라이언트 또는 업로드 미들웨어에서 먼저 완료한 뒤 s3Key 전달
 *
 * 음성권 동의(user_consents.consent_type='voice', is_agreed=1) 필수 — 미동의 시 400 거부
 * consentId는 클라이언트에서 받지 않고 findVoiceConsent 결과의 consent_id 사용
 */
export const uploadVoiceSample = async (userId, { s3Key, durationSec, fileSize }) => {
  // 음성권 동의 확인 (온담 보안 규칙 §3)
  // user_consents 테이블에서 consent_type='voice' 최신 row 조회 — is_agreed=1이어야 통과
  const consentRow = await repo.findVoiceConsent(userId)
  if (!consentRow || consentRow.is_agreed !== 1) {
    throw Object.assign(
      new Error('음성 처리를 위한 동의가 필요합니다. 설정 > 음성 동의에서 동의해 주세요.'),
      { status: 400 },
    )
  }

  const { encrypted, kmsKeyId } = await encryptString(s3Key)

  const voiceSampleId = uuidv4()
  await repo.createVoiceSample({
    voiceSampleId,
    userId,
    consentId: consentRow.consent_id,
    s3KeyEncrypted: encrypted,
    kmsKeyId,
    durationSec: durationSec ?? null,
    fileSize: fileSize ?? null,
  })

  // BullMQ 음성 클론 큐 등록
  const bullJob = await voiceCloneQueue.add('clone', {
    voiceSampleId,
    userId,
    s3KeyEncrypted: encrypted.toString('base64'),
    kmsKeyId,
  })

  // ai_jobs 레코드 생성
  const jobId = uuidv4()
  await repo.createAiJob({
    jobId,
    userId,
    bullmqJobId: bullJob.id,
    jobType: 'voice_clone',
    targetType: 'voice_sample',
    targetId: voiceSampleId,
    queueName: 'voiceClone',
  })

  return { voiceSampleId, jobId }
}

/**
 * 음성 샘플 클론 상태 조회
 */
export const getVoiceSampleStatus = async (userId, voiceSampleId) => {
  const sample = await repo.findVoiceSampleById(voiceSampleId)
  if (!sample) {
    throw Object.assign(new Error('음성 샘플을 찾을 수 없습니다'), { status: 404 })
  }
  if (String(sample.user_id) !== String(userId)) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  return {
    voiceSampleId: sample.voice_sample_id,
    cloneStatus: sample.clone_status,
    elevenlabsVoiceId: sample.elevenlabs_voice_id ?? null,
    durationSec: sample.duration_sec ?? null,
    createdAt: sample.created_at,
  }
}

// ─── 유언장 ───────────────────────────────────────────────────────────────────

/**
 * 유언장 생성
 * beneficiaries: [{ name, email, phone?, relationship }, ...]
 * 유언장 INSERT + 수혜자 INSERT를 단일 트랜잭션으로 처리
 */
export const createWill = async (
  userId,
  { voiceSampleId, title, contentText, releasePolicy, beneficiaries = [], priceKrw },
) => {
  // 음성 샘플 소유권 + ready 상태 확인
  const sample = await repo.findVoiceSampleById(voiceSampleId)
  if (!sample) {
    throw Object.assign(new Error('음성 샘플을 찾을 수 없습니다'), { status: 404 })
  }
  if (String(sample.user_id) !== String(userId)) {
    throw Object.assign(new Error('음성 샘플 접근 권한이 없습니다'), { status: 403 })
  }
  if (sample.clone_status !== 'ready') {
    throw Object.assign(
      new Error('음성 클론이 아직 완료되지 않았습니다. clone_status가 ready일 때 유언장을 생성하세요.'),
      { status: 400 },
    )
  }

  const willId = uuidv4()

  // 수혜자 데이터 사전 준비 (트랜잭션 진입 전)
  const beneficiariesData = beneficiaries.map((b) => ({
    beneficiaryId: uuidv4(),
    willId,
    userId: null,
    name: b.name,
    email: b.email,
    phone: b.phone ?? null,
    relationship: b.relationship,
    inviteToken: crypto.randomBytes(32).toString('hex'),
  }))

  // 유언장 + 수혜자 트랜잭션 일괄 생성
  await repo.createWillWithBeneficiaries(
    {
      willId,
      userId,
      voiceSampleId,
      title,
      contentText,
      releasePolicy: releasePolicy ?? 'manual_admin',
      priceKrw: priceKrw ?? 49000,
    },
    beneficiariesData,
  )

  return { willId }
}

/**
 * 유언장 단건 조회 (수혜자 포함)
 */
export const getWill = async (userId, willId) => {
  const will = await repo.findWillById(willId)
  if (!will) {
    throw Object.assign(new Error('유언장을 찾을 수 없습니다'), { status: 404 })
  }
  if (String(will.user_id) !== String(userId)) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }

  const rawBeneficiaries = await repo.findBeneficiariesByWillId(willId)
  // invite_token은 수혜자 본인 전달용 — 유언장 조회 응답에서 제거
  const beneficiaries = rawBeneficiaries.map(({ invite_token: _omit, ...b }) => b)
  return { ...will, beneficiaries }
}

/**
 * 유언장 목록 조회 (페이지네이션)
 */
export const getWills = async (userId, { page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit
  const { wills, total } = await repo.findWillsByUserId(userId, { limit, offset })
  return {
    wills,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

/**
 * 유언장 활성화 — 영상 생성 큐 등록 (결제 후 호출)
 */
export const activateWill = async (userId, willId) => {
  const will = await repo.findWillById(willId)
  if (!will) {
    throw Object.assign(new Error('유언장을 찾을 수 없습니다'), { status: 404 })
  }
  if (String(will.user_id) !== String(userId)) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }
  if (will.status !== 'draft') {
    throw Object.assign(new Error('draft 상태의 유언장만 활성화할 수 있습니다'), { status: 400 })
  }

  // 음성 샘플 조회 — null이면 400 에러
  const sample = await repo.findVoiceSampleById(will.voice_sample_id)
  if (!sample) {
    throw Object.assign(new Error('음성 샘플이 없습니다'), { status: 400 })
  }
  if (sample.clone_status !== 'ready') {
    throw Object.assign(
      new Error(`음성 복제가 아직 완료되지 않았습니다 (현재: ${sample.clone_status})`),
      { status: 400 },
    )
  }

  // 사용자 프로필 이미지 S3 키 조회 (videoWorker 사진 소스)
  const profileImageUrl = await repo.findUserProfileImageUrl(userId)
  const photoS3Key = extractS3KeyFromUrl(profileImageUrl)
  if (!photoS3Key) {
    throw Object.assign(
      new Error('프로필 사진이 없습니다. 유언 영상 생성 전 프로필 사진을 등록해 주세요.'),
      { status: 400 },
    )
  }

  // BullMQ 영상 생성 큐 등록
  const bullJob = await videoGenerateQueue.add('generate', {
    willId,
    userId,
    photoS3Key,
    voiceS3KeyEncrypted: sample.s3_key_encrypted.toString('base64'),
    voiceKmsKeyId: sample.kms_key_id,
    elevenlabsVoiceId: sample.elevenlabs_voice_id ?? null,
    contentText: will.content_text,
  })

  const jobId = uuidv4()
  await repo.createAiJob({
    jobId,
    userId,
    bullmqJobId: bullJob.id,
    jobType: 'video_generate',
    targetType: 'will',
    targetId: willId,
    queueName: 'videoGenerate',
  })

  const prevStatus = will.status
  await repo.updateWill(willId, { status: 'active' })
  await repo.addWillStatusLog({
    logId: uuidv4(),
    willId,
    prevStatus,
    nextStatus: 'active',
    changedBy: userId,
    changedByType: 'user',
    reason: '사용자 활성화 요청',
  })

  return { jobId }
}

/**
 * 영상 생성 진행 상태 조회 (폴링용)
 */
export const getVideoStatus = async (userId, willId) => {
  const will = await repo.findWillById(willId)
  if (!will) {
    throw Object.assign(new Error('유언장을 찾을 수 없습니다'), { status: 404 })
  }
  if (String(will.user_id) !== String(userId)) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }

  const job = await repo.findAiJobByTarget(willId)
  return {
    willId,
    willStatus: will.status,
    job: job
      ? {
          jobId: job.job_id,
          jobStatus: job.job_status,
          progress: job.progress,
          resultUrl: job.result_url ?? null,
          errorMessage: job.error_message ?? null,
        }
      : null,
  }
}

// ─── 사후 공개 요청 (비회원) ──────────────────────────────────────────────────

/**
 * 사후 공개 요청 접수 (유가족 초대 토큰 경유)
 * deathCertS3Key, deathCertUrl 둘 다 필수 (DB NOT NULL 제약)
 */
export const requestRelease = async (token, { deathCertS3Key, deathCertUrl }) => {
  if (!deathCertS3Key) {
    throw Object.assign(new Error('사망증명서 S3 키가 필요합니다'), { status: 400 })
  }
  if (!deathCertUrl) {
    throw Object.assign(new Error('사망증명서 URL이 필요합니다'), { status: 400 })
  }

  const beneficiary = await repo.findBeneficiaryByToken(token)
  if (!beneficiary) {
    throw Object.assign(new Error('유효하지 않은 초대 토큰입니다'), { status: 404 })
  }

  const will = await repo.findWillById(beneficiary.will_id)
  if (!will) {
    throw Object.assign(new Error('유언장을 찾을 수 없습니다'), { status: 404 })
  }
  if (will.release_status === 'released') {
    throw Object.assign(new Error('이미 공개된 유언장입니다'), { status: 409 })
  }
  if (will.release_status === 'pending_review') {
    throw Object.assign(new Error('이미 검토 중인 공개 요청이 있습니다'), { status: 409 })
  }

  const requestId = uuidv4()
  await repo.createReleaseRequest({
    requestId,
    willId: will.will_id,
    requestedBy: beneficiary.beneficiary_id,
    beneficiaryId: beneficiary.beneficiary_id,
    deathCertS3Key,
    deathCertUrl,
  })

  await repo.updateWill(will.will_id, { release_status: 'pending_review' })

  return { requestId }
}

/**
 * 유언 영상 시청 URL 발급 (비회원, 공개 확인 후 KMS 복호화 + 서명 URL)
 */
export const getWatchUrl = async (token) => {
  const beneficiary = await repo.findBeneficiaryByToken(token)
  if (!beneficiary) {
    throw Object.assign(new Error('유효하지 않은 초대 토큰입니다'), { status: 404 })
  }

  const will = await repo.findWillById(beneficiary.will_id)
  if (!will) {
    throw Object.assign(new Error('유언장을 찾을 수 없습니다'), { status: 404 })
  }
  if (will.release_status !== 'released') {
    throw Object.assign(
      new Error('아직 공개되지 않은 유언장입니다. 관리자 검토 후 공개됩니다.'),
      { status: 403 },
    )
  }
  if (!will.result_video_s3_key_encrypted) {
    throw Object.assign(new Error('영상이 아직 생성되지 않았습니다'), { status: 404 })
  }

  // KMS 복호화 → S3 키 복원
  const s3Key = await decryptBuffer(Buffer.from(will.result_video_s3_key_encrypted))
  const videoUrl = await getPresignedUrl(s3Key, WATCH_URL_EXPIRES)

  return {
    videoUrl,
    will: {
      willId: will.will_id,
      title: will.title,
      releasedAt: will.released_at,
      durationSec: will.result_video_duration_sec ?? null,
    },
    beneficiary: {
      name: beneficiary.name,
      relationship: beneficiary.relationship ?? null,
    },
  }
}
