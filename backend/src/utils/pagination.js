/**
 * LIMIT/OFFSET 안전 정수 변환 유틸
 *
 * [실측 확인 - DEV-32] mysql2의 pool.execute()(서버사이드 prepared statement)는
 * LIMIT/OFFSET 절에 자리표시자(`?`)를 지원하지 않는다. mysql2 3.22.1 + MySQL 8.4.10
 * 환경에서 `LIMIT ?`(단일 플레이스홀더)조차 "Incorrect arguments to
 * mysqld_stmt_execute"로 실패함을 직접 확인했다(다른 컬럼 WHERE 조건의 `?`는 정상
 * 동작). 반드시 검증된 정수를 SQL 문자열에 직접 삽입해야 한다 - 단, 그 값이 사용자
 * 입력을 그대로 문자열 결합한 것이면 SQL 인젝션이 되므로, 여기서 Number() 변환 +
 * Number.isInteger 검증 + 범위 클램프를 거친 값만 반환한다.
 *
 * 컨트롤러(zod)에서 이미 범위를 검증하는 경로가 많지만, 워커나 다른 호출부가 zod를
 * 거치지 않고 이 리포지토리 함수를 직접 호출할 수 있으므로 리포지토리 레벨에서도
 * 방어적으로 재검증한다. pool.query()(비-prepared, 텍스트 프로토콜)는 이 문제가 없어
 * `LIMIT ? OFFSET ?`를 그대로 써도 되지만, 이 유틸은 execute()로 통일하는 리포지토리를
 * 위한 것이다.
 */

/**
 * @param {unknown} value
 * @param {{ min?: number, max?: number, fallback: number }} opts
 * @returns {number} 항상 min..max 범위 안의 안전한 정수
 */
export const toSafeInt = (value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback }) => {
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n > Number.MAX_SAFE_INTEGER) {
    return fallback
  }
  return Math.min(Math.max(n, min), max)
}

/**
 * 목록 조회 LIMIT (기본 최대 100 - 사용자 페이지네이션 기준)
 */
export const toSafeLimit = (value, { max = 100, fallback = 20 } = {}) =>
  toSafeInt(value, { min: 1, max, fallback })

/**
 * 목록 조회 OFFSET
 */
export const toSafeOffset = (value, { max = 1_000_000, fallback = 0 } = {}) =>
  toSafeInt(value, { min: 0, max, fallback })
