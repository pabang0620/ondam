import { useAdminLogin } from './useAdminLogin.js'

export default function AdminLoginPage() {
  const { form, error, isSubmitting, handleChange, handleSubmit } = useAdminLogin()

  const inputStyle = (hasError) => ({
    border: `1.5px solid ${hasError ? 'var(--color-error)' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius-md)',
    padding: '0 var(--spacing-md)',
    minHeight: 'var(--min-touch-target)',
    fontSize: 'var(--font-size-base)',
    width: '100%',
    outline: 'none',
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
  })

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-background)',
        padding: 'var(--spacing-md)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-2xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-xl)',
        }}
      >
        {/* 로고 */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
            온담
          </p>
          <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
            관리자 로그인
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label htmlFor="admin-email" style={{ fontSize: 'var(--font-size-base)', fontWeight: 600 }}>
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
            <label htmlFor="admin-password" style={{ fontSize: 'var(--font-size-base)', fontWeight: 600 }}>
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
            <p role="alert" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            style={{
              background: isSubmitting ? 'var(--color-text-muted)' : 'var(--color-primary-dark)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              minHeight: 'var(--min-touch-target)',
              fontSize: 'var(--font-size-base)',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
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
