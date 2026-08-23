import { useState, useRef } from 'react'
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
  // FIX: ep-006 - 렌더마다 새로 만들어지는 `{ current: false }` 리터럴은 ref가
  // 아니라 죽은 가드였다. 훅 최상위 useRef로 교체.
  const pendingRef = useRef(false)

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
        // FIX: 결함1 - petService.createPet은 PET_PUBLIC_FIELDS(pick) 화이트리스트를
        // 거쳐 snake_case DB 컬럼명 그대로 응답한다(pet_id, camelCase 변환 레이어 없음).
        // data.data.petId는 항상 undefined였고, /pet/undefined로 이동해 상세 페이지가
        // "params.petId: 유효하지 않은 petId입니다" 오류로 깨졌다(curl로 실제 응답
        // 확인: { data: { pet_id: "...", ... } }).
        navigate(`/pet/${data.data.pet_id}`)
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
