import { useAdminUsers } from './useAdminUsers.js'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import './admin.css'

// FIX: 결함1 - subscriptions.plan 실제 ENUM(SUBSCRIPTION_PLAN, shared/constants/enums.js)이
// 영문 원문(pet_archive 등)으로 그대로 노출되고 있었다. will_premium·all은 오너 확정으로
// 폐지된 플랜이지만(DEV-17/DEV-32) 이미 구독 중이던 기존 회원 행은 강제취소하지 않아
// 여전히 나타날 수 있으므로 라벨에 남겨둔다 - pet/SubscriptionStatusCard.jsx의
// PLAN_NAMES와 동일한 문구로 맞춰 사이트 전체에서 같은 값이 같은 문구로 보이게 한다.
const SUBSCRIPTION_PLAN_LABEL = {
  pet_archive: '반려동물 아카이브',
  will_premium: 'AI 영상 편지 프리미엄',
  all: '전체 이용권',
}

export default function AdminUsersPage() {
  const {
    users,
    page,
    total,
    totalPages,
    searchInput,
    isLoading,
    error,
    setSearchInput,
    handleSearch,
    handlePageChange,
  } = useAdminUsers()

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
        <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: 'var(--ls-heading-ko)' }}>회원 관리</h1>
        <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)', marginTop: 4 }}>
          전체 회원 목록을 조회합니다. (총 {total.toLocaleString('ko-KR')}명)
        </p>
      </div>

      {/* 검색 인풋 - 56px height, border 1px border-strong, focus 차콜 */}
      <form
        onSubmit={handleSearch}
        className="admin-search-form"
        role="search"
      >
        <label htmlFor="user-search" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
          회원 검색
        </label>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: 'var(--spacing-md)',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          />
          <input
            id="user-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="이메일 또는 닉네임 검색"
            style={{
              border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-sm)',
              padding: '0 var(--spacing-md) 0 40px',
              minHeight: 'var(--size-input-h)',
              fontSize: 'var(--fs-body)',
              width: '100%',
              outline: 'none',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              transition: 'border-color var(--transition-fast)',
            }}
          />
        </div>
        {/* primary=차콜 버튼 */}
        <button
          type="submit"
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-surface)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '0 var(--spacing-lg)',
            minHeight: 'var(--size-button-h)',
            fontSize: 'var(--fs-button)',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          검색
        </button>
      </form>

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
          aria-label="회원 목록"
          aria-busy={isLoading}
        >
          <thead>
            <tr style={{ background: 'var(--color-surface-warm)' }}>
              {['닉네임', '이메일', '역할', '가입일', '구독'].map((th) => (
                <th key={th} scope="col" style={thStyle}>{th}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--spacing-2xl)' }}>
                  불러오는 중...
                </td>
              </tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--spacing-2xl)' }}>
                  회원이 없습니다.
                </td>
              </tr>
            )}
            {!isLoading && users.map((user) => (
              <tr key={user.userId} style={{ background: 'var(--color-surface)' }}>
                <td style={tdStyle}>{user.nickname || '-'}</td>
                <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>{user.email}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      padding: '2px 10px',
                      borderRadius: 'var(--radius-pill)',
                      background: user.role === 'admin' ? '#ebf8ff' : 'var(--color-surface-warm)',
                      color: user.role === 'admin' ? '#3182ce' : 'var(--color-primary)',
                      fontWeight: 700,
                      fontSize: 'var(--fs-caption)',
                    }}
                  >
                    {user.role === 'admin' ? '관리자' : '회원'}
                  </span>
                </td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 'var(--fs-caption)', color: 'var(--color-text-secondary)' }}>
                  {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td style={tdStyle}>
                  {user.subscriptionPlan
                    ? (
                      <span
                        style={{
                          padding: '2px 10px',
                          borderRadius: 'var(--radius-pill)',
                          background: 'var(--color-surface-warm)',
                          color: 'var(--color-primary)',
                          fontWeight: 700,
                          fontSize: 'var(--fs-caption)',
                        }}
                      >
                        {SUBSCRIPTION_PLAN_LABEL[user.subscriptionPlan] || user.subscriptionPlan}
                      </span>
                    )
                    : <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-caption)' }}>없음</span>}
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
