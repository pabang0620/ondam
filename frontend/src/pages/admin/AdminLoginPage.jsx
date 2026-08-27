import { Navigate } from 'react-router-dom'
import { useAdminLogin } from './useAdminLogin.js'
import { useAdminAuthStore, getAdminAccessToken } from '../../config/adminApiClient.js'
import { ROUTES } from '../../constants/routes.js'
import './admin.css'

export default function AdminLoginPage() {
  const { form, error, isSubmitting, handleChange, handleSubmit } = useAdminLogin()
  // FIX: HIGH-1 - useAuthStore(일반 사용자) 대신 관리자 전용 store에서 읽는다.
  const adminUser = useAdminAuthStore((s) => s.adminUser)

  // FIX: DEV-28 - 이미 관리자로 로그인된 세션이면 로그인 폼 대신 대시보드로 보낸다.
  // phase0-followups B-3: adminToken(localStorage) 대신 메모리 토큰 보유 여부로 확인한다.
  // 메모리 토큰은 새로고침 시 항상 비므로(의도된 동작), 새로고침 직후 이 페이지에
  // 바로 진입한 경우는 로그인 폼을 보여준다 - 세션 복원(refreshAdminAuth)은
  // AdminLayout 마운트 시에만 시도한다. 이미 로그인 상태로 /admin/login에 재진입한
  // 경우(예: 뒤로가기)에 한해 이 가드가 대시보드로 되돌려보낸다.
  const hasAdminToken = !!getAdminAccessToken()
  if (adminUser?.role === 'admin' && hasAdminToken) {
    return <Navigate to={ROUTES.ADMIN} replace />
  }

  const inputStyle = (hasError) => ({
    border: `1.5px solid ${hasError ? 'var(--color-error)' : 'var(--color-border-strong)'}`,
    borderRadius: 'var(--radius-sm)',
    padding: '0 var(--spacing-md)',
    minHeight: 'var(--size-input-h)',
    fontSize: 'var(--fs-body)',
    width: '100%',
    outline: 'none',
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    transition: 'border-color var(--transition-fast)',
  })

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        padding: 'var(--spacing-md)',
      }}
    >
      <div className="admin-login-card">
        {/* 로고 */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--fs-h1)', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: 'var(--ls-heading-ko)' }}>
            리멤버미
          </p>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-muted)', marginTop: 4 }}>
            관리자 로그인
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label htmlFor="admin-email" style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              이메일
            </label>
            <input
              id="admin-email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="관리자 이메일"
              style={inputStyle(!!error)}
              autoComplete="email"
              aria-invalid={!!error}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label htmlFor="admin-password" style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              비밀번호
            </label>
            <input
              id="admin-password"
              type="password"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder="비밀번호"
              style={inputStyle(!!error)}
              autoComplete="current-password"
              aria-invalid={!!error}
            />
          </div>

          {error && (
            <p role="alert" style={{ fontSize: 'var(--fs-body)', color: 'var(--color-error)' }}>
              {error}
            </p>
          )}

          {/* 검색 인풋: 56px height, border 1px, focus 차콜 */}
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            style={{
              background: isSubmitting ? 'var(--color-text-muted)' : 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              minHeight: 'var(--size-button-h)',
              fontSize: 'var(--fs-button)',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background var(--transition-base)',
              marginTop: 'var(--spacing-sm)',
            }}
          >
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
