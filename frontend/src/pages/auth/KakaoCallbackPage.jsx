import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import apiClient from '../../config/apiClient.js'

export default function KakaoCallbackPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const hashParams = new URLSearchParams(hash)
    const token = hashParams.get('token')
    if (!token) {
      // FIX: DEV-24 - 토큰 없이 가짜 사용자로 로그인시키지 않는다. 로그인 페이지로 되돌린다
      navigate('/login', { replace: true })
      return
    }

    // accessToken 저장
    useAuthStore.getState().setAccessToken(token)

    // 사용자 정보 조회
    apiClient.get('/users/me')
      .then((res) => {
        const user = res.data.data
        setAuth(user, token)
        navigate('/')
      })
      .catch(() => {
        // FIX: DEV-24 - 사용자 정보 조회 실패를 가짜 사용자로 위장하지 않는다
        navigate('/login', { replace: true })
      })
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="카카오 로그인 처리 중"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 'var(--spacing-lg)',
        padding: 'var(--spacing-2xl) var(--spacing-md)',
        backgroundColor: 'var(--color-bg)',
        maxWidth: '100vw',
        overflowX: 'hidden',
      }}
    >
      {/* 브랜드 컬러 스피너 */}
      <div
        aria-hidden="true"
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-accent-brand)',
          animation: 'ondam-spin 0.9s linear infinite',
        }}
      />

      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>
        카카오 로그인 처리 중...
      </p>

      {/* 스피너 keyframes - 인라인 style 태그 */}
      <style>{`
        @keyframes ondam-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
