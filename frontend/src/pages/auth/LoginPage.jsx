import { Link } from 'react-router-dom'
import { useLogin } from './useLogin.js'
import { ROUTES } from '../../constants/routes.js'

export default function LoginPage() {
  const { email, setEmail, password, setPassword, isLoading, error, handleSubmit } = useLogin()

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1
          className="font-bold mb-1"
          style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-text-primary)' }}
        >
          로그인
        </h1>
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
          온담에 오신 것을 환영합니다
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {/* 이메일 */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="font-medium"
            style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}
          >
            이메일
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            disabled={isLoading}
            aria-invalid={!!error}
            aria-describedby={error ? 'login-error' : undefined}
            className="w-full px-4 rounded-xl outline-none transition-all"
            style={{
              height: 'var(--min-touch-target)',
              fontSize: 'var(--font-size-base)',
              border: '1.5px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
            }}
          />
        </div>

        {/* 비밀번호 */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="font-medium"
            style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}
          >
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            disabled={isLoading}
            aria-invalid={!!error}
            aria-describedby={error ? 'login-error' : undefined}
            className="w-full px-4 rounded-xl outline-none transition-all"
            style={{
              height: 'var(--min-touch-target)',
              fontSize: 'var(--font-size-base)',
              border: '1.5px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
            }}
          />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <p
            id="login-error"
            role="alert"
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              color: 'var(--color-error)',
              backgroundColor: '#FFF5F5',
              border: '1px solid #FED7D7',
            }}
          >
            {error}
          </p>
        )}

        {/* 로그인 버튼 */}
        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="w-full rounded-xl font-semibold transition-opacity"
          style={{
            minHeight: 'var(--min-touch-target)',
            fontSize: 'var(--font-size-lg)',
            backgroundColor: isLoading ? 'var(--color-primary-light)' : 'var(--color-primary)',
            color: 'var(--color-surface)',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? '로그인 중...' : '로그인'}
        </button>
      </form>

      {/* 구분선 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--color-border)' }} />
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>또는</span>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--color-border)' }} />
      </div>

      {/* 카카오 로그인 */}
      <a
        href="/api/auth/kakao"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-sm)',
          width: '100%',
          minHeight: 'var(--min-touch-target)',
          background: '#FEE500',
          color: '#000000',
          border: 'none',
          borderRadius: 'var(--radius-full)',
          fontSize: 'var(--font-size-base)',
          fontWeight: 700,
          textDecoration: 'none',
          cursor: 'pointer',
        }}
      >
        <img
          src="https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_small.png"
          alt=""
          style={{ width: 20, height: 20 }}
        />
        카카오로 로그인
      </a>

      {/* 회원가입 링크 */}
      <p
        className="text-center"
        style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}
      >
        아직 계정이 없으신가요?{' '}
        <Link
          to={ROUTES.JOIN}
          className="font-semibold hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          회원가입
        </Link>
      </p>
    </div>
  )
}
