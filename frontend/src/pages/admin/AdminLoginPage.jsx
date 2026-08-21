import { Navigate } from 'react-router-dom'
import { useAdminLogin } from './useAdminLogin.js'
import { useAuthStore } from '../../store/authStore.js'
import { ROUTES } from '../../constants/routes.js'
import './admin.css'

export default function AdminLoginPage() {
  const { form, error, isSubmitting, handleChange, handleSubmit } = useAdminLogin()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)

  // FIX: DEV-28 - 이미 관리자로 로그인된 세션이면 로그인 폼 대신 대시보드로 보낸다.
  // 주의: 일반 로그인(/login)으로 얻은 rt 쿠키도 /auth/refresh가 role:'admin'을 포함한
  // user를 복원해주기 때문에, isAuthenticated && role==='admin'만으로는 "관리자 API를
  // 실제로 호출할 수 있는 상태"를 보장하지 못한다. 이 상태에서 대시보드로 보내면
  // adminApiClient에 Authorization 헤더가 실리지 않아 401 → 로그인 페이지로 리다이렉트 →
  // 여기서 다시 대시보드로 보내는 무한루프가 발생했다(관리자 무한 새로고침 버그).
  // adminToken(localStorage)이 실제로 있을 때만 관리자 API 호출이 가능하므로 반드시
  // 함께 확인한다. isAuthInitialized를 기다리지 않는 이유: 여기서는 "이미 인증된 admin을
  // 조기에 밀어내는" 리스크가 없다 - 아직 초기화 전이면 isAuthenticated가 false라 그냥
  // 로그인 폼을 보여줄 뿐이고, 초기화가 끝나 조건이 충족되면 재렌더로 자연스럽게 넘어간다.
  const hasAdminToken = !!localStorage.getItem('adminToken')
  if (isAuthenticated && user?.role === 'admin' && hasAdminToken) {
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
            온담
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
