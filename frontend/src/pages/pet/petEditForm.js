// 반려동물 수정 폼의 순수 함수(검증·초기값·전송 payload). 규칙은 서버 updatePetSchema 를 따른다.
// 서버 규칙: name trim 1~50자, breed trim 최대 100자(null 허용), birthDate 'YYYY-MM-DD'(null 허용).
export const NAME_MAX = 50
export const BREED_MAX = 100

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

// 서버 정규식은 형식만 보므로 2월 30일 같은 없는 날짜를 통과시킨다 - 클라이언트에서 실제 날짜인지 확인한다.
function isRealDate(value) {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (month < 1 || month > 12 || day < 1) return false
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// 서버 응답(snake_case) -> 폼 값. 날짜는 'YYYY-MM-DD...' 의 앞 10자만 쓴다(카드와 같은 방식).
export function toFormValues(pet) {
  return {
    name: typeof pet?.name === 'string' ? pet.name : '',
    breed: typeof pet?.breed === 'string' ? pet.breed : '',
    birthDate: typeof pet?.birth_date === 'string' ? pet.birth_date.slice(0, 10) : '',
  }
}

/**
 * 폼 검증. 오류가 없으면 빈 객체.
 * today: 'YYYY-MM-DD'(KST 오늘), deathDate: 기존 사망일(수정하지 않지만 생일이 그보다 늦으면 안 된다)
 */
export function validatePetEditForm(form, { today, deathDate = null }) {
  const errors = {}
  const name = form.name.trim()
  if (!name) errors.name = '이름을 입력해 주세요.'
  else if (name.length > NAME_MAX) errors.name = `이름은 ${NAME_MAX}자 이하로 입력해 주세요.`

  if (form.breed.trim().length > BREED_MAX) {
    errors.breed = `품종은 ${BREED_MAX}자 이하로 입력해 주세요.`
  }

  if (form.birthDate) {
    if (!isRealDate(form.birthDate)) errors.birthDate = '생일을 올바르게 입력해 주세요.'
    else if (form.birthDate > today) errors.birthDate = '생일은 오늘 이후로 정할 수 없어요.'
    else if (typeof deathDate === 'string' && form.birthDate > deathDate.slice(0, 10)) {
      errors.birthDate = '생일은 무지개다리 날짜보다 늦을 수 없어요.'
    }
  }
  return errors
}

/**
 * 변경된 필드만 담은 payload(서버 PUT 은 undefined 필드를 유지하는 부분 갱신).
 * 비운 품종·생일은 null 로 보내 지운다. 변경이 없으면 빈 객체.
 */
export function buildUpdatePayload(initial, form) {
  const payload = {}
  const name = form.name.trim()
  if (name !== initial.name.trim()) payload.name = name
  const breed = form.breed.trim()
  if (breed !== initial.breed.trim()) payload.breed = breed || null
  if (form.birthDate !== initial.birthDate) payload.birthDate = form.birthDate || null
  return payload
}
