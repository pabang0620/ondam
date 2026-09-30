/**
 * 표준 API 응답 유틸
 * 포맷: { success, message, data?, meta? }
 */

export const success = (res, data = null, message = '성공', statusCode = 200, code = null) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    code,
  })
}

export const created = (res, data = null, message = '생성 완료', code = null) => {
  return success(res, data, message, 201, code)
}

export const paginated = (res, data, meta, message = '성공', code = null) => {
  return res.status(200).json({
    success: true,
    message,
    data,
    meta,
    code,
  })
}

export const error = (res, message = '오류가 발생했습니다', statusCode = 500, code = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
  })
}

export const badRequest = (res, message = '잘못된 요청입니다', code = null) => {
  return error(res, message, 400, code)
}

export const unauthorized = (res, message = '인증이 필요합니다', code = null) => {
  return error(res, message, 401, code)
}

export const forbidden = (res, message = '접근 권한이 없습니다', code = null) => {
  return error(res, message, 403, code)
}

export const notFound = (res, message = '찾을 수 없습니다', code = null) => {
  return error(res, message, 404, code)
}

export const conflict = (res, message = '이미 존재합니다', code = null) => {
  return error(res, message, 409, code)
}
