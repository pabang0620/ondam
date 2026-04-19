import { useAdminUsers } from './useAdminUsers.js'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

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

  const thStyle = {
    padding: 'var(--spacing-sm) var(--spacing-md)',
    textAlign: 'left',
    fontWeight: 700,
    color: 'var(--color-primary-dark)',
    borderBottom: '2px solid var(--color-border)',
    whiteSpace: 'nowrap',
  }

  const tdStyle = {
    padding: 'var(--spacing-sm) var(--spacing-md)',
    fontSize: 'var(--font-size-base)',
    borderBottom: '1px solid var(--color-border)',
    verticalAlign: 'middle',
  }

  return (
    <div style={{ padding: 'var(--spacing-xl)' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800 }}>회원 관리</h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
          전체 회원 목록을 조회합니다. (총 {total.toLocaleString('ko-KR')}명)
        </p>
      </div>

      {/* 검색 */}
      <form
        onSubmit={handleSearch}
        style={{
          display: 'flex',
          gap: 'var(--spacing-sm)',
          marginBottom: 'var(--spacing-lg)',
          maxWidth: 480,
        }}
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
              border: '1.5px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '0 var(--spacing-md) 0 40px',
              minHeight: 'var(--min-touch-target)',
              fontSize: 'var(--font-size-base)',
              width: '100%',
              outline: 'none',
              background: 'var(--color-surface)',
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            background: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '0 var(--spacing-lg)',
            minHeight: 'var(--min-touch-target)',
            fontSize: 'var(--font-size-base)',
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
        <p role="alert" style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-md)' }}>
          {error}
        </p>
      )}

      {/* 테이블 */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-base)' }}
          aria-label="회원 목록"
          aria-busy={isLoading}
        >
          <thead>
            <tr style={{ background: 'var(--color-accent)' }}>
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
                <td style={tdStyle}>{user.nickname || '—'}</td>
                <td style={tdStyle}>{user.email}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      padding: '2px 10px',
                      borderRadius: 'var(--radius-full)',
                      background: user.role === 'admin' ? '#ebf8ff' : 'var(--color-accent)',
                      color: user.role === 'admin' ? '#3182ce' : 'var(--color-primary-dark)',
                      fontWeight: 700,
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    {user.role === 'admin' ? '관리자' : '회원'}
                  </span>
                </td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 'var(--font-size-sm)' }}>
                  {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td style={tdStyle}>
                  {user.subscriptionPlan
                    ? (
                      <span
                        style={{
                          padding: '2px 10px',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--color-accent)',
                          color: 'var(--color-primary-dark)',
                          fontWeight: 700,
                          fontSize: 'var(--font-size-sm)',
                        }}
                      >
                        {user.subscriptionPlan}
                      </span>
                    )
                    : <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>없음</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--spacing-sm)',
            marginTop: 'var(--spacing-lg)',
          }}
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
              borderRadius: 'var(--radius-md)',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              opacity: page <= 1 ? 0.4 : 1,
            }}
            aria-label="이전 페이지"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>

          <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600 }}>
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
              borderRadius: 'var(--radius-md)',
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
