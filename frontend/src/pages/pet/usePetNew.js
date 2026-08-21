import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { petApi } from './petApi.js'

const INITIAL_FORM = {
  name: '',
  species: '',
  breed: '',
  birthDate: '',
  deathDate: '',
}

export function usePetNew() {
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = '이름을 입력해 주세요.'
    if (!form.species) next.species = '종류를 선택해 주세요.'
    return next
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    const pendingRef = { current: false }
    if (pendingRef.current) return
    pendingRef.current = true
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        name: form.name.trim(),
        species: form.species,
        ...(form.breed && { breed: form.breed.trim() }),
        ...(form.birthDate && { birthDate: form.birthDate }),
        ...(form.deathDate && { deathDate: form.deathDate }),
      }
      const { data } = await petApi.createPet(payload)
      if (data.success) {
        navigate(`/pet/${data.data.petId}`)
      }
    } catch (err) {
      // FIX: DEV-24 - 등록 실패를 가짜 ID로 이동시켜 성공처럼 보이게 하지 않는다
      setSubmitError(err?.response?.data?.message ?? '반려동물 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      pendingRef.current = false
      setIsSubmitting(false)
    }
  }

  return { form, errors, isSubmitting, submitError, handleChange, handleSubmit }
}
