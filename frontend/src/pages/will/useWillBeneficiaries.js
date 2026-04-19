import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const EMPTY_FORM = { name: '', email: '', phone: '', relationship: '', message: '' }

export function useWillBeneficiaries() {
  const navigate = useNavigate()
  const [beneficiaries, setBeneficiaries] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [isAdding, setIsAdding] = useState(false)

  const updateForm = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const addBeneficiary = useCallback(() => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) return
    setBeneficiaries((prev) => [...prev, { ...form, id: Date.now() }])
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
    isAdding,
    setIsAdding,
    updateForm,
    addBeneficiary,
    removeBeneficiary,
    updateBeneficiary,
    handleNext,
  }
}
