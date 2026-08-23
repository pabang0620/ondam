import { useAdminOrders } from './useAdminOrders.js'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './admin.css'

const LIMIT = 20
const ALL = 'ALL'

// FIX: 결함1 - photo_orders.status 실제 ENUM(PHOTO_ORDER_STATUS, shared/constants/enums.js)은
// pending_payment/paid/processing/completed/failed/refunded 6종이다. 기존 필터·라벨은
// 'pending'(존재하지 않는 값)·4종만 있어 paid·refunded 주문을 걸러낼 수도, 라벨을
// 표시할 수도 없었다. 라벨 텍스트는 mypage/MyPage.jsx의 ORDER_STATUS_LABEL과 동일하게
// 맞춰 사이트 전체에서 같은 상태값이 같은 문구로 보이게 한다.
const STATUS_OPTIONS = [
  { value: ALL, label: '전체' },
  { value: 'pending_payment', label: '결제 대기' },
  { value: 'paid', label: '결제 완료' },
  { value: 'processing', label: '처리 중' },
  { value: 'completed', label: '완료' },
  { value: 'failed', label: '실패' },
  { value: 'refunded', label: '환불됨' },
]

const STATUS_COLOR = {
  pending_payment: 'var(--color-text-muted)',
  paid: 'var(--color-text-muted)',
  processing: 'var(--color-warm-accent)',
  completed: 'var(--color-success)',
  failed: 'var(--color-error)',
  refunded: 'var(--color-text-muted)',
}

const STATUS_LABEL = {
  pending_payment: '결제 대기',
  paid: '결제 완료',
  processing: '처리 중',
  completed: '완료',
  failed: '실패',
  refunded: '환불됨',
}

// FIX: 결함1 - photo_orders.photo_type 실제 ENUM(PHOTO_TYPE, shared/constants/enums.js)은
// 9종이다(2026-08-21 DEV-22 drift 해소로 enhance/colorize/restore/removebg/portrait/casual
// 6종이 DB에 추가됨, docs/migrations/2026-08-21-schema-drift-fix.README.md 3절). 기존에는
// funeral/id/job 3개만 있어 나머지 6개 주문의 사진 유형이 영문 원문으로 노출됐다.
// 아래 3개(장례/증명/취업)는 PhotoOrderPage.jsx 상품명과 동일하게 맞췄다.
const PHOTO_TYPE_LABEL = {
  funeral: '장례',
  id: '증명',
  job: '취업',
  enhance: '화질 개선',
  colorize: '컬러 복원',
  restore: '사진 복원',
  removebg: '배경 제거',
  portrait: '인물 사진',
  casual: '캐주얼 사진',
}

export default function AdminOrdersPage() {
  const {
    orders,
    page,
    total,
    statusFilter,
    isLoading,
    error,
    handleStatusFilter,
    handlePageChange,
  } = useAdminOrders()

  const totalPages = Math.ceil(total / LIMIT) || 1

  /* 표 - header bg=surface-warm, row 구분 1px var(--color-border) */
  const thStyle = {
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: 700,
    color: 'var(--color-primary)',
    borderBottom: '2px solid var(--color-border-strong)',
    whiteSpace: 'nowrap',
    fontSize: 'var(--fs-body)',
  }

  const tdStyle = {
    padding: '12px 16px',
    fontSize: 'var(--fs-body)',
    borderBottom: '1px solid var(--color-border)',
    verticalAlign: 'middle',
    color: 'var(--color-text-primary)',
  }

  return (
    <div className="admin-page">
      {/* 헤더 */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: 'var(--ls-heading-ko)' }}>주문 관리</h1>
        <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)', marginTop: 4 }}>
          사진관 주문 목록을 조회하고 관리합니다.
        </p>
      </div>

      {/* 상태 필터 - primary 차콜 선택 */}
      <div
        className="admin-filter-group"
        role="group"
        aria-label="주문 상태 필터"
      >
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleStatusFilter(opt.value)}
            aria-pressed={statusFilter === opt.value}
            style={{
              background: statusFilter === opt.value ? 'var(--color-primary)' : 'var(--color-surface)',
              color: statusFilter === opt.value ? 'var(--color-surface)' : 'var(--color-text-secondary)',
              border: `1.5px solid ${statusFilter === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-pill)',
              padding: '0 var(--spacing-md)',
              minHeight: 'var(--min-touch-target)',
              fontSize: 'var(--fs-caption)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background var(--transition-base), color var(--transition-base)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 에러 */}
      {error && (
        <p role="alert" style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-md)', fontSize: 'var(--fs-body)' }}>
          {error}
        </p>
      )}

      {/* 테이블 */}
      <div className="admin-table-wrapper">
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-body)', background: 'var(--color-surface)' }}
          aria-label="주문 목록"
          aria-busy={isLoading}
        >
          <thead>
            <tr style={{ background: 'var(--color-surface-warm)' }}>
              {['주문 ID', '회원 ID', '사진 유형', '금액', '상태', '주문일'].map((th) => (
                <th key={th} scope="col" style={thStyle}>{th}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--spacing-2xl)' }}>
                  불러오는 중...
                </td>
              </tr>
            )}
            {!isLoading && orders.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--spacing-2xl)' }}>
                  주문이 없습니다.
                </td>
              </tr>
            )}
            {!isLoading && orders.map((order) => (
              <tr key={order.orderId} style={{ background: 'var(--color-surface)' }}>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}>
                  {order.orderId?.slice(0, 12)}...
                </td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}>
                  {order.userId?.slice(0, 12)}...
                </td>
                <td style={tdStyle}>
                  {PHOTO_TYPE_LABEL[order.photoType] || order.photoType}
                </td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {order.amountKrw?.toLocaleString('ko-KR')}원
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      padding: '2px 10px',
                      borderRadius: 'var(--radius-pill)',
                      background: `${STATUS_COLOR[order.status]}20`,
                      color: STATUS_COLOR[order.status] || 'var(--color-text-muted)',
                      fontWeight: 700,
                      fontSize: 'var(--fs-caption)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                </td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 'var(--fs-caption)', color: 'var(--color-text-secondary)' }}>
                  {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div
          className="admin-pagination"
          aria-label="페이지 탐색"
        >
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              minHeight: 'var(--min-touch-target)',
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              opacity: page <= 1 ? 0.4 : 1,
            }}
            aria-label="이전 페이지"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>

          <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-primary)' }}>
            {page} / {totalPages}
          </span>

          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              minHeight: 'var(--min-touch-target)',
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages ? 0.4 : 1,
            }}
            aria-label="다음 페이지"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
