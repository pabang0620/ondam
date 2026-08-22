/**
 * Memorial Service - 비즈니스 로직 전용
 * 공개 추모 페이지 (비회원 접근 가능)
 */

import crypto from 'crypto'
import * as memorialRepository from './memorialRepository.js'

const MEDIA_PAGE_LIMIT = 50

/**
 * 접근 코드 상수시간 비교 (타이밍 공격 방지)
 * 길이가 다르면 즉시 false (timingSafeEqual은 동일 길이 버퍼만 허용)
 */
const isAccessCodeMatch = (input, stored) => {
  if (!input || !stored) return false
  const inputBuf = Buffer.from(String(input))
  const storedBuf = Buffer.from(String(stored))
  if (inputBuf.length !== storedBuf.length) return false
  return crypto.timingSafeEqual(inputBuf, storedBuf)
}

/**
 * 미디어 로우(snake_case) → 응답 필드(camelCase) 매핑
 *
 * FIX: DEV-31 - pet은 camelCase로 매핑하면서 media만 repository의 raw 로우를 그대로
 * 흘려보내고 있었다. 프론트(MemorialPage)는 `item.mediaId` / `item.url`을 읽는데 실제
 * 응답은 `media_id` / `file_url`이라, 갤러리의 모든 <img src>가 undefined가 되어
 * onError로 숨겨졌고("함께한 순간들"이 통째로 빈 그리드) key도 전부 undefined라
 * React 중복 key 경고까지 났다. 같은 응답 안에서 표기가 섞이지 않도록 media도
 * pet과 동일하게 camelCase로 고정한다.
 *
 * 주의: 파일 URL 필드명은 `url`이다(프론트 계약). 추모 페이지는 공개 응답이라
 * s3_key 등 내부 식별자는 애초에 repository SELECT에 없다.
 */
const toMediaResponse = (row) => ({
  mediaId: row.media_id,
  mediaType: row.media_type,
  url: row.file_url,
  thumbnailUrl: row.thumbnail_url,
  mimeType: row.mime_type,
  width: row.width,
  height: row.height,
  durationSec: row.duration_sec,
  takenAt: row.taken_at,
  sortOrder: row.sort_order,
  caption: row.caption,
  createdAt: row.created_at,
})

/**
 * 추모 페이지 조회
 *
 * 접근 정책 (SPEC-03, 2026-08-21 오너 확정 - 사람은 항상 비공개 / 펫은 소유자 공개선택):
 * [2026-08-22 DEV-16 완성] pets.is_public 컬럼이 마이그레이션 b로 추가되어 더 이상
 * memorial_access_code 존재 여부만으로 공개/비공개를 임시 판단하지 않는다. 판정
 * 우선순위는 다음과 같다:
 *   1. is_public = 1(공개) → 접근 코드 없이 즉시 공개
 *   2. is_public = 0(비공개, 기본값) → 기존과 동일하게 memorial_access_code 검증
 *      경로. 코드 자체가 없으면(아직 공개 전환 전) 404.
 * - pet_status가 deceased 또는 unknown 인 경우에만 애초에 추모 페이지 대상이 된다
 * - alive 상태이면 추모 페이지 없음 (404)
 *
 * @param {string} slug
 * @param {string|undefined} accessCode - 쿼리로 전달된 접근 코드
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

  // is_public=1이면 접근 코드 검증을 건너뛰고 즉시 공개(DEV-16). 기본값 0(비공개)일
  // 때만 기존처럼 접근 코드 검증 경로를 탄다.
  if (!pet.is_public) {
    // 접근 코드 미설정 = 아직 공개되지 않은 추모 페이지 (기본값: 비공개)
    if (!pet.memorial_access_code) {
      throw Object.assign(new Error('추모 페이지를 찾을 수 없습니다'), { status: 404 })
    }

    if (!isAccessCodeMatch(accessCode, pet.memorial_access_code)) {
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
      isPublic: Boolean(pet.is_public),
    },
    media: media.map(toMediaResponse),
    mediaMeta: {
      total,
      limit: MEDIA_PAGE_LIMIT,
    },
  }
}
