import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const EMPTY_FORM = { name: '', email: '', phone: '', relationship: '' }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 숫자 10~11자리, 하이픈 허용 (예: 010-1234-5678, 01012345678)
const PHONE_PATTERN = /^[0-9-]+$/

function validateForm(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = '이름을 입력해 주세요.'
  if (!form.relationship) errors.relationship = '관계를 선택해 주세요.'

  const email = form.email.trim()
  if (!email) errors.email = '이메일을 입력해 주세요.'
  else if (!EMAIL_PATTERN.test(email)) errors.email = '이메일 형식이 올바르지 않습니다. 예) example@email.com'

  const phone = form.phone.trim()
  const digits = phone.replace(/-/g, '')
  if (!phone) errors.phone = '휴대폰 번호를 입력해 주세요.'
  else if (!PHONE_PATTERN.test(phone) || digits.length < 10 || digits.length > 11) {
    errors.phone = '휴대폰 번호는 숫자 10~11자리로 입력해 주세요. 예) 010-1234-5678'
  }
  return errors
}

export function useWillBeneficiaries() {
  const navigate = useNavigate()
  const [beneficiaries, setBeneficiaries] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [isAdding, setIsAdding] = useState(false)

  const updateForm = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    // 수정하는 필드의 오류는 바로 지운다
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  // 필수값(이름·이메일·휴대폰·관계)이 모두 채워져야 추가 버튼 활성화
  const canAdd = Boolean(
    form.name.trim() && form.email.trim() && form.phone.trim() && form.relationship,
  )

  const addBeneficiary = useCallback(() => {
    const nextErrors = validateForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setBeneficiaries((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        relationship: form.relationship,
      },
    ])
    setForm(EMPTY_FORM)
    setIsAdding(false)
  }, [form])

  const removeBeneficiary = useCallback((id) => {
    setBeneficiaries((prev) => prev.filter((b) => b.id !== id))
  }, [])

  const updateBeneficiary = useCallback((id, field, value) => {
    setBeneficiaries((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    )
  }, [])

  const handleNext = useCallback(() => {
    if (beneficiaries.length === 0) return
    localStorage.setItem('will_beneficiaries', JSON.stringify(beneficiaries))
    navigate('/will/record')
  }, [beneficiaries, navigate])

  return {
    beneficiaries,
    form,
    errors,
    canAdd,
    isAdding,
    setIsAdding,
    updateForm,
    addBeneficiary,
    removeBeneficiary,
    updateBeneficiary,
    handleNext,
  }
}
