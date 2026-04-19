import { badRequest } from '../utils/response.js'

/**
 * Zod 스키마 검증 미들웨어 팩토리
 * 사용: router.post('/path', validate(schema), controller)
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query,
  })
  if (!result.success) {
    const messages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
    return badRequest(res, messages.join(', '))
  }
  if (result.data.body !== undefined) req.body = result.data.body
  if (result.data.params !== undefined) req.params = result.data.params
  if (result.data.query !== undefined) req.query = result.data.query
  next()
}

/**
 * 쿼리 파라미터 검증
 */
export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query)
  if (!result.success) {
    const messages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
    return badRequest(res, messages.join(', '))
  }
  req.query = result.data
  next()
}
