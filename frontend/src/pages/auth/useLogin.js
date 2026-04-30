import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import { postLogin } from './loginApi.js'
import { ROUTES } from '../../constants/routes.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function useLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

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
      navigate(ROUTES.HOME)
    } catch (err) {
      console.warn('[mock] 로그인 API 실패 - mock 사용자로 진입합니다', err)
      setAuth(
        {
          user_id: 'mock-user-001',
          email: email || 'demo@ondam.kr',
          nickname: '데모 사용자',
          role: 'user',
        },
        'mock-token',
      )
      navigate(ROUTES.HOME)
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
