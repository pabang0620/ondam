import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import { ROUTES } from '../../constants/routes.js'
import apiClient from '../../config/apiClient.js'
import { logoutAdminSession } from '../../config/adminApiClient.js'
import logoUrl from '../../assets/logo.svg'
import logoMarkUrl from '../../assets/logo-mark.svg'

const NAV_LINKS = [
  { to: ROUTES.PHOTO, label: 'AI 사진관' },
  { to: ROUTES.WILL, label: '유언장' },
  { to: ROUTES.PET, label: '반려동물' },
]

export default function Header() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const clearUser = useAuthStore((s) => s.clearUser)
  const navigate = useNavigate()
  const location = useLocation()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef(null)
  const hamburgerRef = useRef(null)

  // 페이지 이동 시 drawer 닫기
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // drawer 열릴 때 스크롤 잠금 + 포커스 이동
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
      // 첫 번째 포커스 가능한 요소로 이동
      const firstFocusable = drawerRef.current?.querySelector(
        'a, button, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  // ESC로 drawer 닫기 + Tab 포커스 트랩
  useEffect(() => {
    if (!drawerOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false)
        hamburgerRef.current?.focus()
        return
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll(
          'a, button, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [drawerOpen])

  const handleLogout = async () => {
    setDrawerOpen(false)
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // 서버 오류가 발생해도 클라이언트 상태는 반드시 초기화
    }
    // FIX: admin-002 - 예전에는 clearAdminAccessToken()만 호출해 메모리 토큰만
    // 지우고 'art' HttpOnly 쿠키(7일)는 브라우저·서버 양쪽에 그대로 남았다. 공유 PC
    // 에서 관리자가 이 헤더로 로그아웃한 뒤 다음 사람이 /admin에 들어가면
    // refreshAdminAuth()가 art 쿠키로 관리자 세션을 조용히 복원할 수 있었다.
    // logoutAdminSession()은 서버에 /admin/auth/logout을 호출해 art 쿠키 자체를
    // 무효화하고, 실패(관리자로 로그인한 적 없어 401 등)해도 내부에서 흡수하므로
    // 이 일반 로그아웃 흐름을 막지 않는다.
    await logoutAdminSession()
    clearUser()
    navigate(ROUTES.LOGIN)
  }

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => !prev)
  }, [])

  // 로그인/회원가입 페이지에서는 인증 버튼 영역을 숨김
  const isAuthPage = [ROUTES.LOGIN, ROUTES.JOIN].includes(location.pathname)

  const navLinkClass = ({ isActive }) =>
    [
      'flex items-center text-base font-medium transition-colors border-b-2',
      isActive ? 'hover:opacity-100' : 'border-transparent hover:opacity-80',
    ].join(' ')

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          {/* 로고 */}
          <Link
            to={ROUTES.HOME}
            className="flex items-center"
            aria-label="온담 홈으로 이동"
          >
            {/* 모바일: 마크만 */}
            <img
              src={logoMarkUrl}
              alt="온담"
              height={36}
              width={36}
              className="sm:hidden"
            />
            {/* 데스크톱: 전체 로고 */}
            <img
              src={logoUrl}
              alt="온담 - AI 기억사진관"
              height={40}
              width={150}
              className="hidden sm:block"
            />
          </Link>

          {/* 데스크톱 네비게이션 */}
          <nav className="hidden md:flex items-center gap-8" aria-label="주요 메뉴">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={navLinkClass}
                style={({ isActive }) => ({
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  borderColor: isActive ? 'var(--color-warm-accent)' : 'transparent',
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* 우측 영역: 데스크톱 인증 버튼 + 모바일 햄버거 */}
          <div className="flex items-center gap-3">
            {/* 데스크톱 인증 버튼 — 인증 페이지(로그인/회원가입)에서는 숨김 */}
            <div className="hidden md:flex items-center gap-3">
              {/* 인증 페이지(로그인·회원가입)에서는 버튼 전체 숨김 */}
              {!isAuthPage && (
                isAuthenticated ? (
                  <>
                    <Link
                      to={ROUTES.MY}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        minHeight: 'var(--min-touch-target)',
                        padding: '0 var(--spacing-lg)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-strong)',
                        color: 'var(--color-text-primary)',
                        fontSize: 'var(--fs-body)',
                        fontWeight: 500,
                        transition: 'var(--transition-base)',
                        backgroundColor: 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-surface-warm)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      마이페이지
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        minHeight: 'var(--min-touch-target)',
                        padding: '0 var(--spacing-lg)',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--fs-body)',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'var(--transition-base)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-primary)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-secondary)'
                      }}
                    >
                      로그아웃
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to={ROUTES.LOGIN}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        minHeight: 'var(--min-touch-target)',
                        padding: '0 var(--spacing-lg)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-strong)',
                        color: 'var(--color-text-primary)',
                        fontSize: 'var(--fs-body)',
                        fontWeight: 500,
                        transition: 'var(--transition-base)',
                        backgroundColor: 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-surface-warm)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      로그인
                    </Link>
                    <Link
                      to={ROUTES.JOIN}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        minHeight: 'var(--min-touch-target)',
                        padding: '0 var(--spacing-md)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-text-on-dark)',
                        fontSize: 'var(--fs-body)',
                        fontWeight: 600,
                        transition: 'var(--transition-base)',
                        border: 'none',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-primary-soft)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-primary)'
                      }}
                    >
                      회원가입
                    </Link>
                  </>
                )
              )}
            </div>

            {/* 모바일 햄버거 버튼 */}
            <button
              ref={hamburgerRef}
              type="button"
              onClick={toggleDrawer}
              aria-label={drawerOpen ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
              className="flex items-center justify-center md:hidden"
              style={{
                width: 'var(--min-touch-target)',
                height: 'var(--min-touch-target)',
                minHeight: 'var(--min-touch-target)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                color: 'var(--color-text-primary)',
                flexShrink: 0,
              }}
            >
              {drawerOpen ? (
                /* X 아이콘 */
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                /* 햄버거 아이콘 */
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <line x1="3" y1="7" x2="21" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="17" x2="21" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 모바일 Drawer — drawerOpen=false 시 DOM에서 완전 제거 (스크린리더 노출 방지) */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 98,
              backgroundColor: 'rgba(42, 40, 38, 0.45)',
            }}
          />

          {/* Drawer 패널 */}
          <nav
            id="mobile-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="모바일 메뉴"
            className="md:hidden"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 99,
              width: 'min(280px, 85vw)',
              backgroundColor: 'var(--color-bg)',
              borderLeft: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {/* Drawer 상단: 닫기 버튼 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--spacing-md) var(--spacing-md)',
                borderBottom: '1px solid var(--color-border)',
                minHeight: 64,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 700,
                  fontSize: 'var(--fs-h3)',
                  letterSpacing: 'var(--ls-heading-ko)',
                  color: 'var(--color-text-primary)',
                }}
              >
                온담
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="메뉴 닫기"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 'var(--min-touch-target)',
                  height: 'var(--min-touch-target)',
                  minHeight: 'var(--min-touch-target)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  fontSize: 24,
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                ×
              </button>
            </div>

            {/* 메인 메뉴 */}
            <div style={{ flex: 1, padding: 'var(--spacing-md) 0' }}>
              {NAV_LINKS.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    padding: 'var(--spacing-md) var(--spacing-lg)',
                    fontSize: 'var(--fs-body-lg)',
                    fontWeight: 500,
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    backgroundColor: isActive ? 'var(--color-surface-warm)' : 'transparent',
                    borderLeft: isActive
                      ? '3px solid var(--color-warm-accent)'
                      : '3px solid transparent',
                    transition: 'var(--transition-base)',
                    minHeight: 'var(--min-touch-target)',
                    textDecoration: 'none',
                  })}
                >
                  {label}
                </NavLink>
              ))}
            </div>

            {/* 인증 영역 — 인증 페이지에서는 숨김 */}
            {!isAuthPage && (
              <div
                style={{
                  borderTop: '1px solid var(--color-border)',
                  padding: 'var(--spacing-lg) var(--spacing-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-sm)',
                }}
              >
                {isAuthenticated ? (
                  <>
                    <Link
                      to={ROUTES.MY}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 'var(--size-button-h)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-strong)',
                        color: 'var(--color-text-primary)',
                        fontSize: 'var(--fs-body)',
                        fontWeight: 500,
                        textDecoration: 'none',
                      }}
                    >
                      마이페이지
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 'var(--size-button-h)',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--fs-body)',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      로그아웃
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to={ROUTES.LOGIN}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 'var(--size-button-h)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-strong)',
                        color: 'var(--color-text-primary)',
                        fontSize: 'var(--fs-body)',
                        fontWeight: 500,
                        textDecoration: 'none',
                      }}
                    >
                      로그인
                    </Link>
                    <Link
                      to={ROUTES.JOIN}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 'var(--size-button-h)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-text-on-dark)',
                        fontSize: 'var(--fs-body)',
                        fontWeight: 600,
                        textDecoration: 'none',
                        border: 'none',
                      }}
                    >
                      회원가입
                    </Link>
                  </>
                )}
              </div>
            )}
          </nav>
        </>
      )}
    </>
  )
}
