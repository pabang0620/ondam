import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useLogin, getSafeRedirect } from './useLogin.js'
import { ROUTES } from '../../constants/routes.js'
import { useAuthStore } from '../../store/authStore.js'
import PasswordToggleButton from './PasswordToggleButton.jsx'

export default function LoginPage() {
  const { email, setEmail, password, setPassword, isLoading, error, handleSubmit } = useLogin()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isAuthInitialized = useAuthStore((s) => s.isAuthInitialized)
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)

  // FIX: DEV-27 - 이미 유효한 세션으로 /login에 들어오면 로그인 화면에 갇히지 않고
  // 원래 가려던 화면(PrivateRoute가 넘긴 state.from, 없으면 홈)으로.
  // 초기화가 끝나기 전에는 아직 판정할 수 없으므로 로그인 폼을 그대로 보여준다
  // (초기화가 끝나 인증됨으로 밝혀지면 그때 아래에서 리다이렉트된다).
  if (isAuthInitialized && isAuthenticated) {
    return <Navigate to={getSafeRedirect(location.state?.from)} replace />
  }

  return (
    <div className="flex flex-col gap-9">
      <div className="text-center">
        <h1
          className="font-bold mb-2"
          style={{
            fontSize: 'var(--fs-h2)',
            color: 'var(--color-text-primary)',
            letterSpacing: 'var(--ls-heading-ko)',
          }}
        >
          로그인
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>
          온담에 오신 것을 환영합니다
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {/* 이메일 */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="email"
            className="font-medium"
            style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-primary)' }}
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
            className="w-full outline-none"
            style={{
              height: 'var(--size-input-h)',
              padding: '0 16px',
              fontSize: 'var(--fs-body)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              transition: 'border-color var(--transition-base)',
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
        <div className="flex flex-col gap-2">
          <label
            htmlFor="password"
            className="font-medium"
            style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-primary)' }}
          >
            비밀번호
          </label>
          <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            disabled={isLoading}
            aria-invalid={!!error}
            aria-describedby={error ? 'login-error' : undefined}
            className="w-full outline-none"
            style={{
              height: 'var(--size-input-h)',
              padding: '0 64px 0 16px',
              fontSize: 'var(--fs-body)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              transition: 'border-color var(--transition-base)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
            }}
          />
          <PasswordToggleButton
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            controls="password"
          />
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <p
            id="login-error"
            role="alert"
            style={{
              fontSize: 'var(--fs-body)',
              color: 'var(--color-error)',
              backgroundColor: 'var(--color-error-light)',
              border: '1px solid var(--color-error-muted)',
              borderRadius: '10px',
              padding: '10px 14px',
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
          className="w-full font-semibold mt-4"
          style={{
            height: 'var(--size-button-h)',
            fontSize: 'var(--fs-button)',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-surface)',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            opacity: isLoading ? 0.65 : 1,
            transition: 'opacity var(--transition-base)',
          }}
        >
          {isLoading ? '로그인 중...' : '로그인'}
        </button>
      </form>

      {/* 구분선 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--color-border)' }} />
        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}>또는</span>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--color-border)' }} />
      </div>

      {/* 카카오 로그인 - 카카오 노란색 유지(접근성) */}
      <a
        href="/api/auth/kakao"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-sm)',
          width: '100%',
          height: 'var(--size-button-h)',
          background: '#FEE500',
          color: '#191600',
          borderRadius: 'var(--radius-pill)',
          fontSize: 'var(--fs-button)',
          fontWeight: 700,
          textDecoration: 'none',
          border: 'none',
        }}
      >
        <img
          src="https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_small.png"
          alt=""
          width={20}
          height={20}
          style={{ width: 20, height: 20 }}
        />
        카카오로 로그인
      </a>

      {/* 회원가입 링크 */}
      <p
        className="text-center"
        style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}
      >
        아직 계정이 없으신가요?{' '}
        <Link
          to={ROUTES.JOIN}
          className="font-semibold hover:underline"
          style={{
            // 인라인 링크 탭 높이 48px 확보(JoinPage의 로그인 링크와 동일)
            color: 'var(--color-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 'var(--min-touch-target)',
            padding: '0 4px',
          }}
        >
          회원가입
        </Link>
      </p>
    </div>
  )
}
