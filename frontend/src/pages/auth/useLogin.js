import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import { postLogin } from './loginApi.js'
import { ROUTES } from '../../constants/routes.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// PrivateRoute가 넘긴 state.from(location 객체)을 안전한 앱 내부 경로로만 변환한다.
// '/'로 시작하고 '//'(프로토콜 상대 URL - 외부 도메인 이동)로 시작하지 않는 경로만
// 허용하고, 그 외에는 홈으로 보낸다(오픈 리다이렉트 방지).
export function getSafeRedirect(from) {
  const pathname = typeof from?.pathname === 'string' ? from.pathname : ''
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return ROUTES.HOME
  if (pathname === ROUTES.LOGIN) return ROUTES.HOME
  const search = typeof from?.search === 'string' ? from.search : ''
  const hash = typeof from?.hash === 'string' ? from.hash : ''
  return `${pathname}${search}${hash}`
}

export function useLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()
  const location = useLocation()

  const validate = () => {
    if (!EMAIL_REGEX.test(email)) return '유효한 이메일 주소를 입력해주세요.'
    if (password.length < 1) return '비밀번호를 입력해주세요.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)
    try {
      const { user, accessToken } = await postLogin({ email, password })
      setAuth(user, accessToken)
      navigate(getSafeRedirect(location.state?.from), { replace: true })
    } catch (err) {
      // FIX: DEV-24 - 로그인 실패를 가짜 사용자로 위장하지 않고 실제 에러를 보여준다
      setError(err?.response?.data?.message ?? '이메일 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    error,
    handleSubmit,
  }
}
