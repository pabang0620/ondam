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
  //
  // [보안 수정 - D8 슬러그 열거 방지] 예전에는 "슬러그 없음"과 "펫 alive"는 404를,
  // "비공개인데 코드 없음"도 404를 주면서 "비공개인데 코드가 틀림"만 403 +
  // "접근 코드가 올바르지 않습니다"를 줬다 - 이 셋을 구분할 수 있다는 것 자체가
  // "이 슬러그는 실제로 존재하고 비공개 추모 페이지다"라는 신호가 되어, 코드를
  // 전혀 몰라도 슬러그 문자열만 훑으면 존재 여부를 열거(enumerate)할 수 있었다.
  // 이제 세 경우(슬러그 없음 / alive / 비공개+코드 없음|틀림) 모두 동일하게 404 +
  // 동일한 메시지("추모 페이지를 찾을 수 없습니다")로 응답한다 - 상태 코드와 메시지
  // 둘 다 완전히 통일해야 새지 않는다(메시지만 통일하고 상태 코드가 다르면 그
  // 자체로 구분 가능한 신호가 남는다).
  //
  // 정당한 사용자 배려: 실제로 올바른 링크(슬러그+접근 코드가 쿼리로 함께 옴)를
  // 받은 유가족은 최초 진입에서 즉시 통과하므로 이 에러 화면 자체를 보지 않는다.
  // 이 화면에 도달하는 건 코드가 없거나 틀렸을 때뿐인데, 프론트(MemorialPage.jsx)는
  // 에러 메시지가 무엇이든 항상 동일하게 "가족에게 받은 접근 코드가 있다면
  // 입력해 주세요" 코드 재입력 폼을 함께 보여준다 - "틀렸습니다"처럼 이미 시도한
  // 사실을 확인해주지 않아도, 코드를 다시 넣어볼 수 있는 경로가 항상 열려 있으므로
  // 실사용 흐름이 막히지 않는다(differential 정보만 제거되고 재시도 UX는 그대로).
  if (!pet.is_public) {
    if (!pet.memorial_access_code || !isAccessCodeMatch(accessCode, pet.memorial_access_code)) {
      throw Object.assign(new Error('추모 페이지를 찾을 수 없습니다'), { status: 404 })
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
