import { Link, Outlet } from 'react-router-dom'
import { ROUTES } from '../constants/routes.js'

export default function AuthLayout() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      {/* 상단 로고 */}
      <Link
        to={ROUTES.HOME}
        className="mb-8 flex flex-col items-center gap-1"
        aria-label="온담 홈으로 이동"
      >
        <span
          className="font-bold text-3xl tracking-tight"
          style={{ color: 'var(--color-primary)' }}
        >
          온담
        </span>
        <span
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          AI 기억사진관
        </span>
      </Link>

      {/* 카드 */}
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-sm"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <Outlet />
      </div>
    </div>
  )
}
