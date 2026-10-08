import { Link, Outlet, useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes.js'

export default function AuthLayout() {
  const { pathname } = useLocation()
  const isLoginPage = pathname === ROUTES.LOGIN

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 sm:py-12"
      style={{
        backgroundColor: 'var(--color-bg)',
        maxWidth: '100vw',
        overflowX: 'hidden',
        paddingTop: 'max(32px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(32px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* 상단 로고 - 로그인 페이지에서는 숨김(회원가입에서만 표시) */}
      {!isLoginPage && (
        <Link
          to={ROUTES.HOME}
          className="mb-6 sm:mb-8 flex flex-col items-center gap-1"
          aria-label="온담 홈으로 이동"
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: 'var(--fs-h1)',
              letterSpacing: 'var(--ls-heading-ko)',
              color: 'var(--color-text-primary)',
            }}
          >
            온담
          </span>
          <span
            style={{
              fontSize: 'var(--fs-caption)',
              color: 'var(--color-text-secondary)',
            }}
          >
            AI 기억사진관
          </span>
        </Link>
      )}

      {/* 카드 - 모바일: 좌우 여백 최소화, 데스크톱: 중앙 박스 */}
      <div
        className="w-full rounded-2xl p-8 sm:p-10"
        style={{
          maxWidth: 'min(448px, 100%)',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <Outlet />
      </div>
    </div>
  )
}
