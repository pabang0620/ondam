/**
 * Memorial Service — 비즈니스 로직 전용
 * 공개 추모 페이지 (비회원 접근 가능)
 */

import * as memorialRepository from './memorialRepository.js'

const MEDIA_PAGE_LIMIT = 50

/**
 * 추모 페이지 조회
 * - pet_status가 deceased 또는 unknown 인 경우에만 공개
 * - alive 상태이면 추모 페이지 없음 (404)
 * - memorial_access_code가 설정된 경우 accessCode 일치 필요
 *
 * @param {string} slug
 * @param {string|undefined} accessCode — 쿼리로 전달된 접근 코드
 * @returns {{ pet: object, media: object[], mediaMeta: object }}
 */
export const getMemorialPage = async (slug, accessCode) => {
  const pet = await memorialRepository.findPetBySlug(slug)
  if (!pet) {
    throw Object.assign(new Error('추모 페이지를 찾을 수 없습니다'), { status: 404 })
  }

  if (pet.pet_status === 'alive') {
    throw Object.assign(new Error('추모 페이지를 찾을 수 없습니다'), { status: 404 })
  }

  if (pet.memorial_access_code) {
    if (!accessCode || accessCode !== pet.memorial_access_code) {
      throw Object.assign(new Error('접근 코드가 올바르지 않습니다'), { status: 403 })
    }
  }

  const { media, total } = await memorialRepository.findMediaByPetId(pet.pet_id, {
    limit: MEDIA_PAGE_LIMIT,
    offset: 0,
  })

  return {
    pet: {
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      birthDate: pet.birth_date,
      deathDate: pet.death_date,
      petStatus: pet.pet_status,
      memorialSlug: pet.memorial_slug,
      profileImageUrl: pet.profile_image_url,
    },
    media,
    mediaMeta: {
      total,
      limit: MEDIA_PAGE_LIMIT,
    },
  }
}
