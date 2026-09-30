import * as userService from './userService.js'
import { success } from '../../utils/response.js'
import { RT_COOKIE, RT_COOKIE_PATH } from '../auth/authController.js'

/**
 * GET /api/users/me
 * 내 프로필 조회
 */
export const getProfile = async (req, res, next) => {
  try {
    const data = await userService.getProfile(req.user.userId)
    return success(res, data)
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/users/me
 * 프로필 수정
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { nickname, phone, profileImageUrl } = req.body
    const data = await userService.updateProfile(req.user.userId, { nickname, phone, profileImageUrl })
    return success(res, data, '프로필이 수정되었습니다')
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/users/me/password
 * 비밀번호 변경
 */
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    await userService.changePassword(req.user.userId, { currentPassword, newPassword })
    return success(res, null, '비밀번호가 변경되었습니다')
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/users/me
 * 회원 탈퇴
 */
export const withdraw = async (req, res, next) => {
  try {
    await userService.withdraw(req.user.userId)
    // [AUTH-7] 설정 시와 같은 path로 refresh token 쿠키 제거
    res.clearCookie(RT_COOKIE, { path: RT_COOKIE_PATH })
    return success(res, null, '회원 탈퇴가 완료되었습니다')
  } catch (err) {
    next(err)
  }
}
