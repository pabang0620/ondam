import { useState, useEffect, useRef, useCallback } from 'react'
import { NavLink, Outlet, Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes.js'
import { LayoutDashboard, Users, ShoppingBag, Unlock, Menu, X, LogOut } from 'lucide-react'
import {
  useAdminAuthStore,
  getAdminAccessToken,
  refreshAdminAuth,
  logoutAdminSession,
} from '../config/adminApiClient.js'

const NAV_ITEMS = [
  { to: ROUTES.ADMIN, label: '대시보드', icon: LayoutDashboard, end: true },
  { to: ROUTES.ADMIN_RELEASE, label: '사후공개', icon: Unlock },
  { to: ROUTES.ADMIN_ORDERS, label: '주문관리', icon: ShoppingBag },
  { to: ROUTES.ADMIN_USERS, label: '회원관리', icon: Users },
]

const SIDEBAR_WIDTH = 224 // 14rem = w-56

export default function AdminLayout() {
  // FIX: HIGH-1 - 관리자 identity는 이제 useAuthStore(일반 사용자)가 아니라
  // useAdminAuthStore(관리자 전용, adminApiClient.js)에서만 읽는다. 두 store가
  // 완전히 분리돼 있어 App.jsx의 전역 initAuth()가 언제 끝나든 이 값을 덮어쓸 수 없다.
  const adminUser = useAdminAuthStore((s) => s.adminUser)
  const location = useLocation()
  const navigate = useNavigate()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const sidebarRef = useRef(null)
  const hamburgerRef = useRef(null)

  // FIX: phase0-followups B-3 - adminToken(localStorage) 저장을 없애고 메모리 토큰 +
  // 'art' HttpOnly 쿠키 기반 refresh로 전환했다. 새로고침 직후에는 메모리 토큰이
  // 항상 비어 있으므로(의도된 동작 - XSS 방어), 이 컴포넌트가 마운트될 때 한 번
  // /admin/auth/refresh를 시도해 세션 복원을 완결한다.
  //
  // FIX: HIGH-1 - 이 컴포넌트만의 독립된 판정 상태(adminSessionState)로 결과를 즉시
  // 반영하는 것은 그대로 유지한다(마운트 시점 판정에 유용). 다만 예전 주석대로
  // "완전한 경쟁 상태 제거는 admin 전용 store 분리가 필요"했던 부분을 이번에 실제로
  // 분리했다 - adminUser는 이제 useAdminAuthStore에서 오므로, App.jsx의 전역
  // initAuth()(일반 사용자 rt 쿠키 기반)가 언제 끝나든 이 값을 건드릴 수 없다.
  const [adminSessionState, setAdminSessionState] = useState('checking') // 'checking' | 'ready' | 'failed'
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (attemptedRef.current) return
    attemptedRef.current = true

    if (getAdminAccessToken()) {
      // 로그인 직후 첫 진입 등 - 이미 메모리 토큰이 있으면 재갱신 불필요
      setAdminSessionState('ready')
      return
    }

    refreshAdminAuth()
      .then(({ user: refreshedUser }) => {
        setAdminSessionState(refreshedUser?.role === 'admin' ? 'ready' : 'failed')
      })
      .catch(() => setAdminSessionState('failed'))
  }, [])

  const handleLogout = useCallback(async () => {
    // logoutAdminSession()이 서버 호출(art 쿠키 무효화) + 클라이언트 상태 정리를
    // 함께 수행한다. 서버 실패도 내부에서 흡수하므로 여기서는 그냥 기다리기만 한다.
    await logoutAdminSession()
    navigate(ROUTES.ADMIN_LOGIN, { replace: true })
  }, [navigate])

  // 페이지 이동 시 사이드바 닫기
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // 사이드바 열릴 때 스크롤 잠금 + 포커스
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
      const firstFocusable = sidebarRef.current?.querySelector(
        'a, button, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  // ESC 닫기 + 포커스 트랩
  useEffect(() => {
    if (!sidebarOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false)
        hamburgerRef.current?.focus()
        return
      }
      if (e.key === 'Tab' && sidebarRef.current) {
        const focusable = sidebarRef.current.querySelectorAll(
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
  }, [sidebarOpen])

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), [])

  // 관리자 세션 복원(refreshAdminAuth)이 끝나기 전에는 판정을 보류하고 로딩을 렌더한다.
  if (adminSessionState === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-screen" role="status" aria-label="인증 확인 중">
        <div
          className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
        />
        <p style={{ marginLeft: 'var(--spacing-md)', fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>
          로그인 정보를 확인하고 있어요
        </p>
      </div>
    )
  }

  if (
    adminSessionState === 'failed' ||
    !adminUser ||
    adminUser.role !== 'admin' ||
    !getAdminAccessToken()
  ) {
    return <Navigate to={ROUTES.ADMIN_LOGIN} replace />
  }

  const sidebarContent = (
    <>
      {/* 로고 영역 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid rgba(245, 239, 230, 0.15)',
          flexShrink: 0,
        }}
      >
        <Link
          to={ROUTES.ADMIN}
          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
        >
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: 'var(--fs-body-lg)',
              color: 'var(--color-text-on-dark)',
              letterSpacing: 'var(--ls-heading-ko)',
            }}
          >
            온담
          </span>
          <span
            style={{
              fontSize: 'var(--fs-caption)',
              color: 'rgba(245, 239, 230, 0.6)',
            }}
          >
            관리자
          </span>
        </Link>

        {/* 모바일에서만 보이는 닫기 버튼 */}
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="사이드바 닫기"
          className="lg:hidden"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'var(--min-touch-target)',
            height: 'var(--min-touch-target)',
            minHeight: 'var(--min-touch-target)',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-on-dark)',
            cursor: 'pointer',
            borderRadius: 'var(--radius-sm)',
            flexShrink: 0,
          }}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* 메뉴 */}
      <nav
        className="flex flex-col gap-1 px-3 py-5 flex-1"
        aria-label="관리자 메뉴"
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--fs-caption)',
              fontWeight: 500,
              color: isActive ? 'var(--color-text-on-dark)' : 'rgba(245, 239, 230, 0.65)',
              backgroundColor: isActive ? 'rgba(245, 239, 230, 0.18)' : 'transparent',
              transition: 'var(--transition-base)',
              textDecoration: 'none',
              minHeight: 'var(--min-touch-target)',
            })}
            onMouseEnter={(e) => {
              if (!e.currentTarget.getAttribute('aria-current')) {
                e.currentTarget.style.backgroundColor = 'rgba(245, 239, 230, 0.1)'
                e.currentTarget.style.color = 'var(--color-text-on-dark)'
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.getAttribute('aria-current')) {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'rgba(245, 239, 230, 0.65)'
              }
            }}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* 하단 사용자 정보 + 로그아웃 */}
      <div
        className="px-5 py-4 text-xs flex items-center justify-between"
        style={{
          borderTop: '1px solid rgba(245, 239, 230, 0.15)',
          color: 'rgba(245, 239, 230, 0.5)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
          flexShrink: 0,
          gap: 'var(--spacing-sm)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {/* FIX: HIGH-1 겸사 - adminService.toSessionUser는 nickname이 아니라 name을
              반환한다. 기존 코드는 user.nickname을 참조해 항상 undefined -> email로만
              폴백됐다(사소한 기존 버그, 이번 리팩터링 범위 안이라 함께 정정). */}
          {adminUser?.name || adminUser?.email}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="관리자 로그아웃"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            minHeight: 'var(--min-touch-target)',
            padding: '0 var(--spacing-sm)',
            border: 'none',
            background: 'transparent',
            color: 'rgba(245, 239, 230, 0.75)',
            fontSize: 'var(--fs-caption)',
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <LogOut size={16} aria-hidden="true" />
          로그아웃
        </button>
      </div>
    </>
  )

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-alt)',
        maxWidth: '100vw',
        overflowX: 'hidden',
      }}
    >
      {/* 데스크톱 사이드바 (lg 이상에서 항상 표시) */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0"
        style={{
          width: SIDEBAR_WIDTH,
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-text-on-dark)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {sidebarContent}
      </aside>

      {/* 모바일/태블릿 backdrop */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 98,
            backgroundColor: 'rgba(42, 40, 38, 0.45)',
          }}
          className="lg:hidden"
        />
      )}

      {/* 모바일/태블릿 drawer 사이드바 */}
      <aside
        ref={sidebarRef}
        role="dialog"
        aria-modal="true"
        aria-label="관리자 메뉴"
        className="lg:hidden flex flex-col flex-shrink-0"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 99,
          width: SIDEBAR_WIDTH,
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-text-on-dark)',
          transform: sidebarOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`,
          transition: 'transform 0.25s ease',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* 메인 컨텐츠 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          maxWidth: '100%',
          overflowX: 'hidden',
        }}
      >
        {/* 모바일/태블릿 상단 바 */}
        <div
          className="lg:hidden flex items-center"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-on-dark)',
            borderBottom: '1px solid rgba(245, 239, 230, 0.15)',
            padding: '0 var(--spacing-md)',
            height: 56,
            paddingTop: 'env(safe-area-inset-top, 0px)',
            gap: 'var(--spacing-md)',
          }}
        >
          <button
            ref={hamburgerRef}
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'var(--min-touch-target)',
              height: 'var(--min-touch-target)',
              minHeight: 'var(--min-touch-target)',
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-on-dark)',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
              flexShrink: 0,
            }}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: 'var(--fs-body-lg)',
              color: 'var(--color-text-on-dark)',
              letterSpacing: 'var(--ls-heading-ko)',
            }}
          >
            온담 관리자
          </span>
        </div>

        <main
          className="p-4 sm:p-6 lg:p-8"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
