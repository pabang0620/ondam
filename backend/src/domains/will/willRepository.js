import { v4 as uuidv4 } from 'uuid'
import pool from '../../config/db.js'

// ─── users (음성권 동의 확인 전용) ───────────────────────────────────────────────

/**
 * 음성권 동의 여부 확인 - user_consents 테이블에서 최신 동의 이력 조회
 * users 테이블에 voice_consent_at 컬럼 없음 - user_consents(consent_type='voice') 참조
 * @param {string} userId
 * @returns {Promise<{ is_agreed: number, agreed_at: Date }|null>} 최신 동의 row, 없으면 null
 */
export const findVoiceConsent = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT consent_id, is_agreed, agreed_at
     FROM user_consents
     WHERE user_id = ? AND consent_type = 'voice'
     ORDER BY agreed_at DESC
     LIMIT 1`,
    [userId],
  )
  return rows[0] ?? null
}

// ─── voice_samples ────────────────────────────────────────────────────────────

export const createVoiceSample = async ({
  voiceSampleId,
  userId,
  consentId,
  s3KeyEncrypted,
  kmsKeyId,
  durationSec,
  fileSize,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO voice_samples
       (voice_sample_id, user_id, consent_id,
        s3_key_encrypted, kms_key_id,
        clone_status, duration_sec, file_size,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NOW(), NOW())`,
    [voiceSampleId, userId, consentId, s3KeyEncrypted, kmsKeyId, durationSec ?? null, fileSize ?? null],
  )
  return result
}

export const findVoiceSampleById = async (voiceSampleId) => {
  const [rows] = await pool.execute(
    `SELECT * FROM voice_samples
     WHERE voice_sample_id = ? AND deleted_at IS NULL`,
    [voiceSampleId],
  )
  return rows[0] ?? null
}

export const findVoiceSamplesByUserId = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT * FROM voice_samples
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [userId],
  )
  return rows
}

export const updateVoiceSample = async (voiceSampleId, { elevenlabsVoiceId, cloneStatus, durationSec }) => {
  const fields = ['updated_at = NOW()']
  const values = []

  if (elevenlabsVoiceId !== undefined) {
    fields.push('elevenlabs_voice_id = ?')
    values.push(elevenlabsVoiceId)
  }
  if (cloneStatus !== undefined) {
    fields.push('clone_status = ?')
    values.push(cloneStatus)
  }
  if (durationSec !== undefined) {
    fields.push('duration_sec = ?')
    values.push(durationSec)
  }

  values.push(voiceSampleId)
  await pool.execute(
    `UPDATE voice_samples SET ${fields.join(', ')}
     WHERE voice_sample_id = ? AND deleted_at IS NULL`,
    values,
  )
}

// ─── users (프로필 이미지 조회 전용) ──────────────────────────────────────────────

/**
 * 사용자 프로필 이미지 URL 조회 (videoWorker photoS3Key 추출용)
 * @param {string} userId
 * @returns {Promise<string|null>} profile_image_url
 */
export const findUserProfileImageUrl = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT profile_image_url FROM users WHERE user_id = ? AND deleted_at IS NULL LIMIT 1`,
    [userId],
  )
  return rows[0]?.profile_image_url ?? null
}

/**
 * 유언장 작성자(=영상 속 고인)의 닉네임 조회 - 다운로드 파일명 표시용
 * (SPEC-05 2절 4번). users 테이블에 실명 컬럼이 없어(nickname만 존재) 이를
 * "고인 이름" 대용으로 쓴다.
 * @param {string} userId
 * @returns {Promise<string|null>} nickname
 */
export const findUserNicknameById = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT nickname FROM users WHERE user_id = ? AND deleted_at IS NULL LIMIT 1`,
    [userId],
  )
  return rows[0]?.nickname ?? null
}

// ─── wills ────────────────────────────────────────────────────────────────────

export const createWill = async ({
  willId,
  userId,
  voiceSampleId,
  title,
  contentText,
  releasePolicy,
  priceKrw,
  eventType,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO wills
       (will_id, user_id, voice_sample_id, title, content_text,
        status, release_policy, release_status, price_krw, event_type,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, 'locked', ?, ?, NOW(), NOW())`,
    [willId, userId, voiceSampleId, title, contentText, releasePolicy, priceKrw ?? 49000, eventType ?? null],
  )
  return result
}

export const findWillById = async (willId) => {
  const [rows] = await pool.execute(
    `SELECT * FROM wills
     WHERE will_id = ? AND deleted_at IS NULL`,
    [willId],
  )
  return rows[0] ?? null
}

/**
 * FOR UPDATE 락을 걸어 행을 조회 - 트랜잭션 내에서만 사용
 * @param {object} conn - pool.getConnection()으로 획득한 커넥션
 * @param {string} willId
 */
export const findWillByIdForUpdate = async (conn, willId) => {
  const [[row]] = await conn.execute(
    'SELECT * FROM wills WHERE will_id = ? AND deleted_at IS NULL FOR UPDATE',
    [willId],
  )
  return row ?? null
}

export const findWillsByUserId = async (userId, { limit, offset }) => {
  const [rows] = await pool.execute(
    `SELECT * FROM wills
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset],
  )
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM wills
     WHERE user_id = ? AND deleted_at IS NULL`,
    [userId],
  )
  return { wills: rows, total }
}

const WILL_UPDATABLE_COLS = [
  'status',
  'release_status',
  'released_at',
  'result_video_s3_key_encrypted',
  'result_video_kms_key_id',
  'result_video_duration_sec',
  'title',
  'content_text',
]

export const updateWill = async (willId, updates) => {
  const entries = Object.entries(updates).filter(([k]) => WILL_UPDATABLE_COLS.includes(k))
  if (entries.length === 0) return

  const fields = entries.map(([k]) => `${k} = ?`)
  const values = entries.map(([, v]) => v)

  fields.push('updated_at = NOW()')
  values.push(willId)

  await pool.execute(
    `UPDATE wills SET ${fields.join(', ')}
     WHERE will_id = ? AND deleted_at IS NULL`,
    values,
  )
}

// ─── will_status_logs ─────────────────────────────────────────────────────────

export const addWillStatusLog = async ({
  logId,
  willId,
  prevStatus,
  nextStatus,
  changedBy,
  changedByType,
  reason,
}) => {
  await pool.execute(
    `INSERT INTO will_status_logs
       (log_id, will_id, prev_status, next_status,
        changed_by, changed_by_type, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [logId, willId, prevStatus ?? null, nextStatus, changedBy, changedByType, reason ?? null],
  )
}

// ─── will_beneficiaries ───────────────────────────────────────────────────────

export const createBeneficiary = async ({
  beneficiaryId,
  willId,
  userId,
  name,
  email,
  phone,
  relationship,
  inviteToken,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO will_beneficiaries
       (beneficiary_id, will_id, user_id, name, email, phone, relationship,
        invite_token, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [beneficiaryId, willId, userId ?? null, name, email, phone ?? null, relationship, inviteToken],
  )
  return result
}

export const countBeneficiaries = async (willId) => {
  const [[row]] = await pool.execute(
    'SELECT COUNT(*) AS cnt FROM will_beneficiaries WHERE will_id = ? AND deleted_at IS NULL',
    [willId],
  )
  return row.cnt
}

export const findBeneficiariesByWillId = async (willId) => {
  const [rows] = await pool.execute(
    `SELECT * FROM will_beneficiaries
     WHERE will_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [willId],
  )
  return rows
}

export const findBeneficiaryByToken = async (token) => {
  const [rows] = await pool.execute(
    `SELECT * FROM will_beneficiaries
     WHERE invite_token = ? AND deleted_at IS NULL`,
    [token],
  )
  return rows[0] ?? null
}

/**
 * 본인 확인 성공 시각 기록 (스키마에 이미 존재하는 verified_at 컬럼을 채운다)
 */
export const updateBeneficiaryVerifiedAt = async (beneficiaryId) => {
  await pool.execute(
    `UPDATE will_beneficiaries
     SET verified_at = NOW(), updated_at = NOW()
     WHERE beneficiary_id = ? AND deleted_at IS NULL`,
    [beneficiaryId],
  )
}

/**
 * 열람 기록 (SPEC-05 2절, 마이그레이션 c README 4절 1번 지침)
 * video_watched_at은 COALESCE로 최초 1회만 설정, watch_count는 호출마다 +1.
 * issueWatchVideoUrl(본인 확인 통과 후 영상 URL 발급 시점)에서만 호출한다.
 */
export const recordWatch = async (beneficiaryId) => {
  await pool.execute(
    `UPDATE will_beneficiaries
     SET video_watched_at = COALESCE(video_watched_at, NOW()),
         watch_count = watch_count + 1,
         updated_at = NOW()
     WHERE beneficiary_id = ? AND deleted_at IS NULL`,
    [beneficiaryId],
  )
}

/**
 * 열람 링크(초대 토큰) 연장 재발급 (SPEC-05 3절) - 구토큰을 새 토큰으로 교체하고
 * 만료 시각을 갱신한다. "구토큰 무효화"는 별도 컬럼 없이 invite_token 자체를
 * 교체하는 것으로 구현한다 - 이전 토큰으로는 findBeneficiaryByToken이 더 이상
 * 조회되지 않으므로 즉시 무효화된다.
 */
export const extendBeneficiaryToken = async (beneficiaryId, { newToken, tokenExpiresAt }) => {
  await pool.execute(
    `UPDATE will_beneficiaries
     SET invite_token = ?, token_expires_at = ?, updated_at = NOW()
     WHERE beneficiary_id = ? AND deleted_at IS NULL`,
    [newToken, tokenExpiresAt, beneficiaryId],
  )
}

/**
 * SPEC-04 미열람 리마인드 - 만료 임박(withinDays 이내) + 미열람 수신인을 PK 커서로
 * 배치 스캔한다. LIMIT/OFFSET 페이지네이션은 스캔 도중 다른 행이 삽입/삭제되면
 * 대상이 밀리며 누락·중복 발송될 수 있어 쓰지 않는다(backend-patterns 컨벤션) -
 * will_beneficiaries.id(내부 AUTO_INCREMENT PK, 외부 노출 없음)로 커서를 이동한다.
 * idx_will_beneficiaries_expiry_watch(token_expires_at, video_watched_at) 활용 대상.
 */
export const findReminderCandidatesBatch = async ({ cursorId, withinDays, batchSize }) => {
  const [rows] = await pool.execute(
    `SELECT id, beneficiary_id, will_id, name, phone, invite_token, token_expires_at
     FROM will_beneficiaries
     WHERE id > ?
       AND token_expires_at IS NOT NULL
       AND token_expires_at > NOW()
       AND token_expires_at <= DATE_ADD(NOW(), INTERVAL ? DAY)
       AND video_watched_at IS NULL
       AND deleted_at IS NULL
     ORDER BY id ASC
     LIMIT ?`,
    [cursorId, withinDays, batchSize],
  )
  return rows
}

/**
 * 리마인드 1회 제한 판정 (SPEC-04 5절 "만료 임박 통지는 1회로 제한") - 스키마에
 * 별도 reminded_at 컬럼을 추가하지 않고, 이미 존재하는 audit_logs를 발송 이력
 * 대장으로 재사용한다(action='will_watch_reminder_sent').
 */
export const hasReminderBeenSent = async (beneficiaryId) => {
  const [rows] = await pool.execute(
    `SELECT 1 FROM audit_logs
     WHERE target_type = 'will_beneficiary' AND target_id = ? AND action = 'will_watch_reminder_sent'
     LIMIT 1`,
    [beneficiaryId],
  )
  return rows.length > 0
}

export const recordReminderSent = async (beneficiaryId, willId) => {
  await createAuditLog({
    logId: uuidv4(),
    actorId: beneficiaryId,
    actorType: 'system',
    action: 'will_watch_reminder_sent',
    targetType: 'will_beneficiary',
    targetId: beneficiaryId,
    detail: { willId },
  })
}

// ─── will_release_requests ────────────────────────────────────────────────────

export const createReleaseRequest = async ({
  requestId,
  willId,
  requestedBy,
  beneficiaryId,
  deathCertS3Key,
  deathCertUrl,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO will_release_requests
       (request_id, will_id, requested_by, beneficiary_id,
        death_cert_s3_key, death_cert_url,
        req_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
    [requestId, willId, requestedBy, beneficiaryId ?? null, deathCertS3Key, deathCertUrl],
  )
  return result
}

export const findReleaseRequest = async (requestId) => {
  const [rows] = await pool.execute(
    `SELECT * FROM will_release_requests
     WHERE request_id = ? AND deleted_at IS NULL`,
    [requestId],
  )
  return rows[0] ?? null
}

export const updateReleaseRequest = async (requestId, { reqStatus, reviewedBy, reviewedAt, rejectReason }) => {
  const fields = ['updated_at = NOW()']
  const values = []

  if (reqStatus !== undefined) {
    fields.push('req_status = ?')
    values.push(reqStatus)
  }
  if (reviewedBy !== undefined) {
    fields.push('reviewed_by = ?')
    values.push(reviewedBy)
  }
  if (reviewedAt !== undefined) {
    fields.push('reviewed_at = ?')
    values.push(reviewedAt)
  }
  if (rejectReason !== undefined) {
    fields.push('reject_reason = ?')
    values.push(rejectReason)
  }

  values.push(requestId)
  await pool.execute(
    `UPDATE will_release_requests SET ${fields.join(', ')}
     WHERE request_id = ? AND deleted_at IS NULL`,
    values,
  )
}

// ─── ai_jobs ──────────────────────────────────────────────────────────────────

export const createAiJob = async ({
  jobId,
  userId,
  bullmqJobId,
  jobType,
  targetType,
  targetId,
  queueName,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO ai_jobs
       (job_id, user_id, job_type, job_status, progress,
        bullmq_job_id, queue_name, target_type, target_id,
        retry_cnt, created_at, updated_at)
     VALUES (?, ?, ?, 'queued', 0, ?, ?, ?, ?, 0, NOW(), NOW())`,
    [jobId, userId, jobType, bullmqJobId, queueName, targetType, targetId],
  )
  return result
}

export const updateAiJob = async (jobId, updates) => {
  const AI_JOB_UPDATABLE = ['job_status', 'progress', 'result_url', 'error_message', 'bullmq_job_id']
  const entries = Object.entries(updates).filter(([k]) => AI_JOB_UPDATABLE.includes(k))
  if (entries.length === 0) return

  const fields = entries.map(([k]) => `${k} = ?`)
  const values = entries.map(([, v]) => v)

  fields.push('updated_at = NOW()')

  const status = updates.job_status
  if (status === 'running') {
    fields.push('started_at = COALESCE(started_at, NOW())')
  }
  if (status === 'completed' || status === 'failed') {
    fields.push('completed_at = NOW()')
  }

  values.push(jobId)
  await pool.execute(
    `UPDATE ai_jobs SET ${fields.join(', ')} WHERE job_id = ? AND deleted_at IS NULL`,
    values,
  )
}

export const findAiJobByTarget = async (targetId) => {
  const [rows] = await pool.execute(
    `SELECT * FROM ai_jobs
     WHERE target_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [targetId],
  )
  return rows[0] ?? null
}

// ─── audit_logs (열람 본인 확인 - SPEC-05 2절 "잠금·비정상 접근은 audit_logs 기록") ───
// admin 도메인이 소유한 테이블은 아니지만, adminService.js도 notifications 테이블에
// 직접 INSERT하는 동일한 관례(도메인 경계를 넘는 공용 테이블은 pool.execute로 직접
// 기록, 다른 도메인 리포지토리를 import하지 않음)를 따른다.
//
// audit_logs.actor_id는 NOT NULL이고 actor_type은 ENUM('user','admin','system')이라
// "완전한 익명"(토큰 자체가 존재하지 않는 요청)은 기록할 신원이 없어 여기 남기지
// 않는다 - 그런 요청은 releaseLimiter/watchLimiter의 IP+token 기반 rate limit이
// 1차 방어선이다. 토큰이 실재해 beneficiary가 특정된 경우(본인확인 성공/실패/잠금)만
// beneficiary_id를 actor_id로, actor_type='user'로 기록한다(로그인 계정은 아니지만
// ENUM에 '비회원 접근자'에 대응하는 값이 없어 사람 주체 중 가장 가까운 값을 쓴다).
export const createAuditLog = async ({
  logId,
  actorId,
  actorType,
  action,
  targetType,
  targetId,
  ipAddress,
  userAgent,
  detail,
}) => {
  await pool.execute(
    `INSERT INTO audit_logs
       (log_id, actor_id, actor_type, action, target_type, target_id,
        ip_address, user_agent, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      logId,
      actorId,
      actorType,
      action,
      targetType ?? null,
      targetId ?? null,
      ipAddress ?? null,
      userAgent ?? null,
      detail ? JSON.stringify(detail) : null,
    ],
  )
}

// ─── 트랜잭션: 유언장 + 수혜자 일괄 생성 ─────────────────────────────────────────

/**
 * 유언장 생성과 수혜자 등록을 단일 트랜잭션으로 처리
 * 수혜자 INSERT 중 실패 시 유언장 생성도 롤백
 *
 * @param {object} willData - createWill 과 동일한 필드
 * @param {Array<object>} beneficiariesData - createBeneficiary 필드 배열
 */
export const createWillWithBeneficiaries = async (willData, beneficiariesData) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const {
      willId, userId, voiceSampleId, title, contentText, releasePolicy, priceKrw, eventType,
    } = willData

    await connection.execute(
      `INSERT INTO wills
         (will_id, user_id, voice_sample_id, title, content_text,
          status, release_policy, release_status, price_krw, event_type,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, 'locked', ?, ?, NOW(), NOW())`,
      [willId, userId, voiceSampleId, title, contentText, releasePolicy, priceKrw ?? 49000, eventType ?? null],
    )

    if (beneficiariesData.length > 0) {
      // 배치 INSERT - 수혜자 N명을 단일 쿼리로 처리 (N+1 방지)
      const placeholders = beneficiariesData
        .map(() => '(?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())')
        .join(', ')
      const flatValues = beneficiariesData.flatMap((b) => [
        b.beneficiaryId,
        b.willId,
        b.userId ?? null,
        b.name,
        b.email,
        b.phone ?? null,
        b.relationship,
        b.inviteToken,
      ])
      await connection.execute(
        `INSERT INTO will_beneficiaries
           (beneficiary_id, will_id, user_id, name, email, phone, relationship,
            invite_token, created_at, updated_at)
         VALUES ${placeholders}`,
        flatValues,
      )
    }

    await connection.commit()
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}
