// KST 날짜 포맷 유틸
export const formatKst = (dateStr, options = {}) => {
  if (!dateStr) return '-'
  const defaults = { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }
  return new Intl.DateTimeFormat('ko-KR', { ...defaults, ...options }).format(new Date(dateStr))
}

export const formatKstDateTime = (dateStr) =>
  formatKst(dateStr, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

export const addOneMonthKst = (dateStr) => {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + 1)
  return d.toISOString()
}

// 'YYYY.MM.DD' (KST 기준). 값이 없거나 날짜로 해석할 수 없으면 null.
export const formatKstDot = (dateStr) => {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const pick = (type) => parts.find((part) => part.type === type)?.value
  const year = pick('year')
  const month = pick('month')
  const day = pick('day')
  if (!year || !month || !day) return null
  return `${year}.${month}.${day}`
}
