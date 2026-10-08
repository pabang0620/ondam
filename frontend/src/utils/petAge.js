const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/

// 'YYYY-MM-DD' (한국 시간 기준 오늘). 시간대 보정은 Intl 에 맡기고 문자열로만 비교한다.
export function getTodayKst() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// 'YYYY-MM-DD...' 를 { year, month, day } 로. 형식이 틀리거나 없는 날짜(2월 30일 등)면 null.
function parseDate(value) {
  if (typeof value !== 'string') return null
  const match = DATE_PATTERN.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null
  return { year, month, day }
}

const toKey = ({ year, month, day }) => year * 10000 + month * 100 + day

/**
 * 만 나이 문자열. 계산할 수 없으면 null.
 * - 1년 이상: 'N살', 1년 미만: 'N개월', 생후 1개월 미만: '1개월 미만'
 * - 미래 날짜, 잘못된 형식, 존재하지 않는 날짜, 잘못된 today 는 null
 * - 윤년(2월 29일) 등 해당 달에 없는 날짜의 기념일은 다음 달 1일로 본다(평년 3월 1일부터 한 살).
 *
 * @param {string | null | undefined} birthDate 'YYYY-MM-DD...'
 * @param {string} today 'YYYY-MM-DD' (한국 시간 기준 오늘)
 */
export function calcAgeLabel(birthDate, today) {
  const birth = parseDate(birthDate)
  const now = parseDate(today)
  if (!birth || !now) return null
  const nowKey = toKey(now)
  if (toKey(birth) > nowKey) return null

  let months = (now.year - birth.year) * 12 + (now.month - birth.month)
  // 이번 달의 '월 기념일'. 이번 달에 그 날짜가 없으면 다음 달 1일(월 13 도 키 비교는 유효).
  const anniversary =
    birth.day > daysInMonth(now.year, now.month)
      ? { year: now.year, month: now.month + 1, day: 1 }
      : { year: now.year, month: now.month, day: birth.day }
  if (nowKey < toKey(anniversary)) months -= 1

  if (months < 1) return '1개월 미만'
  if (months < 12) return `${months}개월`
  return `${Math.floor(months / 12)}살`
}
