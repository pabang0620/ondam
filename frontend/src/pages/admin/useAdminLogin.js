import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from './adminApi.js'
import { useAuthStore } from '../../store/authStore.js'
import { ROUTES } from '../../constants/routes.js'

export function useAdminLogin() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore((s) => ({ setAuth: s.setAuth }))
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!form.email || !form.password) {
      setError('이메일과 비밀번호를 입력해 주세요.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { data } = await adminApi.login(form.email, form.password)
      if (data.success) {
        const { accessToken, user } = data.data
        localStorage.setItem('adminToken', accessToken)
        setAuth(user, accessToken)
        navigate(ROUTES.ADMIN, { replace: true })
      }
    } catch (err) {
      setError(err.response?.data?.message || '로그인에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return { form, error, isSubmitting, handleChange, handleSubmit }
}
