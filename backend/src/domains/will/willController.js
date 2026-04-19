import * as willService from './willService.js'
import { created, success, paginated } from '../../utils/response.js'

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
    created(res, result, '음성 샘플이 등록되었습니다. 클론 작업이 시작됩니다.')
  } catch (err) {
    next(err)
  }
}

export const getVoiceSampleStatus = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { id: voiceSampleId } = req.params
    const data = await willService.getVoiceSampleStatus(userId, voiceSampleId)
    success(res, data)
  } catch (err) {
    next(err)
  }
}

// ─── 유언장 ───────────────────────────────────────────────────────────────────

export const createWill = async (req, res, next) => {
  try {
    const { userId } = req.user
    const result = await willService.createWill(userId, req.body)
    created(res, result, '유언장이 생성되었습니다')
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
    paginated(res, wills, meta)
  } catch (err) {
    next(err)
  }
}

export const getWill = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { willId } = req.params
    const data = await willService.getWill(userId, willId)
    success(res, data)
  } catch (err) {
    next(err)
  }
}

export const activateWill = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { willId } = req.params
    const result = await willService.activateWill(userId, willId)
    success(res, result, '유언장 활성화 및 영상 생성 작업이 시작되었습니다')
  } catch (err) {
    next(err)
  }
}

export const getVideoStatus = async (req, res, next) => {
  try {
    const { userId } = req.user
    const { willId } = req.params
    const data = await willService.getVideoStatus(userId, willId)
    success(res, data)
  } catch (err) {
    next(err)
  }
}

// ─── 사후 공개 (비회원) ───────────────────────────────────────────────────────

export const requestRelease = async (req, res, next) => {
  try {
    const { token } = req.params
    const { deathCertS3Key, deathCertUrl } = req.body
    const result = await willService.requestRelease(token, { deathCertS3Key, deathCertUrl })
    created(res, result, '공개 요청이 접수되었습니다. 관리자 검토 후 처리됩니다.')
  } catch (err) {
    next(err)
  }
}

export const getWatchUrl = async (req, res, next) => {
  try {
    const { token } = req.params
    const data = await willService.getWatchUrl(token)
    success(res, data)
  } catch (err) {
    next(err)
  }
}
