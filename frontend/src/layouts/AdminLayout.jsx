import { NavLink, Outlet, Navigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.js'
import { ROUTES } from '../constants/routes.js'
import { LayoutDashboard, Users, ShoppingBag, Unlock } from 'lucide-react'

const NAV_ITEMS = [
  { to: ROUTES.ADMIN, label: '대시보드', icon: LayoutDashboard, end: true },
  { to: ROUTES.ADMIN_RELEASE, label: '사후공개', icon: Unlock },
  { to: ROUTES.ADMIN_ORDERS, label: '주문관리', icon: ShoppingBag },
  { to: ROUTES.ADMIN_USERS, label: '회원관리', icon: Users },
]

export default function AdminLayout() {
  const { isAuthenticated, user } = useAuthStore((s) => ({
    isAuthenticated: s.isAuthenticated,
    user: s.user,
  }))

  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to={ROUTES.ADMIN_LOGIN} replace />
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* 사이드바 */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col"
        style={{
          backgroundColor: 'var(--color-primary-dark)',
          color: 'var(--color-surface)',
        }}
      >
        {/* 로고 */}
        <Link
          to={ROUTES.ADMIN}
          className="flex items-center gap-2 px-6 py-5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.12)' }}
        >
          <span className="font-bold text-lg tracking-tight text-white">온담</span>
          <span className="text-xs opacity-60">관리자</span>
        </Link>

        {/* 메뉴 */}
        <nav className="flex flex-col gap-1 px-3 py-4 flex-1" aria-label="관리자 메뉴">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white',
                ].join(' ')
              }
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* 하단 사용자 정보 */}
        <div
          className="px-5 py-4 border-t text-xs text-white/50"
          style={{ borderColor: 'rgba(255,255,255,0.12)' }}
        >
          {user?.nickname || user?.email}
        </div>
      </aside>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
