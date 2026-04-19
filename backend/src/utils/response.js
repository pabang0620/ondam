/**
 * 표준 API 응답 유틸
 * 포맷: { success, message, data?, meta? }
 */

export const success = (res, data = null, message = '성공', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  })
}

export const created = (res, data = null, message = '생성 완료') => {
  return success(res, data, message, 201)
}

export const paginated = (res, data, meta, message = '성공') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    meta,
  })
}

export const error = (res, message = '오류가 발생했습니다', statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message,
  })
}

export const badRequest = (res, message = '잘못된 요청입니다') => {
  return error(res, message, 400)
}

export const unauthorized = (res, message = '인증이 필요합니다') => {
  return error(res, message, 401)
}

export const forbidden = (res, message = '접근 권한이 없습니다') => {
  return error(res, message, 403)
}

export const notFound = (res, message = '찾을 수 없습니다') => {
  return error(res, message, 404)
}

export const conflict = (res, message = '이미 존재합니다') => {
  return error(res, message, 409)
}
