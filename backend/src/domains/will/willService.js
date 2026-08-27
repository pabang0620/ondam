import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import * as repo from './willRepository.js'
import { encryptString, decryptBuffer, encryptStringEnvelope, decryptStringEnvelope, KMS_KEY_ID_MISSING_CODE } from '../../utils/kms.js'
import { getPresignedUrl, getPresignedDownloadUrl, extractS3KeyFromUrl } from '../../utils/s3.js'
import { voiceCloneQueue, videoGenerateQueue, notificationQueue } from '../../jobs/queue.js'
import pool from '../../config/db.js'
import redis from '../../config/redis.js'
import { pick, pickAll } from '../../utils/dto.js'
import { toSafeFailureMessage } from '../../utils/failureMessages.js'

// ─── 응답 화이트리스트 (KMS 참조값 유출 방지) ────────────────────────────────────
// [보안 수정] wills 행을 그대로(스프레드로) 응답에 흘려보내면 result_video_s3_key_
// encrypted/result_video_kms_key_id(KMS 암호화 s3 키 참조값)까지 그대로 새어나간다 -
// 실제로 getWill이 이렇게 새고 있었다. 새 컬럼이 추가돼도 자동으로 새지 않도록
// 블랙리스트(omitId)가 아닌 화이트리스트(pick)로 응답 필드를 명시한다. 영상 재생/
// 다운로드 URL은 이 필드들이 아니라 verifyWatchAccess가 KMS 복호화 후 발급하는
// presigned URL로만 나간다.
const WILL_PUBLIC_FIELDS = [
  'will_id', 'user_id', 'voice_sample_id', 'title', 'content_text',
  'status', 'release_policy', 'release_status', 'released_at', 'event_type',
  'price_krw', 'result_video_duration_sec', 'created_at', 'updated_at',
]
const toWillDto = (will) => pick(will, WILL_PUBLIC_FIELDS)
const toWillDtos = (wills) => pickAll(wills, WILL_PUBLIC_FIELDS)

// invite_token(시청 링크 토큰 원문)은 수혜자 본인에게 SMS/이메일로만 전달되고,
// 유언장 소유자(본인)에게도 절대 다시 노출하지 않는다 - 재노출되면 소유자 화면이나
// 로그를 통해 토큰이 다시 새 나갈 표면이 하나 더 생긴다. 화이트리스트라 향후 추가되는
// 컬럼도 여기 명시하지 않는 한 자동으로는 새지 않는다.
const BENEFICIARY_PUBLIC_FIELDS = [
  'beneficiary_id', 'will_id', 'user_id', 'name', 'email', 'phone', 'relationship',
  'verified_at', 'delivered_at', 'video_watched_at', 'watch_count', 'token_expires_at',
  'created_at', 'updated_at',
]
const toBeneficiaryDtos = (rows) => pickAll(rows, BENEFICIARY_PUBLIC_FIELDS)

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
  return `마지막영상편지_${safeName || '리멤버미'}.mp4`
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

// [보안 수정 - D1] 잠금·시도 횟수 키를 토큰이 아니라 수신인(beneficiary_id) 기준으로
// 둔다. 토큰은 /watch/:token/extend로 얼마든지 회전(재발급)될 수 있는데, 키가
// 토큰 문자열이면 재발급 즉시 시도 횟수·잠금이 초기화되어 "4회 오입력 → extend →
// 새 토큰으로 4회 더"를 무한 반복해 5회 잠금이 사실상 우회됐다(D1 취약점의 핵심
// 원인). beneficiary_id는 토큰이 아무리 회전해도 동일하므로, 동일 인물에 대한
// 시도 횟수·잠금 상태가 토큰 회전과 무관하게 계속 누적된다.
// [FIX D13] export - adminService.unlockWillWatchAccess가 동일한 Redis 키 포맷을
// 재사용한다. 문자열을 admin 쪽에 따로 하드코딩하면 이 파일에서 포맷이 바뀔 때
// 조용히 어긋나(admin이 엉뚱한 키를 지워 해제가 안 되는) 방식으로 깨질 수 있다.
export const watchAttemptsKey = (beneficiaryId) => `will:watch:attempts:${beneficiaryId}`
export const watchLockKey = (beneficiaryId) => `will:watch:locked:${beneficiaryId}`

const extractPhoneLast4 = (phone) => {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : null
}

// 유언 영상 편지 - 베이직 단일가 (2026-08-21 오너 확정). 가격은 서버가 결정하는
// 단일 정본이며 클라이언트 입력(priceKrw)을 받지 않는다. payment 도메인의
// preparePayment는 wills.price_krw(이 값으로 저장된 스냅샷)를 조회해 검증한다.
const WILL_BASIC_PRICE_KRW = 49000

// ─── 유언 텍스트 KMS 봉투 암호화 (보안 갭 1 수정 + 4KB 제한 수정 2026-08-23) ───────
// CLAUDE.md 보안 규칙 1번·스키마 주석 모두 wills.content_text를 KMS 암호화 대상으로
// 명시하는데, 지금까지 createWill이 encryptString 호출 없이 평문 그대로 저장하고
// 있었다(보안 갭 1). 그 후 encryptString(KMS Encrypt API 직접 호출)로 수정됐으나,
// 이 API는 평문 4,096바이트 제한이 있다 - 유언 텍스트는 라우트 zod가 최대 5,000자를
// 허용하고 한글은 UTF-8로 글자당 최대 4바이트라 최대 약 20,000바이트까지 갈 수
// 있어, 긴 유언장은 실제 AWS 환경에서 ValidationException으로 저장 자체가
// 실패했다. 이제는 utils/kms.js의 encryptStringEnvelope/decryptStringEnvelope
// (GenerateDataKey + 로컬 AES-256-GCM, AWS 공식 권장 봉투 암호화 패턴)를 쓴다 -
// 크기 제한이 사실상 사라진다.
//
// 로컬 개발 폴백: KMS_KEY_ID가 .env에 비어 있으면 encryptStringEnvelope이 즉시
// 예외를 던진다(kms.js getKmsKeyId). 다른 KMS 연동 지점(음성 샘플 업로드의
// s3_key_encrypted, S3 SSE-KMS 업로드)은 전부 이 경우 그대로 하드 실패하도록
// 되어 있다 - 그러나 "로컬 개발에서 유언장 생성이 막히면 안 된다"는 이 갭 수정
// 자체의 요구사항이라, 여기서만 명시적으로 그 예외를 잡아 평문 바이트를 그대로
// 저장하는 개발 전용 폴백을 둔다(새 암호화 방식을 만드는 게 아니라 "암호화하지
// 않고 그 사실을 kms_key_id=NULL로 남긴다"는 무연산 폴백이다). 프로덕션은
// KMS_KEY_ID가 반드시 설정되어 있어야 하고(validateEnv.js가 미설정 시 경고), 그
// 경우 이 폴백은 절대 발동하지 않으며 항상 실제 KMS 봉투 암호화 경로를 탄다.
//
// [회귀 수정 2026-08] kms.js가 사용자 노출 메시지를 toSafeFailureMessage로 안전한
// 문구로 치환하면서, 아래 폴백이 예전에 쓰던 "err.message === 원문 문자열" 비교가
// 더 이상 매칭되지 않아 로컬 개발에서 유언장 생성이 항상 503으로 막히는 회귀가
// 있었다(이번에 수정). 메시지 문자열은 안전화·번역 등으로 언제든 바뀔 수 있는
// 표현이라 분기 조건으로 삼기에 취약하다 - 이제는 kms.js가 던지는 구조적 마커
// (err.code === KMS_KEY_ID_MISSING_CODE)로 "환경변수가 아예 없다"만 식별한다.
// 단, 이 마커 하나만으로 폴백을 여는 것은 여전히 위험하다 - wrapKmsError는
// 자격 증명 무효·네트워크 장애 같은 실제 KMS 장애도 503으로 재분류하는데, 그런
// 에러엔 이 code가 없으므로 여기서는 안 걸리지만, 혹시라도 잘못 분류되거나 향후
// 코드가 바뀌어 code가 잘못 붙는 경우까지 대비해 "개발 환경일 것"을 두 번째
// 조건으로 반드시 함께 요구한다(AND, OR 아님) - 두 조건 중 하나라도 프로덕션
// 신호를 보이면 폴백하지 않고 그대로 503 실패로 흘려보낸다. 개발 환경 판정은
// `process.env.NODE_ENV === 'development'`(server.js:196과 동일한 관용구,
// 화이트리스트 비교)를 쓴다 - `!== 'production'`처럼 블랙리스트로 검사하면
// NODE_ENV가 비어 있거나 'staging'·오타 등 예상 못 한 값일 때도 통과해버려
// "설정을 안 하면 오히려 더 위험해지는" 실패-오픈(fail-open) 구조가 된다.
// 화이트리스트 비교는 반대로 NODE_ENV가 정확히 'development'로 명시된 경우에만
// 열리고, 그 외 모든 값(미설정 포함)은 실패-클로즈(fail-closed)로 떨어져
// 평문 저장을 막는다 - 유언장처럼 KMS 암호화가 하드 요구사항인 데이터에는
// 이쪽이 안전한 기본값이다. 참고로 server.js:196~213 주석에도 "NODE_ENV 설정에
// 기대는 잔여 위험"이 이미 명시돼 있다 - 이는 근본적으로 해소 가능한 위험이
// 아니라(어떤 신호를 쓰든 배포 설정 실수는 발생할 수 있다) 배포 체크리스트로
// 관리해야 하는 항목이다. 이 프로젝트에 별도의 "프로덕션 확정" 신호(예: 클라우드
// 메타데이터, 별도 인프라 플래그)가 아직 없으므로, 화이트리스트 NODE_ENV 비교 +
// KMS 마커 이중 조건이 현재로선 최선의 근사치다.
const isLocalDevEnvironment = () => process.env.NODE_ENV === 'development'
//
// 세 가지 저장 형태가 섞여 있을 수 있어 content_text_enc_format 컬럼으로 구분한다
// (2026-08-23 추가, ondam_schema.sql 동일 반영):
//   1) content_text_kms_key_id IS NULL
//      → 평문(개발 폴백 또는 이번 KMS 도입 이전의 레거시 평문 행)
//   2) content_text_kms_key_id NOT NULL, content_text_enc_format IS NULL
//      → 구 형식: KMS Encrypt() 직접 호출 암호문(4KB 제한 있던 시절 생성분) -
//        decryptBuffer로 복호화
//   3) content_text_kms_key_id NOT NULL, content_text_enc_format = 'envelope'
//      → 신 형식: 봉투 암호화(이번 수정, 4KB 제한 없음) - decryptStringEnvelope로 복호화
// 기존 행은 어느 쪽도 새 값을 쓰지 않으므로(3번 조건에 해당하지 않음) 자동으로
// 1번 또는 2번 규약을 그대로 유지하며 깨지지 않는다.
const WILL_ENC_FORMAT_ENVELOPE = 'envelope'

const encryptWillContent = async (plaintext) => {
  try {
    const { encrypted, kmsKeyId } = await encryptStringEnvelope(plaintext)
    return {
      contentTextEncrypted: encrypted,
      contentTextKmsKeyId: kmsKeyId,
      contentTextEncFormat: WILL_ENC_FORMAT_ENVELOPE,
    }
  } catch (err) {
    // 이중 조건 - 둘 다 참일 때만 평문 폴백을 허용한다. 하나라도 아니면(마커가
    // 없다 = 자격 증명·네트워크 등 실제 KMS 장애일 가능성, 또는 개발 환경이
    // 아니다 = 프로덕션/스테이징일 가능성) 절대 폴백하지 않고 원래 503 에러를
    // 그대로 던진다 - 유언장을 평문으로 저장하느니 실패하는 쪽을 택한다.
    if (err.code === KMS_KEY_ID_MISSING_CODE && isLocalDevEnvironment()) {
      console.warn(
        '[willService] KMS_KEY_ID 미설정 - 로컬 개발 폴백으로 유언 텍스트를 암호화하지 ' +
        '않고 저장합니다(content_text_kms_key_id=NULL). 프로덕션 배포 전 반드시 KMS_KEY_ID를 설정하세요.',
      )
      return { contentTextEncrypted: Buffer.from(plaintext, 'utf8'), contentTextKmsKeyId: null, contentTextEncFormat: null }
    }
    throw err
  }
}

const decryptWillContent = async (encryptedValue, kmsKeyId, encFormat) => {
  if (encryptedValue === null || encryptedValue === undefined) return null
  const buf = Buffer.isBuffer(encryptedValue) ? encryptedValue : Buffer.from(encryptedValue)
  if (!kmsKeyId) {
    // 개발 폴백(또는 전환 이전 레거시) 값 - 실제로 암호화된 적이 없으므로 KMS를
    // 호출하지 않고 바로 문자열로 복원한다
    return buf.toString('utf8')
  }
  if (encFormat === WILL_ENC_FORMAT_ENVELOPE) {
    return decryptStringEnvelope(buf)
  }
  // enc_format이 NULL인데 kms_key_id는 있는 행 = 봉투 암호화 도입 이전, KMS
  // Encrypt() 직접 호출로 암호화된 구 형식
  return decryptBuffer(buf)
}

// ─── 음성 샘플 ────────────────────────────────────────────────────────────────

// [비대칭 수정 - 2026-08] uploadVoiceSample의 encryptString(s3Key)에는 encryptWillContent와
// 같은 로컬 개발 폴백이 없어서, KMS_KEY_ID가 비어 있는 로컬 개발 환경에서는 음성 샘플
// "등록"(실제 파일 업로드가 아니라 이미 업로드된 s3Key를 DB에 기록하는 단계) 자체가
// 항상 503으로 막혔다 - 그 결과 영상 편지 전체 플로우(음성 등록 → 유언장 생성 → 활성화)를
// 로컬에서 끝까지 검증할 수 없었다.
//
// s3Key는 음성 파일의 내용이 아니라 파일 위치를 가리키는 참조 문자열이라 유언 본문
// 텍스트보다 민감도는 낮지만, 이 프로젝트는 이미 그런 참조값(결과 영상 s3 키 등)도
// 전부 KMS로 감싸는 정책이라 여기만 예외로 두면 오히려 정책이 일관되지 않는다 - 그래서
// "폴백을 아예 두지 않는다"가 아니라 encryptWillContent와 정확히 같은 이중 조건으로
// 통일한다: err.code === KMS_KEY_ID_MISSING_CODE(환경변수가 아예 없다는 구조적 마커)
// AND NODE_ENV === 'development'(화이트리스트 비교, isLocalDevEnvironment) - 자격
// 증명 무효·프로덕션 등 하나라도 다른 신호가 섞이면 폴백하지 않고 그대로 503.
//
// [스키마 제약] voice_samples.kms_key_id는 wills.content_text_kms_key_id와 달리
// `VARCHAR(200) NOT NULL`이다(이 폴백이 생기기 전에 설계된 컬럼이라 NULL을 저장할
// 수 없음). NOT NULL 제약을 완화하는 스키마 변경(별도 마이그레이션·승인 필요)까지는
// 이번 수정 범위에 넣지 않고, 대신 빈 문자열('')을 "실제로 암호화되지 않았다" 마커로
// 쓴다 - decryptWillContent와 동일하게 `if (!kmsKeyId)`(falsy 검사)로 판정하므로
// ''도 NULL과 완전히 동일하게 처리된다(voiceWorker.js의 복호화 분기 참고).
const VOICE_SAMPLE_KMS_FALLBACK_MARKER = ''

const encryptVoiceSampleS3Key = async (s3Key) => {
  try {
    const { encrypted, kmsKeyId } = await encryptString(s3Key)
    return { s3KeyEncrypted: encrypted, kmsKeyId }
  } catch (err) {
    // 이중 조건 - encryptWillContent와 동일 (하나라도 아니면 폴백하지 않고 503 유지)
    if (err.code === KMS_KEY_ID_MISSING_CODE && isLocalDevEnvironment()) {
      console.warn(
        '[willService] KMS_KEY_ID 미설정 - 로컬 개발 폴백으로 음성 샘플 S3 키를 암호화하지 ' +
        "않고 저장합니다(voice_samples.kms_key_id=''). 프로덕션 배포 전 반드시 KMS_KEY_ID를 설정하세요.",
      )
      return { s3KeyEncrypted: Buffer.from(s3Key, 'utf8'), kmsKeyId: VOICE_SAMPLE_KMS_FALLBACK_MARKER }
    }
    throw err
  }
}

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
      new Error('음성 처리를 위한 동의가 필요합니다. 동의 확인 화면으로 돌아가 동의 항목에 체크한 후 다시 시도해 주세요.'),
      { status: 400 },
    )
  }

  const { s3KeyEncrypted: encrypted, kmsKeyId } = await encryptVoiceSampleS3Key(s3Key)

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
      new Error('음성 클론이 아직 완료되지 않았습니다. clone_status가 ready일 때 영상 편지를 생성하세요.'),
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

  // 유언 텍스트 KMS 암호화 (보안 갭 1 수정) - 트랜잭션 진입 전에 암호화까지 끝내
  // 트랜잭션 내부에서는 순수 DB I/O만 남긴다(암호화 실패로 트랜잭션이 열린 채
  // 오래 대기하는 상황 방지)
  const { contentTextEncrypted, contentTextKmsKeyId, contentTextEncFormat } = await encryptWillContent(contentText)

  // 유언장 + 수혜자 트랜잭션 일괄 생성
  await repo.createWillWithBeneficiaries(
    {
      willId,
      userId,
      voiceSampleId,
      title,
      contentTextEncrypted,
      contentTextKmsKeyId,
      contentTextEncFormat,
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
    throw Object.assign(new Error('영상 편지를 찾을 수 없습니다'), { status: 404 })
  }
  if (String(will.user_id) !== String(userId)) {
    throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
  }

  const rawBeneficiaries = await repo.findBeneficiariesByWillId(willId)
  // 화이트리스트 응답 - invite_token(시청 링크 토큰 원문)과 내부 AUTO_INCREMENT id는
  // BENEFICIARY_PUBLIC_FIELDS에 없으므로 자동으로 제외된다 - DEV-33 + KMS 참조값
  // 유출 수정과 동일한 원칙(화이트리스트가 새 민감 컬럼에도 안전).
  const beneficiaries = toBeneficiaryDtos(rawBeneficiaries)
  // KMS 복호화 (보안 갭 1 수정) - content_text_encrypted/content_text_kms_key_id는
  // WILL_PUBLIC_FIELDS 화이트리스트에 없으므로 애초에 응답에 새지 않는다. 복호화한
  // 평문을 'content_text' 키로 병합한 뒤 pick하면 화이트리스트가 정확히 그 키만 뽑는다.
  const contentText = await decryptWillContent(
    will.content_text_encrypted, will.content_text_kms_key_id, will.content_text_enc_format,
  )
  // 화이트리스트 응답 - result_video_s3_key_encrypted/result_video_kms_key_id(KMS 참조값)와
  // 내부 AUTO_INCREMENT id는 WILL_PUBLIC_FIELDS에 없으므로 자동으로 제외된다.
  return { ...toWillDto({ ...will, content_text: contentText }), beneficiaries }
}

/**
 * 유언장 목록 조회 (페이지네이션)
 */
export const getWills = async (userId, { page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit
  const { wills, total } = await repo.findWillsByUserId(userId, { limit, offset })
  // [성능 수정] 목록 화면(마이페이지·보관함)은 title/status/날짜만 쓰고 본문을 쓰지
  // 않는다(frontend/src/pages/{mypage,will}에서 content_text/contentText 참조 없음
  // grep으로 확인 - MyPage.jsx·WillVaultPage.jsx는 will_id/title/status/created_at만
  // 사용). 행마다 KMS Decrypt를 거는 것은 최대 limit(50)건 조회 시마다 최대 50회
  // KMS 호출을 유발해 마이페이지 진입을 눈에 띄게 느리게 만든다 - 목록에서는
  // 복호화를 아예 하지 않는다. 본문은 상세 조회(getWill)에서만 복호화한다.
  // content_text를 병합하지 않으므로 toWillDtos(pick)가 'content_text in row'를
  // false로 판정해 응답에서 자동으로 빠진다(WILL_PUBLIC_FIELDS는 그대로 두되
  // 화이트리스트 특성상 값이 없으면 노출되지 않는다).
  return {
    // 화이트리스트 응답 - content_text_encrypted/content_text_kms_key_id,
    // result_video_s3_key_encrypted/result_video_kms_key_id(KMS 참조값)와 내부
    // AUTO_INCREMENT id는 WILL_PUBLIC_FIELDS에 없으므로 자동 제외된다.
    wills: toWillDtos(wills),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

/**
 * 유언장 활성화 - 영상 생성 큐 등록 (결제 후 호출)
 * FOR UPDATE 비관적 락으로 동시 활성화 요청 경쟁 조건 방지
 *
 * [보안 수정 - D2] wills.status는 draft(미결제) → paid(결제 완료) → active(영상 생성
 * 요청됨)로 전이한다. 예전 코드는 ['draft','paid'] 둘 다 허용해서 결제 한 번도
 * 없이 draft 상태 그대로 activate를 호출해도 통과했다 - ElevenLabs·립싱크 벤더
 * 비용이 실제로 드는 videoGenerate 큐가 무결제로 등록된 것(D2 취약점).
 * status='paid'는 두 경로 모두에서만 설정된다: (1) 직접 결제 -
 * paymentService._updateTargetStatus의 target_type='will_order' 분기가
 * `UPDATE wills SET status='paid'`를 실행 (2) 선물 결제 경유 -
 * giftPerformService.attachWillOrder가 gift_orders.payment_id가 채워진(결제 완료된)
 * 선물을 will에 attach할 때 동일하게 `willRepository.updateWill(willId, { status:
 * 'paid' })`를 호출. 즉 'paid'만 검사하면 직접 결제·선물 결제 두 경로 모두
 * 정상 허용되고, 결제 자체가 없는 'draft'만 정확히 차단된다.
 */
// [G4-4 동일 패턴 적용] activateWill도 paymentService.confirmPayment와 동일하게 락
// 구간과 외부 호출(KMS 복호화, Redis BullMQ 등록) 구간을 분리한다. 이전에는 FOR
// UPDATE 락을 쥔 채로 KMS 네트워크 호출까지 했다 - connectionLimit=10인 풀에서
// KMS가 느려지면 결제와 무관한 다른 API까지 커넥션 고갈로 멈출 수 있었다.
//
//   1) 짧은 트랜잭션 #1 - FOR UPDATE로 상태·조건 확인 후, wills.status를
//      'paid' → 'active'로 곧바로 확정하고 즉시 commit(락 해제). status ENUM에는
//      payments.toss_payment_key 같은 별도 "선점(claim)" 컬럼이 없으므로, 'paid'만
//      허용하는 상태 전이 자체가 곧 선점 마커다 - 동시에 들어온 두 번째 요청은
//      같은 조건 검사에서 status !== 'paid'를 보고 즉시 거부되어, KMS/큐가 두 번
//      호출되는 경쟁 조건이 발생하지 않는다(원래 FOR UPDATE의 목적 유지).
//   2) 락 밖에서 KMS 복호화 → BullMQ videoGenerateQueue.add
//   3) ai_jobs 기록은 bullJob.id가 필요해 큐 등록 성공 이후에만 가능하다
//
// 정합성 보장 - "큐 등록 성공 + DB 롤백(유령 잡)" vs "DB만 커밋 + 큐 등록 실패
// (영영 미처리)" 두 실패 모드 중 어느 쪽이 발생해도 되돌릴 수 있는 쪽을 택한다:
//   - status='active' 커밋을 큐 등록보다 먼저 확정한다. 그래야 KMS/큐 호출이
//     실패해도 "이미 결제완료·비용 발생 전" 상태이므로 아래 catch에서 status를
//     'paid'로 보상(compensate)해 되돌리면 사용자가 안전하게 재시도할 수 있다.
//     반대로 큐 등록을 먼저 하고 DB 커밋을 나중에 하면, DB 커밋 실패 시 이미
//     videoWorker가 ElevenLabs/립싱크 벤더 비용을 실제로 써버린 뒤라 되돌릴 수
//     없는 유령 잡이 된다(보상 불가능한 실패 모드) - 그래서 이 순서를 택했다.
//   - ai_jobs 기록 실패는 큐 등록이 이미 성공한 뒤이므로 상태를 되돌리지 않는다
//     (paymentService confirmPayment의 conn2 실패 처리와 동일한 원칙 - "이미
//     외부에서 확정된 사실을 DB 기록 실패를 이유로 되돌리면 더 큰 불일치가
//     생긴다"). 대신 상세 로그만 남기고 큐 등록은 유효한 것으로 간주해 정상
//     반환한다 - videoWorker의 updateAiJob은 bullmq_job_id로 매칭되는 행이 없으면
//     0건 UPDATE로 조용히 넘어갈 뿐 워커 자체는 계속 진행되므로, 폴링 화면에
//     진행률이 한동안 안 보일 수 있다는 것 외에는 영상 생성 자체는 정상 완료된다.
export const activateWill = async (userId, willId) => {
  // ── 짧은 트랜잭션 #1: 상태·조건 확인 + 'active' 확정, 즉시 commit ──
  const conn = await pool.getConnection()
  let prevStatus
  let sample
  let photoS3Key
  let contentTextEncrypted
  let contentTextKmsKeyId
  let contentTextEncFormat
  try {
    await conn.beginTransaction()

    // FOR UPDATE - 동일 will_id에 대한 동시 요청 중 하나만 진행
    const [[will]] = await conn.execute(
      'SELECT * FROM wills WHERE will_id = ? AND deleted_at IS NULL FOR UPDATE',
      [willId],
    )
    if (!will) {
      throw Object.assign(new Error('영상 편지를 찾을 수 없습니다'), { status: 404 })
    }
    if (String(will.user_id) !== String(userId)) {
      throw Object.assign(new Error('접근 권한이 없습니다'), { status: 403 })
    }
    if (will.status === 'draft') {
      throw Object.assign(
        new Error('결제가 아직 완료되지 않았어요. 결제 후 이용하실 수 있어요.'),
        { status: 400 },
      )
    }
    if (will.status !== 'paid') {
      throw Object.assign(new Error('이미 처리 중이거나 완료된 영상 편지입니다'), { status: 400 })
    }

    // 음성 샘플 조회 - null이면 400 에러 (순수 DB 조회, 외부 호출 아님 - 락 안에 유지)
    sample = await repo.findVoiceSampleById(will.voice_sample_id)
    if (!sample) {
      throw Object.assign(new Error('음성 샘플이 없습니다'), { status: 400 })
    }
    if (sample.clone_status !== 'ready') {
      throw Object.assign(
        new Error(`음성 복제가 아직 완료되지 않았습니다 (현재: ${sample.clone_status})`),
        { status: 400 },
      )
    }

    // 사용자 프로필 이미지 S3 키 조회 (videoWorker 사진 소스) - 순수 DB 조회
    const profileImageUrl = await repo.findUserProfileImageUrl(userId)
    photoS3Key = extractS3KeyFromUrl(profileImageUrl)
    if (!photoS3Key) {
      throw Object.assign(
        new Error('프로필 사진이 없습니다. 영상 편지 생성 전 프로필 사진을 등록해 주세요.'),
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

    // [보안 수정 - 초상권/AI 생성물 동의 게이트] activateWill은 프로필 사진(얼굴)과
    // 클론 음성을 합성해 새 영상을 생성하고 그 결과를 서비스에 보관한다 - voice
    // 동의만으로는 부족하다. WillConsentPage는 portrait/voice/ai_generation/
    // posthumous_release 4종을 전부 "(필수)"로 동시에 요구하는데, 서버에는 voice
    // 게이트만 있어 나머지 3종은 미동의로도 통과했다(실측 결함). posthumous_release는
    // 여기서 검사하지 않는다 - "사망 확인 후 유가족에게 공개"라는 그 동의의 실제
    // 대상 행위는 activateWill(영상 생성) 시점이 아니라 adminService.approveRelease
    // (실제로 공개되는 시점)에서 검사한다(아래 해당 함수 참고).
    const portraitConsent = await repo.findPortraitConsent(userId)
    if (!portraitConsent || portraitConsent.is_agreed !== 1) {
      throw Object.assign(new Error('초상권 처리 동의가 필요합니다'), { status: 400 })
    }
    const aiGenConsent = await repo.findAiGenerationConsent(userId)
    if (!aiGenConsent || aiGenConsent.is_agreed !== 1) {
      throw Object.assign(new Error('AI 생성물 이용 동의가 필요합니다'), { status: 400 })
    }

    // KMS 복호화·큐 등록에 필요한 값만 락 안에서 꺼내두고(추가 네트워크 호출 없음),
    // 실제 복호화(decryptWillContent)는 락 밖(2단계)에서 수행한다.
    prevStatus = will.status
    contentTextEncrypted = will.content_text_encrypted
    contentTextKmsKeyId = will.content_text_kms_key_id
    contentTextEncFormat = will.content_text_enc_format

    // status 확정 - 'paid' → 'active'. 이 UPDATE 자체가 동시 요청에 대한 선점
    // (claim) 역할을 한다(위 함수 주석 참고).
    await conn.execute(
      'UPDATE wills SET status = ?, updated_at = NOW() WHERE will_id = ?',
      ['active', willId],
    )
    await repo.addWillStatusLog({
      logId: uuidv4(),
      willId,
      prevStatus,
      nextStatus: 'active',
      changedBy: userId,
      changedByType: 'user',
      reason: '사용자 활성화 요청',
    })

    await conn.commit()
  } catch (err) {
    await conn.rollback().catch(() => {})
    throw err
  } finally {
    conn.release()
  }

  // ── 락 밖: KMS 복호화 + BullMQ 큐 등록 ──
  // videoWorker는 TTS 생성을 위해 평문이 필요하다. content_text_encrypted를 그대로
  // 큐 페이로드에 넣으면 워커가 KMS 복호화를 몰라 그대로 TTS API에 암호문을 넘기게 된다.
  let bullJob
  try {
    const contentText = await decryptWillContent(
      contentTextEncrypted, contentTextKmsKeyId, contentTextEncFormat,
    )

    bullJob = await videoGenerateQueue.add('generate', {
      willId,
      userId,
      photoS3Key,
      voiceS3KeyEncrypted: sample.s3_key_encrypted.toString('base64'),
      voiceKmsKeyId: sample.kms_key_id,
      elevenlabsVoiceId: sample.elevenlabs_voice_id ?? null,
      contentText,
    })
  } catch (err) {
    // [보상 트랜잭션] status='active'는 이미 커밋됐는데 KMS 복호화나 큐 등록이
    // 실패했다 - 이대로 두면 결제·활성화는 완료 상태인데 영상 생성 잡이 전혀 없는
    // "영영 처리되지 않는 유언장"이 된다. 아직 벤더 비용이 발생하지 않은 시점이므로
    // status를 'paid'로 되돌려 사용자가 안전하게 재시도할 수 있게 한다.
    await pool.execute(
      "UPDATE wills SET status = 'paid', updated_at = NOW() WHERE will_id = ? AND status = 'active'",
      [willId],
    ).catch((compErr) => {
      console.error(
        '[willService] activateWill 보상(rollback to paid) 실패 - 수동 확인 필요:',
        { willId, error: compErr.message },
      )
    })
    await repo.addWillStatusLog({
      logId: uuidv4(),
      willId,
      prevStatus: 'active',
      nextStatus: 'paid',
      changedBy: userId,
      changedByType: 'user',
      reason: `활성화 실패 자동 롤백 (${err.message})`,
    }).catch(() => {})
    throw err
  }

  // ai_jobs 기록 - bullJob.id가 필요해 큐 등록 성공 이후에만 가능하다. 이 시점부터는
  // 큐 등록이 이미 확정된 사실이므로, 아래 INSERT가 실패해도 status를 되돌리지
  // 않는다(위 함수 주석의 정합성 설명 참고) - 상세 로그만 남기고 정상 반환한다.
  const jobId = uuidv4()
  try {
    await repo.createAiJob({
      jobId,
      userId,
      bullmqJobId: bullJob.id,
      jobType: 'video_generate',
      targetType: 'will',
      targetId: willId,
      queueName: 'videoGenerate',
    })
  } catch (err) {
    console.error(
      '[willService] activateWill ai_jobs 기록 실패 - 큐 등록은 이미 완료됨(수동 확인 필요):',
      { willId, bullJobId: String(bullJob.id), error: err.message },
    )
  }

  return { jobId, bullJobId: String(bullJob.id) }
}

/**
 * 영상 생성 진행 상태 조회 (폴링용)
 */
export const getVideoStatus = async (userId, willId) => {
  const will = await repo.findWillById(willId)
  if (!will) {
    throw Object.assign(new Error('영상 편지를 찾을 수 없습니다'), { status: 404 })
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
          // [보안 수정] ai_jobs.error_message는 videoWorker가 err.message(내부 원문 -
          // 환경변수명, ElevenLabs/립싱크 벤더 응답 원문 등)를 그대로 저장한 값이다
          // (운영 진단 목적으로 DB에는 원문 그대로 남긴다). 소유자에게 나가는 응답만
          // 안전한 문구로 치환한다(보안 갭 2 수정, utils/failureMessages.js).
          errorMessage: toSafeFailureMessage(job.error_message),
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
    throw Object.assign(new Error('영상 편지를 찾을 수 없습니다'), { status: 404 })
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
    throw Object.assign(new Error('활성화된 영상 편지만 공개 요청이 가능합니다'), { status: 400 })
  }
  if (will.release_status === 'released') {
    throw Object.assign(new Error('이미 공개된 영상 편지입니다'), { status: 409 })
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
    throw Object.assign(new Error('영상 편지를 찾을 수 없습니다'), { status: 404 })
  }
  if (will.release_status !== 'released') {
    throw Object.assign(
      new Error('아직 공개되지 않은 영상 편지입니다. 관리자 검토 후 공개됩니다.'),
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
  const locked = Boolean(await redis.get(watchLockKey(beneficiary.beneficiary_id)))

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

  const lockKey = watchLockKey(beneficiary.beneficiary_id)
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
    const attemptsKey = watchAttemptsKey(beneficiary.beneficiary_id)
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

    // [버그 수정] 이전에는 401을 던졌다. 401은 인증 토큰 문제를 뜻하는데 이건 무인증
    // 공개 링크(유가족 열람 링크)에서 입력한 휴대폰 뒤 4자리가 서버 값과 다른 것뿐이다
    // - 인증 토큰과 무관하다. 프론트 apiClient.js의 401 인터셉터가 "토큰 만료"로
    // 오인해 리프레시 후 원 요청(시도 횟수를 차감하는 verify)을 자동 재시도하는 바람에
    // 버튼 1클릭에 시도 횟수가 2회씩 깎이던 결함의 근본 원인이었다(giftPerformService.js
    // verifyPerform과 동일 결함, 동일 수정). 400으로 바꿔 오인 재시도를 원천 차단한다.
    throw Object.assign(
      new Error(`휴대폰 번호 뒤 4자리가 일치하지 않습니다. (${WATCH_VERIFY_MAX_ATTEMPTS - attempts}회 남음)`),
      { status: 400 },
    )
  }

  // 성공 - 시도 카운터 초기화 + verified_at 기록 + audit
  await redis.del(watchAttemptsKey(beneficiary.beneficiary_id))
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
 *
 * [보안 수정 - D1] 이 함수는 더 이상 새 토큰을 반환하지 않는다. 예전 구현은
 * `{ token: newToken }`을 응답 본문에 그대로 실어 보냈는데, 이러면 잠금(423)
 * 상태에서도 이 엔드포인트가 무인증인 데다 만료 검사도 하지 않아 "새 토큰으로
 * 갈아타 시도 횟수/잠금을 초기화"하는 우회 경로가 됐다(D1 취약점). 대신 등록된
 * 연락처(이메일/SMS)로만 새 링크를 발송하고, 응답에는 "보냈다"는 사실만 담는다 -
 * 토큰을 아는 것만으로는 더 이상 새 토큰을 얻을 수 없다.
 */
export const requestWatchLinkExtension = async (token) => {
  const beneficiary = await repo.findBeneficiaryByToken(token)
  if (!beneficiary) {
    throw Object.assign(
      new Error('유효하지 않은 링크입니다. 문자나 카카오톡으로 받으신 링크를 다시 확인해 주세요.'),
      { status: 404 },
    )
  }

  // [보안 수정 - D1] 잠긴 수신인은 연장도 할 수 없다 - beneficiary_id 기준 잠금이므로
  // 토큰을 회전해도 우회되지 않는다(watchAttemptsKey/watchLockKey 주석 참고).
  const alreadyLocked = await redis.get(watchLockKey(beneficiary.beneficiary_id))
  if (alreadyLocked) {
    throw Object.assign(
      new Error('본인 확인 시도 횟수를 초과해 잠시 이용이 제한됐어요. 고객센터로 문의해 주세요.'),
      { status: 423 },
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

  // 새 링크 안내 발송 - [보안 수정 - D1] 새 토큰은 API 응답이 아니라 오직 이
  // 알림(등록된 이메일/SMS)을 통해서만 수신인에게 전달된다. 발송 자체는 비차단으로
  // 두되(실패해도 재발급 자체는 유효 - 재시도로 복구 가능), 응답에 토큰을 담지
  // 않으므로 발송 실패 시 수신인은 등록된 연락처로 재요청하거나 CS로 안내받아야 한다.
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
        subject: '리멤버미 - 영상 편지 링크를 다시 보내드려요',
        message: `${message}\n${watchUrl}`,
      })
    }
  } catch (err) {
    console.error('[willService] 연장 안내 발송 큐 등록 실패 (재발급 자체는 유지):', err.message)
  }

  // [보안 수정 - D1] newToken을 응답에 절대 포함하지 않는다 - 등록된 연락처로만
  // 전달된다. 프론트는 이 응답을 받으면 "새 링크를 보내드렸어요" 안내만 보여준다.
  return { sent: true, expiresAt: newExpiresAt }
}
