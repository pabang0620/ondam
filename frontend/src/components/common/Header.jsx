import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import { ROUTES } from '../../constants/routes.js'
import apiClient from '../../config/apiClient.js'

export default function Header() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const clearUser = useAuthStore((s) => s.clearUser)
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // 서버 오류가 발생해도 클라이언트 상태는 반드시 초기화
    }
    clearUser()
    navigate(ROUTES.LOGIN)
  }

  const navLinkClass = ({ isActive }) =>
    [
      'text-base font-medium transition-colors',
      isActive
        ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]',
    ].join(' ')

  return (
    <header
      className="sticky top-0 z-50 bg-[var(--color-surface)] border-b border-[var(--color-border)]"
    >
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        {/* 로고 */}
        <Link
          to={ROUTES.HOME}
          className="flex items-center gap-2"
          aria-label="온담 홈으로 이동"
        >
          <span
            className="font-bold text-xl tracking-tight"
            style={{ color: 'var(--color-primary)' }}
          >
            온담
          </span>
          <span className="text-xs text-[var(--color-text-muted)] hidden sm:inline">
            AI 기억사진관
          </span>
        </Link>

        {/* 메인 네비게이션 */}
        <nav className="hidden md:flex items-center gap-6" aria-label="주요 메뉴">
          <NavLink to={ROUTES.PHOTO} className={navLinkClass}>
            AI 사진관
          </NavLink>
          <NavLink to={ROUTES.WILL} className={navLinkClass}>
            유언장
          </NavLink>
          <NavLink to={ROUTES.PET} className={navLinkClass}>
            반려동물
          </NavLink>
        </nav>

        {/* 인증 버튼 영역 */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Link
                to={ROUTES.MY}
                className="px-4 py-2 rounded-lg text-[var(--color-primary)] border border-[var(--color-primary)] font-medium text-base hover:bg-[var(--color-accent)] transition-colors"
                style={{ minHeight: 'var(--min-touch-target)' }}
              >
                마이페이지
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg text-[var(--color-text-secondary)] font-medium text-base hover:text-[var(--color-text-primary)] transition-colors"
                style={{ minHeight: 'var(--min-touch-target)' }}
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                to={ROUTES.LOGIN}
                className="px-4 py-2 rounded-lg text-[var(--color-primary)] border border-[var(--color-primary)] font-medium text-base hover:bg-[var(--color-accent)] transition-colors"
                style={{ minHeight: 'var(--min-touch-target)' }}
              >
                로그인
              </Link>
              <Link
                to={ROUTES.JOIN}
                className="px-4 py-2 rounded-lg text-[var(--color-surface)] font-medium text-base transition-colors"
                style={{
                  minHeight: 'var(--min-touch-target)',
                  backgroundColor: 'var(--color-primary)',
                }}
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 모바일 하단 네비게이션 */}
      <nav
        className="md:hidden flex border-t border-[var(--color-border)]"
        aria-label="모바일 메뉴"
      >
        {[
          { to: ROUTES.PHOTO, label: 'AI 사진관' },
          { to: ROUTES.WILL, label: '유언장' },
          { to: ROUTES.PET, label: '반려동물' },
        ].map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex-1 text-center py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'text-[var(--color-primary)] bg-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)]',
              ].join(' ')
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
