import * as willService from './willService.js'
import { created, success, paginated } from '../../utils/response.js'
import { uploadDeathCertificate } from '../common/uploadMiddleware.js'

// ─── 음성 샘플 ────────────────────────────────────────────────────────────────

export const uploadVoiceSample = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { s3Key, consentId, durationSec, fileSize } = req.body
    const result = await willService.uploadVoiceSample(userId, {
      s3Key,
      consentId,
      durationSec,
      fileSize,
    })
    return created(res, result, '음성 샘플이 등록되었습니다. 클론 작업이 시작됩니다.')
  } catch (err) {
    next(err)
  }
}

export const getVoiceSampleStatus = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { id: voiceSampleId } = req.params
    const data = await willService.getVoiceSampleStatus(userId, voiceSampleId)
    return success(res, data)
  } catch (err) {
    next(err)
  }
}

// ─── 유언장 ───────────────────────────────────────────────────────────────────

export const createWill = async (req, res, next) => {
  try {
    const { userId } = req.user
    const result = await willService.createWill(userId, req.body)
    return created(res, result, '영상 편지가 생성되었습니다')
  } catch (err) {
    next(err)
  }
}

export const getWills = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { page, limit } = req.query
    const { wills, meta } = await willService.getWills(userId, {
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
    })
    return paginated(res, wills, meta)
  } catch (err) {
    next(err)
  }
}

export const getWill = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { willId } = req.params
    const data = await willService.getWill(userId, willId)
    return success(res, data)
  } catch (err) {
    next(err)
  }
}

export const activateWill = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { willId } = req.params
    const result = await willService.activateWill(userId, willId)
    return success(res, result, '영상 편지 활성화 및 영상 생성 작업이 시작되었습니다')
  } catch (err) {
    next(err)
  }
}

export const getVideoStatus = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { willId } = req.params
    const data = await willService.getVideoStatus(userId, willId)
    return success(res, data)
  } catch (err) {
    next(err)
  }
}

// ─── 사후 공개 (비회원) ───────────────────────────────────────────────────────

/**
 * 초대 토큰 → will/beneficiary 컨텍스트 확인 후 req.releaseContext에 저장
 * uploadDeathCertificate 미들웨어(S3 키 생성)보다 반드시 먼저 실행되어야 한다.
 */
export const attachReleaseContext = async (req, res, next) => {
  try {
    const { token } = req.params
    req.releaseContext = await willService.resolveReleaseUploadContext(token)
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * 사망증명서 업로드 (비회원, 초대 토큰 경유) - attachReleaseContext 이후 호출됨
 * uploadRoutes.js와 동일한 관례: multer 인스턴스는 요청 시점에 생성한다
 * (라우터 등록 시점에 미리 만들면 S3_BUCKET 등 환경변수 로드 순서에 취약해진다)
 *
 * [결함 4 수정] S3_BUCKET/AWS_REGION 미설정·무효 자격 증명을 503으로 재분류하는
 * 가드는 이제 common/uploadMiddleware.js(uploadDeathCertificate 내부 wrapUpload)가
 * 담당한다 - 여기서 개별적으로 우회 구현하던 코드는 제거했다(중복 정리). 미들웨어가
 * 정확히 같은 경로(uploadDeathCertificate가 반환하는 핸들러)를 덮으므로 동작은
 * 약해지지 않는다 - uploadMiddleware.js의 wrapUpload/assertUploadVendorConfigured 참고.
 */
export const uploadReleaseDocument = (req, res, next) => {
  const upload = uploadDeathCertificate('file')
  upload(req, res, (err) => {
    if (err) {
      return next(err) // willRoutes.js 하단 multerErrorHandler가 400으로 정규화(503은 err.status로 그대로 전파)
    }
    if (!req.file) {
      return next(Object.assign(new Error('업로드할 서류 파일이 없습니다'), { status: 400 }))
    }
    return created(res, {
      s3Key: req.file.key,
      url: req.file.location,
      mimeType: req.file.mimetype,
      size: req.file.size,
    }, '서류가 업로드되었습니다')
  })
}

export const requestRelease = async (req, res, next) => {
  try {
    const { token } = req.params
    const { deathCertS3Key, deathCertUrl } = req.body
    const result = await willService.requestRelease(token, { deathCertS3Key, deathCertUrl })
    return created(res, result, '공개 요청이 접수되었습니다. 관리자 검토 후 처리됩니다.')
  } catch (err) {
    next(err)
  }
}

// [보안 수정] 토큰만으로 영상 URL을 내려주지 않는다 - 최소 정보(수신인 이름·잠금
// 여부)만 반환한다. 영상 URL은 verifyWatchAccess(본인 확인 성공) 이후에만 발급.
export const getWatchInfo = async (req, res, next) => {
  try {
    const { token } = req.params
    const data = await willService.getWatchInfo(token)
    return success(res, data)
  } catch (err) {
    next(err)
  }
}

export const verifyWatchAccess = async (req, res, next) => {
  try {
    const { token } = req.params
    const { phoneLast4 } = req.body
    const ipAddress = req.ip ?? req.headers['x-forwarded-for'] ?? null
    const userAgent = req.headers['user-agent'] ?? null

    const data = await willService.verifyWatchAccess(token, phoneLast4, { ipAddress, userAgent })
    return success(res, data, '본인 확인이 완료되었습니다')
  } catch (err) {
    next(err)
  }
}

// [SPEC-05 3절] 만료된(또는 만료 임박한) 열람 링크를 새 토큰으로 재발급한다.
// [보안 수정 - D1] 응답에는 새 토큰이 담기지 않는다(willService 주석 참고) -
// 등록된 연락처로만 새 링크가 발송된다.
export const requestWatchLinkExtension = async (req, res, next) => {
  try {
    const { token } = req.params
    const data = await willService.requestWatchLinkExtension(token)
    return success(res, data, '등록된 연락처로 새 링크를 보내드렸어요')
  } catch (err) {
    next(err)
  }
}
