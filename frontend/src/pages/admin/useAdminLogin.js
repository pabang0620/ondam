import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from './adminApi.js'
import { setAdminAccessToken, useAdminAuthStore } from '../../config/adminApiClient.js'
import { ROUTES } from '../../constants/routes.js'

export function useAdminLogin() {
  const navigate = useNavigate()
  // FIX: HIGH-1 - useAuthStore.setAuth() 대신 관리자 전용 store에만 반영한다.
  const setAdminUser = useAdminAuthStore((s) => s.setAdminUser)
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
        // phase0-followups B-3: accessToken은 메모리(adminApiClient)에만 보관한다.
        // refreshToken은 백엔드가 HttpOnly 쿠키('art')로 이미 심어준 상태.
        setAdminAccessToken(accessToken)
        // FIX: HIGH-1 - useAuthStore를 더 이상 건드리지 않는다 (일반 사용자 store와
        // 완전 분리).
        setAdminUser(user)
        navigate(ROUTES.ADMIN, { replace: true })
      }
    } catch (err) {
      // FIX: DEV-24 - 관리자 로그인 실패를 가짜 토큰으로 위장해 /admin에 진입시키지 않는다
      setError(err?.response?.data?.message ?? '이메일 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return { form, error, isSubmitting, handleChange, handleSubmit }
}
