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
