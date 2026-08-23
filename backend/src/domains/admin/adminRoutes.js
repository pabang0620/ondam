import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth, requireAdmin } from '../../middleware/auth.js'
import { requireAdminRole } from '../../middleware/requireAdminRole.js'
import { validate } from '../../middleware/validate.js'
import * as adminController from './adminController.js'
import * as adSpendController from './adSpendController.js'

const router = Router()

// ---------------------------------------------------------------------------
// Rate Limiters
// ---------------------------------------------------------------------------

// 관리자 로그인 브루트포스 방지 - 일반 authLimiter보다 엄격
//
// [FIX D19] 예전엔 IP 전역 키(기본 keyGenerator)라 5분/5회 제한이 "그 IP 전체"에
// 걸렸다 - 사무실 공유 IP에서 관리자 1명이 비밀번호를 5번 틀리면 같은 IP를 쓰는
// 다른 관리자 전원이 5분간 로그인 자체를 못 했다(검증 중 실제로 재현). 이메일(계정)
// + IP 조합으로 키를 잡아 잠금 범위를 "그 사람 본인의 그 시도"로 좁힌다.
//
// 계정 열거 공격(존재하지 않는 이메일로 다른 관리자를 잠그기) 방어: 키에 공격자
// 자신의 IP가 항상 포함되므로, 공격자가 피해자 이메일로 5번 시도해도 잠기는 건
// "그 이메일 + 공격자 IP" 조합뿐이다. 피해자가 자신의 실제 IP에서 로그인 시도하는
// 순간은 완전히 다른 키라 전혀 영향받지 않는다 - 공격자가 피해자와 동일한 IP를
// 공유해야만(같은 사무실 등) 잠금이 실제로 겹치는데, 이는 D19가 원래 다루던
// "사무실 공유 IP" 시나리오와 동일한 잔여 리스크로 수용한다(계정 단독 키보다는
// 훨씬 좁혀진 노출).
//
// 이메일은 소문자·trim 정규화 후 키에 넣는다 - 대소문자만 바꿔 카운터를 우회하는
// 것을 막는다. body 파싱 전이라도 express.json()이 라우터 마운트보다 먼저
// app.use()로 걸려 있어(server.js) req.body는 이 시점에 이미 채워져 있다.
const adminLoginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5분
  max: 5,                   // 5분 내 최대 5회
  keyGenerator: (req) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    return `${email}:${req.ip}`
  },
  message: { success: false, message: '너무 많은 로그인 시도입니다. 5분 후 다시 시도해주세요' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 관리자 API 전체 - 과도한 스크래핑/자동화 방지
const adminApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 60,             // 분당 최대 60회
  keyGenerator: (req) => req.user?.adminId ?? req.ip,
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 관리자 토큰 갱신 - 인증 전 단계(쿠키만으로 호출)라 IP 기준으로 제한
const adminRefreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5분
  max: 30,                  // 5분 내 최대 30회 (탭 여러 개·재시도 여유분 포함)
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ─── 스키마 ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('유효한 이메일을 입력하세요'),
    password: z.string().min(1, '비밀번호를 입력하세요'),
  }),
})

const rejectSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    rejectReason: z.string().trim().min(1, '거절 사유를 입력하세요').max(500),
  }),
})

const releaseIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('유효한 UUID가 아닙니다'),
  }),
})

// D13 - 유가족 본인확인 잠금 해제 대상 수신인
const beneficiaryIdParamSchema = z.object({
  params: z.object({
    beneficiaryId: z.string().uuid('유효한 UUID가 아닙니다'),
  }),
})

const paginationSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
})

const ordersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.string().optional(),
    targetType: z.string().optional(),
  }),
})

const usersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
  }),
})

// ─── ad_spend 스키마 (12-analytics-plan.md 2-10절 이벤트#62) ─────────────────

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/

const adSpendBodySchema = z.object({
  channel: z.string().trim().min(1, '채널을 입력하세요').max(50, '채널은 50자 이하여야 합니다'),
  periodStart: z.string().regex(DATE_ONLY_REGEX, '기간 시작일은 YYYY-MM-DD 형식이어야 합니다'),
  periodEnd: z.string().regex(DATE_ONLY_REGEX, '기간 종료일은 YYYY-MM-DD 형식이어야 합니다'),
  spendKrw: z.coerce.number().int().min(0, '광고비는 0 이상이어야 합니다'),
  note: z.string().trim().max(500).optional(),
}).refine((data) => data.periodEnd >= data.periodStart, {
  message: '종료일은 시작일보다 빠를 수 없습니다',
  path: ['periodEnd'],
})

const adSpendCreateSchema = z.object({
  body: adSpendBodySchema,
})

const adSpendUpdateSchema = z.object({
  params: z.object({
    id: z.string().uuid('유효한 UUID가 아닙니다'),
  }),
  body: adSpendBodySchema,
})

const adSpendIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('유효한 UUID가 아닙니다'),
  }),
})

const adSpendListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    channel: z.string().trim().max(50).optional(),
  }),
})

const cacQuerySchema = z.object({
  query: z.object({
    startDate: z.string().regex(DATE_ONLY_REGEX, '시작일은 YYYY-MM-DD 형식이어야 합니다'),
    endDate: z.string().regex(DATE_ONLY_REGEX, '종료일은 YYYY-MM-DD 형식이어야 합니다'),
  }),
})

// ─── 라우트 ───────────────────────────────────────────────────────────────────

// 인증 없음 - 관리자 로그인 (브루트포스 방지 limiter 적용)
router.post('/auth/login', adminLoginLimiter, validate(loginSchema), adminController.login)

// 인증 없음 - refresh token은 HttpOnly 쿠키('art')로만 전달되므로 Authorization 헤더가 없다
router.post('/auth/refresh', adminRefreshLimiter, adminController.refresh)

// 로그아웃은 유효한 관리자 accessToken을 요구한다 (일반 사용자 /api/auth/logout과 동일한 원칙)
router.post('/auth/logout', requireAuth, requireAdmin, adminController.logout)

// 이하 모두 requireAuth + requireAdmin 2층 필수
// adminApiLimiter는 인증 확인 후 keyGenerator에서 adminId를 사용하므로 requireAuth 뒤에 위치
//
// 대시보드/주문 조회/회원 조회/실패 작업 조회는 SPEC-06 1절 매트릭스에서 3개 role
// 전부 O(전원 열람 가능)이므로 requireAdminRole을 걸지 않는다(의도적 생략).
router.get(
  '/dashboard',
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  adminController.getDashboard,
)

// SPEC-06 1절 매트릭스: "사후 공개 검수(승인/반려)" = super_admin, content_moderator만 O
// (payment_specialist는 -). DB role 매핑은 requireAdminRole.js ADMIN_ROLE_LABEL 참고.
// 조회(GET /releases, 사망증명서 열람)도 검수 화면 자체이므로 동일하게 제한한다.
router.get(
  '/releases',
  requireAuth,
  requireAdmin,
  requireAdminRole('super', 'reviewer'),
  adminApiLimiter,
  validate(paginationSchema),
  adminController.getPendingReleases,
)

router.get(
  '/releases/:id/document-url',
  requireAuth,
  requireAdmin,
  requireAdminRole('super', 'reviewer'),
  adminApiLimiter,
  validate(releaseIdSchema),
  adminController.getReleaseDocumentUrl,
)

router.post(
  '/releases/:id/approve',
  requireAuth,
  requireAdmin,
  requireAdminRole('super', 'reviewer'),
  adminApiLimiter,
  validate(releaseIdSchema),
  adminController.approveRelease,
)

router.post(
  '/releases/:id/reject',
  requireAuth,
  requireAdmin,
  requireAdminRole('super', 'reviewer'),
  adminApiLimiter,
  validate(rejectSchema),
  adminController.rejectRelease,
)

// D13 - 유가족 본인확인 5회 오입력 잠금(24시간, Redis) 즉시 해제. releases 검수와
// 동일한 "검수 담당" 업무로 분류해 super_admin·content_moderator(reviewer)만 허용.
router.post(
  '/will/beneficiaries/:beneficiaryId/unlock',
  requireAuth,
  requireAdmin,
  requireAdminRole('super', 'reviewer'),
  adminApiLimiter,
  validate(beneficiaryIdParamSchema),
  adminController.unlockWillWatch,
)

router.get(
  '/orders',
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  validate(ordersQuerySchema),
  adminController.getOrders,
)

router.get(
  '/users',
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  validate(usersQuerySchema),
  adminController.getUsers,
)

router.get(
  '/jobs/failed',
  requireAuth,
  requireAdmin,
  adminApiLimiter,
  validate(paginationSchema),
  adminController.getFailedJobs,
)

// FIX D5 - 발송 재시도 소진 후 최종 실패한 알림 조회. 사후공개 검수와 같은 성격의
// 정보(승인은 했는데 실제로 유가족에게 전달됐는지)이므로 releases와 동일하게
// super_admin, content_moderator(reviewer)로 제한한다.
router.get(
  '/notifications/failed',
  requireAuth,
  requireAdmin,
  requireAdminRole('super', 'reviewer'),
  adminApiLimiter,
  validate(paginationSchema),
  adminController.getFailedNotifications,
)

// ─── ad_spend (광고비 입력 + CAC 산출) ─────────────────────────────────────
// 12-analytics-plan.md 2-10절(이벤트#62), 8-1절(P0). SPEC-06 1절 매트릭스에는
// "광고비 입력·CAC"가 별도 행으로 없으나, 성격상 재량 환불·구독 관리와 동일한
// "결제·운영 관리" 업무(돈이 걸린 집행 데이터)이므로 payment_specialist 담당으로
// 분류한다(super_admin, manager=payment_specialist만 O). content_moderator는
// 검수·모더레이션 업무와 무관하므로 제외. 정적 경로(recent-channels, cac)를
// 파라미터 라우트(:id)보다 먼저 선언한다(같은 세그먼트 와일드카드 흡수 방지 -
// 이 경우 메서드가 달라(GET vs PUT/DELETE) 실제 충돌은 없으나 컨벤션상 고정).
router.post(
  '/ad-spend',
  requireAuth,
  requireAdmin,
  requireAdminRole('super', 'manager'),
  adminApiLimiter,
  validate(adSpendCreateSchema),
  adSpendController.createAdSpend,
)

router.get(
  '/ad-spend',
  requireAuth,
  requireAdmin,
  requireAdminRole('super', 'manager'),
  adminApiLimiter,
  validate(adSpendListQuerySchema),
  adSpendController.getAdSpendList,
)

router.get(
  '/ad-spend/recent-channels',
  requireAuth,
  requireAdmin,
  requireAdminRole('super', 'manager'),
  adminApiLimiter,
  adSpendController.getRecentChannels,
)

router.get(
  '/ad-spend/cac',
  requireAuth,
  requireAdmin,
  requireAdminRole('super', 'manager'),
  adminApiLimiter,
  validate(cacQuerySchema),
  adSpendController.getCac,
)

router.put(
  '/ad-spend/:id',
  requireAuth,
  requireAdmin,
  requireAdminRole('super', 'manager'),
  adminApiLimiter,
  validate(adSpendUpdateSchema),
  adSpendController.updateAdSpend,
)

router.delete(
  '/ad-spend/:id',
  requireAuth,
  requireAdmin,
  requireAdminRole('super', 'manager'),
  adminApiLimiter,
  validate(adSpendIdSchema),
  adSpendController.deleteAdSpend,
)

export default router
