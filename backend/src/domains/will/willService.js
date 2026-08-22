import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import * as repo from './willRepository.js'
import { encryptString, decryptBuffer } from '../../utils/kms.js'
import { getPresignedUrl, getPresignedDownloadUrl, extractS3KeyFromUrl } from '../../utils/s3.js'
import { voiceCloneQueue, videoGenerateQueue, notificationQueue } from '../../jobs/queue.js'
import pool from '../../config/db.js'
import redis from '../../config/redis.js'

// AWS SigV4 presigned URL은 최대 604,800초(7일)까지만 발급 가능하다(G7-1).
// 90일은 SPEC-05가 정의한 "열람 링크(초대 토큰) 자체"의 유효기간이지, S3
// presigned URL의 만료 시간이 아니다 - 이 둘을 분리해서 다룬다.
// issueWatchVideoUrl(구 getWatchUrl)은 호출될 때마다 DB에 암호화 저장된 s3Key로부터
// presigned URL을 새로 발급한다(캐시하지 않음). 즉 초대 토큰이 유효한 90일 동안은
// 열람할 때마다 짧은 수명의 새 서명 URL이 발급되므로, 토큰 자체의 90일 유효기간과
// 무관하게 항상 유효한 링크로 재생할 수 있다. [보안 수정] 이제 이 함수는 라우트에서
// 직접 호출되지 않고 verifyWatchAccess(본인 확인 성공)를 거쳐야만 호출된다.
const WATCH_URL_EXPIRES = 24 * 60 * 60 // 1일(초) - 매 열람마다 재발급되므로 짧게 유지

// SPEC-05 2절 4번: "다운로드: 제공한다. 90일 후 링크가 만료돼도 유족이 영상을 잃지
// 않도록 원본 다운로드 버튼 제공(워터마크 없음)". 사람이 읽을 수 있는 파일명을
// 만든다 - users 테이블에 실명 컬럼이 없어(nickname만 존재) 닉네임을 "고인 이름"
// 대용으로 쓴다. 경로 구분자·따옴표·CR/LF 등 Content-Disposition 헤더에 위험한
// 문자는 제거한다(헤더 인젝션 방지, encodeURIComponent만으로는 quoted-string
// fallback 쪽까지 방어되지 않는다).
const buildDownloadFilename = (ownerNickname) => {
  const safeName = String(ownerNickname ?? '').replace(/[\\/"'*?:|<>\r\n]/g, '').trim()
  return `마지막영상편지_${safeName || '온담'}.mp4`
}

// ─── 열람 본인 확인 (SPEC-05 2절) ────────────────────────────────────────────
// "토큰만 맞으면 바로 영상 URL을 내준다" 취약점 수정: 링크 진입 시에는 영상 URL을
// 절대 내려주지 않고, 수신인 이름 등 최소 정보만 보여준 뒤 휴대폰 뒤 4자리 대조를
// 통과해야만 영상 URL을 발급한다.
//
// 오입력 잠금은 스키마 변경 없이 Redis(이미 BullMQ용으로 연결된 config/redis.js)에
// 시도 횟수·잠금 상태를 저장한다. will_beneficiaries.verified_at은 "성공한 마지막
// 확인 시각" 감사 기록용으로만 쓰고(이미 존재하는 컬럼), 잠금 판정 자체는 Redis가
// 진실이다 - 서버 재기동으로 Redis가 비어도 최악의 경우 시도 횟수만 초기화될 뿐
// verified_at 이력은 DB에 남는다.
const WATCH_VERIFY_MAX_ATTEMPTS = 5
// 24시간 - "5회 초과 시 잠금 → CS 안내"(SPEC-05)를 자동 잠금해제가 아니라 CS
// 문의 유도로 설계했으므로, TTL은 재시도를 서두르게 하지 않을 만큼 길게 잡는다.
// 그래도 Redis 키인 이상 영구는 아니다(운영자가 CS 문의 없이도 하루 뒤 재시도
// 가능 - 완전 영구 잠금보다 유가족에게 덜 가혹한 선택).
const WATCH_VERIFY_LOCK_TTL_SEC = 24 * 60 * 60
const WATCH_VERIFY_ATTEMPTS_TTL_SEC = 24 * 60 * 60

// 열람 링크(invite_token) 유효기간(SPEC-05 3절) - 최초 발급 시 wills.released_at
// 기준 +90일(마이그레이션 c 백필과 동일 정책), 연장 요청 시에도 이 값만큼 재발급.
const WATCH_TOKEN_TTL_DAYS = 90

const isTokenExpired = (beneficiary) =>
  Boolean(beneficiary.token_expires_at) && new Date(beneficiary.token_expires_at) < new Date()

const watchAttemptsKey = (token) => `will:watch:attempts:${token}`
const watchLockKey = (token) => `will:watch:locked:${token}`

const extractPhoneLast4 = (phone) => {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : null
}

// 유언 영상 편지 - 베이직 단일가 (2026-08-21 오너 확정). 가격은 서버가 결정하는
// 단일 정본이며 클라이언트 입력(priceKrw)을 받지 않는다. payment 도메인의
// preparePayment는 wills.price_krw(이 값으로 저장된 스냅샷)를 조회해 검증한다.
const WILL_BASIC_PRICE_KRW = 49000

// ─── 음성 샘플 ────────────────────────────────────────────────────────────────

/**
 * 음성 샘플 업로드 등록
 * S3 업로드는 클라이언트 또는 업로드 미들웨어에서 먼저 완료한 뒤 s3Key 전달
 *
 * 음성권 동의(user_consents.consent_type='voice', is_agreed=1) 필수 - 미동의 시 400 거부
 * consentId는 클라이언트에서 받지 않고 findVoiceConsent 결과의 consent_id 사용
 */
export const uploadVoiceSample = async (userId, { s3Key, durationSec, fileSize }) => {
  // S3 키 소유권 검증 (온담 보안 규칙 G9-4) - uploadMiddleware.js가 발급하는 키는
  // `{folder}/{userId}/{uuid}.ext` 형태다. 클라이언트가 문자열을 조작해 타인의
  // 음성 파일 키를 제출하면 원본 화자의 동의 없이 타인 명의로 음성 클론이 생성될
  // 수 있으므로, 접두사가 본인 userId와 일치하는지 서버에서 반드시 확인한다.
  if (!s3Key.startsWith(`wills/${userId}/`)) {
    throw Object.assign(
      new Error('본인이 업로드한 파일만 등록할 수 있습니다'),
      { status: 403 },
    )
  }

  // 음성권 동의 확인 (온담 보안 규칙 §3)
  // user_consents 테이블에서 consent_type='voice' 최신 row 조회 - is_agreed=1이어야 통과
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
  { voiceSampleId, title, contentText, releasePolicy, beneficiaries = [], eventType },
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
      priceKrw: WILL_BASIC_PRICE_KRW,
      eventType: eventType ?? null,
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
  // invite_token은 수혜자 본인 전달용 - 유언장 조회 응답에서 제거
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
 * 유언장 활성화 - 영상 생성 큐 등록 (결제 후 호출)
 * FOR UPDATE 비관적 락으로 동시 활성화 요청 경쟁 조건 방지
 */
export const activateWill = async (userId, willId) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // FOR UPDATE - 동일 will_id에 대한 동시 요청 중 하나만 진행
    const [[will]] = await conn.execute(
      'SELECT * FROM wills WHERE will_id = ? AND deleted_at IS NULL FOR UPDATE',
      [willId],
    )
    if (!will) {
      throw Object.assign(new Error('유언장을 찾을 수 없습니다'), { status: 404 })
    }
    if (String(will.user_id) !== String(userId)) {
      throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
    }
    if (!['draft', 'paid'].includes(will.status)) {
      throw Object.assign(new Error('이미 처리 중이거나 완료된 유언장입니다'), { status: 400 })
    }

    // 음성 샘플 조회 - null이면 400 에러
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

    // 수익자 존재 확인 - 최소 1명 필수
    const beneficiaryCount = await repo.countBeneficiaries(willId)
    if (beneficiaryCount === 0) {
      throw Object.assign(new Error('수익자를 최소 1명 이상 등록해야 합니다'), { status: 400 })
    }

    // 음성권 동의 재확인 - 업로드 이후 동의가 철회됐을 수 있음
    const consent = await repo.findVoiceConsent(userId)
    if (!consent || consent.is_agreed !== 1) {
      throw Object.assign(new Error('음성 처리 동의가 필요합니다'), { status: 400 })
    }

    // BullMQ 영상 생성 큐 등록 (트랜잭션 내 - 롤백 시 큐 항목만 유실, 워커 멱등성으로 처리)
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

    // status 업데이트 - 같은 트랜잭션 내에서 커넥션을 직접 사용
    await conn.execute(
      'UPDATE wills SET status = ?, updated_at = NOW() WHERE will_id = ?',
      ['active', willId],
    )

    await repo.addWillStatusLog({
      logId: uuidv4(),
      willId,
      prevStatus: will.status,
      nextStatus: 'active',
      changedBy: userId,
      changedByType: 'user',
      reason: '사용자 활성화 요청',
    })

    await conn.commit()
    return { jobId, bullJobId: String(bullJob.id) }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
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
 * 사망증명서 업로드 컨텍스트 확인 (초대 토큰 → will/beneficiary 스코프 확정)
 * uploadMiddleware.uploadDeathCertificate의 S3 키 생성은 이 함수가 반환한
 * willId/beneficiaryId만 사용한다 - 클라이언트 입력은 키 생성에 전혀 관여하지 않는다.
 */
export const resolveReleaseUploadContext = async (token) => {
  const beneficiary = await repo.findBeneficiaryByToken(token)
  if (!beneficiary) {
    throw Object.assign(
      new Error('유효하지 않은 링크입니다. 문자나 카카오톡으로 받으신 링크를 다시 확인해 주세요.'),
      { status: 404 },
    )
  }
  return { willId: beneficiary.will_id, beneficiaryId: beneficiary.beneficiary_id }
}

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

  // 서류 소유권 스코프 검증 (온담 보안 규칙 G9-4) - uploadDeathCertificate가 발급하는
  // 키는 `wills/{willId}/release-docs/{beneficiaryId}/{uuid}.ext` 형태다. 클라이언트가
  // 다른 요청에서 발급된 s3Key/url을 그대로 흉내 내 제출하면(다른 유가족·다른 유언장의
  // 서류를 자신의 요청에 끼워넣기) 관리자가 엉뚱한 서류로 승인할 수 있으므로,
  // 반드시 이 토큰이 가리키는 will/beneficiary 스코프와 일치하는지 서버에서 확인한다.
  const expectedPrefix = `wills/${will.will_id}/release-docs/${beneficiary.beneficiary_id}/`
  if (!deathCertS3Key.startsWith(expectedPrefix) || !deathCertUrl.endsWith(deathCertS3Key)) {
    throw Object.assign(
      new Error('본인이 업로드한 서류만 제출할 수 있습니다. 서류를 다시 업로드해 주세요.'),
      { status: 403 },
    )
  }
  // wills.status ENUM에는 'completed'가 존재하지 않는다(유령값) - 실제로 영상까지
  // 생성 완료된 유언장은 status='active' 그대로 유지되고 release_status로 공개 여부만
  // 구분한다. 'completed'는 죽은 조건이라 제거했다.
  if (will.status !== 'active') {
    throw Object.assign(new Error('활성화된 유언장만 공개 요청이 가능합니다'), { status: 400 })
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
 * 초대 토큰 → will/beneficiary 조회 + 공개 상태 확인 (내부 공용)
 * getWatchInfo/issueWatchVideoUrl이 공통으로 쓰는 검증 단계
 */
const resolveWatchTarget = async (token) => {
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

  return { beneficiary, will }
}

/**
 * 유언 영상 시청 URL 발급 (KMS 복호화 + presigned URL)
 * [보안 수정] 더 이상 라우트에서 직접 호출하지 않는다. verifyWatchAccess가 본인
 * 확인(휴대폰 뒤 4자리)에 성공했을 때만 내부적으로 호출한다 - 토큰만으로는
 * 더 이상 영상 URL이 발급되지 않는다.
 */
const issueWatchVideoUrl = async (beneficiary, will) => {
  // 열람 기록 (SPEC-05 2절, 마이그레이션 c README 4절 1번) - 최초 1회만 video_watched_at을
  // 채우고 watch_count는 호출마다(=본인 확인 통과마다) +1. URL 발급 실패 여부와 무관하게
  // "발급을 시도한 시점"을 열람으로 간주한다(재생 자체의 성공/실패까지는 서버가 알 수 없다).
  await repo.recordWatch(beneficiary.beneficiary_id)

  // KMS 복호화 → S3 키 복원
  const s3Key = await decryptBuffer(Buffer.from(will.result_video_s3_key_encrypted))
  const videoUrl = await getPresignedUrl(s3Key, WATCH_URL_EXPIRES)

  // SPEC-05 2절 4번(원본 다운로드 제공, 워터마크 없음) - 재생용과 동일한 s3Key·동일한
  // 본인 확인 통과 시점에만 함께 발급한다(별도 미인증 경로 없음, 3절 참고). 닉네임
  // 조회 실패는 다운로드 자체를 막을 이유가 없으므로 폴백 파일명으로 흡수한다.
  const ownerNickname = await repo.findUserNicknameById(will.user_id).catch((err) => {
    console.error('[willService] 다운로드 파일명용 닉네임 조회 실패(폴백 사용):', err.message)
    return null
  })
  const downloadUrl = await getPresignedDownloadUrl(
    s3Key,
    WATCH_URL_EXPIRES,
    buildDownloadFilename(ownerNickname),
  )

  return {
    videoUrl,
    downloadUrl,
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

/**
 * 링크 진입 시 보여줄 최소 정보 (본인 확인 이전, 영상 URL은 절대 포함하지 않음)
 * SPEC-05 2절 1단계: "○○님께 도착한 영상 편지입니다" 표시 + 잠금 여부
 */
export const getWatchInfo = async (token) => {
  const { beneficiary, will } = await resolveWatchTarget(token)
  const locked = Boolean(await redis.get(watchLockKey(token)))

  return {
    beneficiaryName: beneficiary.name,
    willTitle: will.title,
    locked,
    // SPEC-05 3절: 만료된 토큰은 프론트가 별도 "만료" 화면(연장 요청 버튼)을 보여줄
    // 수 있도록 별개 플래그로 내려준다 - 잠금과 달리 사용자 잘못이 아니므로 구분한다.
    expired: isTokenExpired(beneficiary),
  }
}

/**
 * 본인 확인 (휴대폰 뒤 4자리 대조) 후 성공 시에만 영상 URL 발급
 * 오입력 5회 초과 시 잠금(24시간, Redis) - 잠금 중에는 정답을 넣어도 즉시 423
 */
export const verifyWatchAccess = async (token, phoneLast4, { ipAddress, userAgent } = {}) => {
  const { beneficiary, will } = await resolveWatchTarget(token)

  // 토큰 만료 검사 (SPEC-05 3절) - getWatchInfo 조회 이후 만료됐을 수도 있으므로
  // 여기서도 다시 확인한다(defense in depth). 잠금 검사보다 먼저 - 만료는 사용자의
  // 오입력과 무관한 별개 사유라 423(잠금)이 아니라 410(Gone)으로 구분한다.
  if (isTokenExpired(beneficiary)) {
    throw Object.assign(
      new Error('기간이 지났어요. 연장을 요청할 수 있어요.'),
      { status: 410 },
    )
  }

  const lockKey = watchLockKey(token)
  const alreadyLocked = await redis.get(lockKey)
  if (alreadyLocked) {
    throw Object.assign(
      new Error('본인 확인 시도 횟수를 초과했습니다. 고객센터로 문의해 주세요.'),
      { status: 423 },
    )
  }

  const expectedLast4 = extractPhoneLast4(beneficiary.phone)
  const matched = expectedLast4 !== null && expectedLast4 === phoneLast4

  if (!matched) {
    const attemptsKey = watchAttemptsKey(token)
    const attempts = await redis.incr(attemptsKey)
    if (attempts === 1) {
      await redis.expire(attemptsKey, WATCH_VERIFY_ATTEMPTS_TTL_SEC)
    }

    if (attempts >= WATCH_VERIFY_MAX_ATTEMPTS) {
      await redis.set(lockKey, '1', 'EX', WATCH_VERIFY_LOCK_TTL_SEC)
      await repo.createAuditLog({
        logId: uuidv4(),
        actorId: beneficiary.beneficiary_id,
        actorType: 'user',
        action: 'will_watch_verify_locked',
        targetType: 'will_beneficiary',
        targetId: beneficiary.beneficiary_id,
        ipAddress,
        userAgent,
        detail: { willId: will.will_id, attempts },
      })
      throw Object.assign(
        new Error('본인 확인 시도 횟수를 초과했습니다. 고객센터로 문의해 주세요.'),
        { status: 423 },
      )
    }

    await repo.createAuditLog({
      logId: uuidv4(),
      actorId: beneficiary.beneficiary_id,
      actorType: 'user',
      action: 'will_watch_verify_failed',
      targetType: 'will_beneficiary',
      targetId: beneficiary.beneficiary_id,
      ipAddress,
      userAgent,
      detail: { willId: will.will_id, attempts },
    })

    throw Object.assign(
      new Error(`휴대폰 번호 뒤 4자리가 일치하지 않습니다. (${WATCH_VERIFY_MAX_ATTEMPTS - attempts}회 남음)`),
      { status: 401 },
    )
  }

  // 성공 - 시도 카운터 초기화 + verified_at 기록 + audit
  await redis.del(watchAttemptsKey(token))
  await repo.updateBeneficiaryVerifiedAt(beneficiary.beneficiary_id)
  await repo.createAuditLog({
    logId: uuidv4(),
    actorId: beneficiary.beneficiary_id,
    actorType: 'user',
    action: 'will_watch_verified',
    targetType: 'will_beneficiary',
    targetId: beneficiary.beneficiary_id,
    ipAddress,
    userAgent,
    // downloadUrlIssued: 재생 URL과 다운로드 URL이 이 시점에 함께 발급됐다는 사실만
    // 남긴다(4번 판단 - 아래 issueWatchVideoUrl 주석 및 완료 보고 참고). 실제 클릭
    // 여부는 presigned S3 URL을 브라우저가 직접 소비하므로 백엔드가 알 수 없다.
    detail: { willId: will.will_id, downloadUrlIssued: true },
  })

  return issueWatchVideoUrl(beneficiary, will)
}

// ─── 열람 링크 연장 요청 (SPEC-05 3절) ────────────────────────────────────────
/**
 * 만료된(또는 만료 임박한) invite_token을 새 토큰으로 재발급한다. 무제한 허용하되
 * 재발급마다 구토큰을 즉시 무효화(교체)하고 audit_logs에 기록한다("구토큰 무효화·
 * 로그 기록" - 마이그레이션 c README 4절 2번, 별도 전용 로그 테이블은 만들지 않고
 * 기존 audit_logs를 재사용).
 *
 * 이미 만료된 토큰이라도 findBeneficiaryByToken은 만료 여부와 무관하게 값으로
 * 조회하므로(만료는 verifyWatchAccess/getWatchInfo에서만 판정) 만료 화면에 남아있는
 * 옛 링크로도 연장 요청이 가능하다.
 */
export const requestWatchLinkExtension = async (token) => {
  const beneficiary = await repo.findBeneficiaryByToken(token)
  if (!beneficiary) {
    throw Object.assign(
      new Error('유효하지 않은 링크입니다. 문자나 카카오톡으로 받으신 링크를 다시 확인해 주세요.'),
      { status: 404 },
    )
  }

  const will = await repo.findWillById(beneficiary.will_id)
  if (!will || will.release_status !== 'released') {
    throw Object.assign(new Error('연장할 수 없는 링크입니다.'), { status: 403 })
  }

  const newToken = crypto.randomBytes(32).toString('hex')
  const newExpiresAt = new Date(Date.now() + WATCH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)

  await repo.extendBeneficiaryToken(beneficiary.beneficiary_id, {
    newToken,
    tokenExpiresAt: newExpiresAt,
  })

  // 구토큰 무효화 기록 - 원문 토큰은 저장하지 않고 해시만 남긴다(감사 로그가 유출돼도
  // 이미 교체된 토큰을 그대로 복원할 수 없게 하기 위함).
  await repo.createAuditLog({
    logId: uuidv4(),
    actorId: beneficiary.beneficiary_id,
    actorType: 'user',
    action: 'will_watch_token_reissued',
    targetType: 'will_beneficiary',
    targetId: beneficiary.beneficiary_id,
    detail: {
      willId: will.will_id,
      oldTokenHash: crypto.createHash('sha256').update(token).digest('hex').slice(0, 16),
    },
  })

  // 새 링크 안내 발송 - 비차단(실패해도 재발급 자체는 유효, 화면에서 바로 새 토큰으로
  // 이동시킬 수 있으므로 지금 이 순간의 발송 성공 여부가 재발급 자체를 막을 이유는 없다)
  const watchUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/watch/${newToken}`
  const greeting = beneficiary.name ? `${beneficiary.name}님, ` : ''
  const message = `${greeting}요청하신 영상 편지 링크를 새로 보내드려요. 아래 링크로 다시 확인하실 수 있어요.`
  try {
    if (beneficiary.phone) {
      await notificationQueue.add('will_watch_token_reissued', {
        type: 'sms',
        to: beneficiary.phone,
        message: `${message} ${watchUrl}`,
      })
    }
    if (beneficiary.email) {
      await notificationQueue.add('will_watch_token_reissued', {
        type: 'email',
        to: beneficiary.email,
        subject: '온담 - 영상 편지 링크를 다시 보내드려요',
        message: `${message}\n${watchUrl}`,
      })
    }
  } catch (err) {
    console.error('[willService] 연장 안내 발송 큐 등록 실패 (재발급 자체는 유지):', err.message)
  }

  return { token: newToken, expiresAt: newExpiresAt }
}
