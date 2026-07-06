/**
 * 립싱크 벤더 어댑터 공용 헬퍼
 * - pollUntilComplete: 벤더 API 상태 조회를 일정 간격으로 반복 (submit 이후 완료 대기)
 * - assertAllowedHost: 결과 영상 URL을 다운로드하기 전 SSRF 방어용 호스트 화이트리스트 검증
 * - downloadWithHostCheck: 위 두 헬퍼를 조합한 안전한 다운로드 (선택적으로 사용)
 */

/**
 * pollFn이 { done: true, value } 를 반환할 때까지 간격을 두고 반복 호출한다.
 * pollFn이 벤더의 "실패" 상태를 만나면 에러를 throw해서 폴링을 즉시 중단시키는 것을 권장한다.
 *
 * @param {(attempt: number) => Promise<{ done: boolean, value?: any }>} pollFn
 * @param {{ maxAttempts?: number, intervalMs?: number }} options
 * @returns {Promise<any>} pollFn이 done:true와 함께 반환한 value
 */
export const pollUntilComplete = async (pollFn, { maxAttempts = 30, intervalMs = 10000 } = {}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs))

    const result = await pollFn(attempt)
    if (result?.done) {
      return result.value
    }
  }

  const totalSec = Math.round((maxAttempts * intervalMs) / 1000)
  throw Object.assign(
    new Error(`폴링 타임아웃 (최대 ${maxAttempts}회, 총 ${totalSec}초 초과)`),
    { status: 504 },
  )
}

/**
 * URL의 hostname이 허용 목록(정확히 일치 또는 서브도메인)에 포함되는지 검증한다.
 * SSRF 방어 - 벤더가 반환한 결과 URL을 그대로 fetch하기 전 반드시 호출할 것.
 *
 * @param {string} url
 * @param {string[]} allowedHosts
 * @returns {URL} 검증을 통과한 URL 인스턴스
 */
export const assertAllowedHost = (url, allowedHosts) => {
  if (!url) {
    throw Object.assign(new Error('검증할 URL이 없습니다'), { status: 500 })
  }

  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw Object.assign(new Error(`유효하지 않은 URL: ${url}`), { status: 500 })
  }

  if (parsed.protocol !== 'https:') {
    throw Object.assign(new Error(`허용되지 않는 프로토콜: ${parsed.protocol}`), { status: 500 })
  }

  const isAllowed = (allowedHosts ?? []).some(
    (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
  )

  if (!isAllowed) {
    throw Object.assign(
      new Error(`허용되지 않는 결과 URL 호스트: ${parsed.hostname}`),
      { status: 500 },
    )
  }

  return parsed
}

/**
 * 호스트 검증 후 URL을 fetch하여 Buffer로 반환한다.
 *
 * @param {string} url
 * @param {string[]} allowedHosts
 * @returns {Promise<Buffer>}
 */
export const downloadWithHostCheck = async (url, allowedHosts) => {
  assertAllowedHost(url, allowedHosts)

  const res = await fetch(url)
  if (!res.ok) {
    throw Object.assign(new Error(`영상 다운로드 실패 (${res.status})`), { status: 500 })
  }

  return Buffer.from(await res.arrayBuffer())
}
