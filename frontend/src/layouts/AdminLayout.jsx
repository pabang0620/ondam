import { useState, useEffect, useRef, useCallback } from 'react'
import { NavLink, Outlet, Navigate, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.js'
import { ROUTES } from '../constants/routes.js'
import { LayoutDashboard, Users, ShoppingBag, Unlock, Menu, X } from 'lucide-react'

const NAV_ITEMS = [
  { to: ROUTES.ADMIN, label: '대시보드', icon: LayoutDashboard, end: true },
  { to: ROUTES.ADMIN_RELEASE, label: '사후공개', icon: Unlock },
  { to: ROUTES.ADMIN_ORDERS, label: '주문관리', icon: ShoppingBag },
  { to: ROUTES.ADMIN_USERS, label: '회원관리', icon: Users },
]

const SIDEBAR_WIDTH = 224 // 14rem = w-56

export default function AdminLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const sidebarRef = useRef(null)
  const hamburgerRef = useRef(null)

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

  if (!isAuthenticated || user?.role !== 'admin') {
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
        className="flex flex-col gap-1 px-3 py-4 flex-1"
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
              padding: 'var(--spacing-sm) var(--spacing-sm)',
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

      {/* 하단 사용자 정보 */}
      <div
        className="px-5 py-4 text-xs"
        style={{
          borderTop: '1px solid rgba(245, 239, 230, 0.15)',
          color: 'rgba(245, 239, 230, 0.5)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
          flexShrink: 0,
        }}
      >
        {user?.nickname || user?.email}
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
