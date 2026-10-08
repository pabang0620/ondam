import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { petApi } from './petApi.js'
import { ROUTES } from '../../constants/routes.js'
import { getTodayKst } from '../../utils/petAge.js'
import { buildUpdatePayload, toFormValues, validatePetEditForm } from './petEditForm.js'

const LOAD_MESSAGES = {
  403: '이 반려동물을 수정할 권한이 없어요.',
  404: '반려동물을 찾을 수 없어요.',
}
const LOAD_FALLBACK = '반려동물 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
const SAVE_MESSAGES = {
  400: '입력한 내용을 다시 확인해 주세요.',
  403: '이 반려동물을 수정할 권한이 없어요.',
  404: '반려동물을 찾을 수 없어요.',
}
const SAVE_FALLBACK = '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'

const isCanceled = (err) => err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError'

// 서버 zod z.string().uuid() 와 같은 형식(8-4-4-4-12 16진수, 대소문자 허용)
const PET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isValidPetId = (value) => typeof value === 'string' && PET_ID_PATTERN.test(value)
// 형식 불일치는 API 호출 없이 기존 404 상태로 처리
const INVALID_ID_ERROR = { status: 404, message: LOAD_MESSAGES[404] }

export function usePetEdit(petId) {
  const navigate = useNavigate()
  const isIdValid = isValidPetId(petId)
  const [pet, setPet] = useState(null)
  const [initial, setInitial] = useState(null)
  const [form, setForm] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  // { status: number | null, message: string } | null
  const [loadError, setLoadError] = useState(null)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const pendingRef = useRef(false)
  // 오늘(KST)은 마운트 시 한 번만 구한다
  const [today] = useState(getTodayKst)

  useEffect(() => {
    if (!isIdValid) return undefined
    const ac = new AbortController()
    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        // petId 는 위 isIdValid(UUID 형식) 검증을 통과한 값만 URL 경로에 들어간다
        const res = await petApi.getPet(petId, ac.signal)
        const data = res.data?.data
        if (!res.data?.success || !data) {
          setLoadError({ status: null, message: LOAD_FALLBACK })
          return
        }
        const values = toFormValues(data)
        setPet(data)
        setInitial(values)
        setForm(values)
      } catch (err) {
        if (isCanceled(err)) return
        const status = err?.response?.status ?? null
        setLoadError({ status, message: LOAD_MESSAGES[status] ?? LOAD_FALLBACK })
      } finally {
        if (!ac.signal.aborted) setIsLoading(false)
      }
    }
    load()
    return () => ac.abort()
  }, [petId, isIdValid, reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isIdValid || pendingRef.current || !form || !initial) return
    const nextErrors = validatePetEditForm(form, { today, deathDate: pet?.death_date ?? null })
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    const payload = buildUpdatePayload(initial, form)
    if (Object.keys(payload).length === 0) {
      navigate(ROUTES.PET, { replace: true })
      return
    }

    pendingRef.current = true
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      // petId 는 위 isIdValid(UUID 형식) 가드를 통과한 값만 URL 경로에 들어간다
      const res = await petApi.updatePet(petId, payload)
      if (res.data?.success) {
        navigate(ROUTES.PET, { replace: true })
        return
      }
      setSubmitError(SAVE_FALLBACK)
    } catch (err) {
      setSubmitError(SAVE_MESSAGES[err?.response?.status] ?? SAVE_FALLBACK)
    } finally {
      pendingRef.current = false
      setIsSubmitting(false)
    }
  }

  return {
    pet: isIdValid ? pet : null,
    form: isIdValid ? form : null,
    today,
    errors,
    isLoading: isIdValid && isLoading,
    loadError: isIdValid ? loadError : INVALID_ID_ERROR,
    isSubmitting,
    submitError,
    handleChange,
    handleSubmit,
    reload,
  }
}
