import { forbidden } from '../utils/response.js'

/**
 * SPEC-06 권한 매트릭스 role 명칭 ↔ admin_users.admin_role ENUM 매핑
 *
 * DB ENUM 실측(ondam_schema.sql admin_users.admin_role): ('super','manager','reviewer')
 * SPEC-06 1절 매트릭스 표기: super_admin / content_moderator / payment_specialist
 *
 * 매핑 근거 (SPEC-06 1절 매트릭스 O/- 패턴 대조):
 * - super    → super_admin        : 매트릭스 전 항목 O. 1:1 대응 자명
 * - reviewer → content_moderator  : "reviewer"라는 DB 컬럼값 자체가 검수자를 의미한다.
 *   매트릭스에서 content_moderator가 O인 항목(사후 공개 검수, 신고·모더레이션,
 *   회원 조회(콘텐츠 관련만))은 전부 "검수·모더레이션" 성격이고, payment_specialist
 *   전용 항목(주문 상태 변경, 재량 환불, 구독 관리)에는 전혀 관여하지 않는다.
 * - manager  → payment_specialist : payment_specialist가 O인 항목(주문 상태 수동
 *   변경·AI 재시도, 재량 환불, 구독 관리, 회원 조회(결제 관련만))은 전부 결제·운영
 *   관리 업무이고, content_moderator 전용 항목(검수·모더레이션)에는 관여하지 않는다.
 *   "manager"라는 이름도 운영 전반을 관리하는 역할에 부합한다.
 *
 * 이 매핑은 코드 판단 근거이며 DB에는 여전히 super/manager/reviewer 3개 값만 저장된다.
 */
export const ADMIN_ROLE_LABEL = {
  super: 'super_admin',
  reviewer: 'content_moderator',
  manager: 'payment_specialist',
}

/**
 * DB admin_role(super/manager/reviewer) 화이트리스트 기반 API 레벨 차단 미들웨어.
 * requireAuth + requireAdmin 이후에 사용 (req.user.adminRole은
 * adminService.signAdminAccessToken이 JWT payload에 심어둔 admin_users.admin_role 값).
 *
 * 사용 예: router.post('/x', requireAuth, requireAdmin, requireAdminRole('super', 'reviewer'), ...)
 *
 * SPEC-06 수용 기준 1: "role별 계정으로 로그인 시 매트릭스와 정확히 일치하는 메뉴·
 * 액션만 노출되고, API 레벨에서도 차단됨(화면 숨김만으로는 불충분)" - 이 미들웨어가
 * 그 API 레벨 차단을 담당한다.
 */
export const requireAdminRole = (...allowedRoles) => (req, res, next) => {
  const role = req.user?.adminRole
  if (!role || !allowedRoles.includes(role)) {
    return forbidden(res, '이 작업을 수행할 권한이 없습니다')
  }
  next()
}
