import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import apiClient from '../../config/apiClient.js'
import { ROUTES } from '../../constants/routes.js'

// 백엔드가 카카오 로그인 실패 시 ?error=<code>로 돌려보낸다
const KAKAO_ERROR_MESSAGES = {
  cancelled: '카카오 로그인을 취소했습니다.',
  email_exists: '이미 이메일로 가입된 계정입니다. 이메일로 로그인해 주세요.',
  inactive: '이용이 제한된 계정입니다. 고객센터로 문의해 주세요.',
}
const KAKAO_ERROR_DEFAULT = '카카오 로그인에 실패했습니다.'

function getInitialErrorMessage() {
  const code = new URLSearchParams(window.location.search).get('error')
  if (!code) return null
  return Object.hasOwn(KAKAO_ERROR_MESSAGES, code) ? KAKAO_ERROR_MESSAGES[code] : KAKAO_ERROR_DEFAULT
}

export default function KakaoCallbackPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [errorMessage, setErrorMessage] = useState(getInitialErrorMessage)

  useEffect(() => {
    // 백엔드가 실패 코드를 보낸 경우 안내 화면을 보여주고 토큰 처리는 하지 않는다
    if (errorMessage) return

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
        // replace: 뒤로가기로 토큰이 담긴 콜백 URL에 다시 들어오지 않게 한다
        navigate('/', { replace: true })
      })
      .catch(() => {
        // FIX: DEV-24 - 사용자 정보 조회 실패를 가짜 사용자로 위장하지 않는다
        useAuthStore.getState().clearUser()
        setErrorMessage(KAKAO_ERROR_DEFAULT)
      })
    // 마운트 시 1회만 처리한다(콜백 URL은 페이지 진입 시점에 확정됨)
  }, [])

  if (errorMessage) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 'var(--spacing-lg)',
          padding: 'var(--spacing-2xl) var(--spacing-md)',
          backgroundColor: 'var(--color-bg)',
          textAlign: 'center',
        }}
      >
        <p
          role="alert"
          style={{ fontSize: 'var(--fs-body-lg)', color: 'var(--color-text-primary)', maxWidth: '24rem', wordBreak: 'keep-all' }}
        >
          {errorMessage}
        </p>
        <Link
          to={ROUTES.LOGIN}
          replace
          className="flex items-center justify-center font-semibold"
          style={{
            minHeight: 'var(--size-button-h)',
            width: '100%',
            maxWidth: '320px',
            padding: '0 32px',
            fontSize: 'var(--fs-button)',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-on-dark)',
            borderRadius: 'var(--radius-pill)',
          }}
        >
          로그인 화면으로 가기
        </Link>
      </div>
    )
  }

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

      {/* 스피너 keyframes - 인라인 style 태그 */}
      <style>{`
        @keyframes ondam-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
