import bcrypt from 'bcrypt'
import * as userRepository from './userRepository.js'

const BCRYPT_ROUNDS = 12

/**
 * 내부 DB 컬럼명 → API 응답 필드명 변환
 */
const toProfileDto = (user) => ({
  userId: user.user_id,
  email: user.email,
  nickname: user.nickname,
  phone: user.phone ?? null,
  profileImageUrl: user.profile_image_url ?? null,
  role: user.role,
  createdAt: user.created_at,
})

/**
 * 프로필 조회
 */
export const getProfile = async (userId) => {
  const user = await userRepository.findByUserId(userId)
  if (!user) {
    throw Object.assign(new Error('사용자를 찾을 수 없습니다'), { status: 404 })
  }
  return toProfileDto(user)
}

/**
 * 프로필 수정 - nickname, phone, profileImageUrl 중 전달된 값만 업데이트
 */
export const updateProfile = async (userId, { nickname, phone, profileImageUrl }) => {
  const user = await userRepository.findByUserId(userId)
  if (!user) {
    throw Object.assign(new Error('사용자를 찾을 수 없습니다'), { status: 404 })
  }

  // DB 컬럼명으로 변환
  const fields = {}
  if (nickname !== undefined) fields.nickname = nickname
  if (phone !== undefined) fields.phone = phone
  if (profileImageUrl !== undefined) fields.profile_image_url = profileImageUrl

  await userRepository.updateProfile(userId, fields)

  const updated = await userRepository.findByUserId(userId)
  return toProfileDto(updated)
}

/**
 * 비밀번호 변경
 */
export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await userRepository.findByUserIdWithHash(userId)
  if (!user) {
    throw Object.assign(new Error('사용자를 찾을 수 없습니다'), { status: 404 })
  }

  // 소셜 로그인 전용 계정 - password_hash 없는 경우
  if (!user.password_hash) {
    throw Object.assign(new Error('소셜 로그인 계정은 비밀번호를 변경할 수 없습니다'), { status: 400 })
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash)
  if (!isMatch) {
    throw Object.assign(new Error('현재 비밀번호가 올바르지 않습니다'), { status: 400 })
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  await userRepository.updatePassword(userId, newHash)
}

/**
 * 회원 탈퇴 (소프트 삭제)
 */
export const withdraw = async (userId) => {
  const user = await userRepository.findByUserId(userId)
  if (!user) {
    throw Object.assign(new Error('사용자를 찾을 수 없습니다'), { status: 404 })
  }

  await userRepository.softDelete(userId)
}
