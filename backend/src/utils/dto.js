/**
 * 내부 AUTO_INCREMENT PK(`id`) 응답 노출 방지 유틸
 *
 * [결함 수정 - DEV-33] 이 프로젝트의 이중 ID 컨벤션(.claude/CLAUDE.md)은 내부 PK
 * `id BIGINT AUTO_INCREMENT`와 외부 노출용 UUID(`order_id`/`will_id`/`gift_id` 등)를
 * 분리한다 - IDOR(추측 가능한 순차 ID로 다른 사용자 리소스 접근) 방지가 목적이다.
 * 일부 리포지토리가 `SELECT *` 또는 명시적으로 `id`를 포함해 조회한 뒤 그 행 객체를
 * 그대로(또는 스프레드로) HTTP 응답에 흘려보내면서 `id`가 새고 있었다.
 *
 * SELECT 자체는 건드리지 않는다 - 일부 함수(will/gift 리마인드 워커의 PK 커서 배치
 * 스캔 등)는 내부적으로 `id`가 실제로 필요하고, 그 값은 HTTP 응답으로 나가지 않는다.
 * 대신 "DB 행 → HTTP 응답"으로 변환되는 지점(서비스 레이어의 return 직전)에서만
 * `id` 필드를 제거한다 - 내부 로직(조인·정렬·커서 이동)은 전혀 영향받지 않는다.
 */

export const omitId = (row) => {
  if (!row || typeof row !== 'object') return row
  const { id, ...rest } = row
  return rest
}

export const omitIds = (rows) => (Array.isArray(rows) ? rows.map(omitId) : rows)

/**
 * 화이트리스트 응답 필드 선택 유틸
 *
 * [결함 수정 - 민감 컬럼 전수 감사, 2026-08] omitId/omitIds는 블랙리스트 방식이라
 * "이미 알려진" 필드(`id`)만 걸러낸다 - 이후 테이블에 KMS 키 참조값 같은 새 민감
 * 컬럼이 추가되면(예: wills.result_video_kms_key_id) 아무도 걸러내지 않는 한
 * 자동으로 새어나간다(실제로 willService.getWill이 이렇게 샜다 - 완료 보고 참고).
 *
 * pick()은 반대로 화이트리스트다 - 호출부가 명시한 필드만 응답에 실리고, 테이블에
 * 새 컬럼이 추가돼도(민감하든 아니든) 화이트리스트에 넣기 전까지는 응답에 나타나지
 * 않는다. DB 행 → HTTP 응답 변환 지점(서비스 레이어의 return 직전)에서만 사용하고,
 * SELECT 자체나 내부 로직이 쓰는 원본 행 객체는 그대로 둔다.
 *
 * @param {object|null} row - DB 행 객체
 * @param {string[]} fields - 응답에 포함할 필드명 목록 (DB 컬럼명 그대로)
 * @returns {object|null}
 */
export const pick = (row, fields) => {
  if (!row || typeof row !== 'object') return row
  const result = {}
  for (const field of fields) {
    if (field in row) result[field] = row[field]
  }
  return result
}

export const pickAll = (rows, fields) => (Array.isArray(rows) ? rows.map((row) => pick(row, fields)) : rows)
