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
