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
      console.warn('[mock] 카카오 콜백 token 없음 - mock 사용자로 진입합니다')
      setAuth(
        { user_id: 'mock-user-001', email: 'demo@ondam.kr', nickname: '데모 사용자', role: 'user' },
        'mock-token',
      )
      navigate('/')
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
      .catch((err) => {
        console.warn('[mock] 카카오 /users/me 실패 - mock 사용자로 진입합니다', err)
        setAuth(
          { user_id: 'mock-user-001', email: 'demo@ondam.kr', nickname: '데모 사용자', role: 'user' },
          'mock-token',
        )
        navigate('/')
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
          borderTopColor: 'var(--color-warm-accent)',
          animation: 'ondam-spin 0.9s linear infinite',
        }}
      />

      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>
        카카오 로그인 처리 중...
      </p>

      {/* 스피너 keyframes — 인라인 style 태그 */}
      <style>{`
        @keyframes ondam-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
