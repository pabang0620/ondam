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
      navigate('/login')
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
      .catch(() => navigate('/login'))
  }, [])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <p style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-secondary)' }}>
        카카오 로그인 처리 중...
      </p>
    </div>
  )
}
