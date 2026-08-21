import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.js'

export default function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isAuthInitialized = useAuthStore((s) => s.isAuthInitialized)

  // FIX: DEV-27 - App.jsx의 initAuth()(POST /auth/refresh)는 비동기다. 초기화가 끝나기
  // 전에 isAuthenticated=false만 보고 즉시 /login으로 리다이렉트하면, 유효한 세션을 가진
  // 사용자가 새로고침할 때마다 로그인 화면으로 튕긴다. 초기화 완료 전에는 판정을 보류한다.
  if (!isAuthInitialized) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="인증 확인 중">
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

  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}
