/**
 * Memorial Controller — 요청 파싱 + 응답 전담
 */

import * as memorialService from './memorialService.js'
import { success } from '../../utils/response.js'

/**
 * GET /api/memorial/:slug
 * 비회원 접근 가능 (optionalAuth)
 */
export const getMemorialPage = async (req, res, next) => {
  try {
    const { slug } = req.params
    const data = await memorialService.getMemorialPage(slug)
    return success(res, data, '추모 페이지 조회 성공')
  } catch (err) {
    next(err)
  }
}
