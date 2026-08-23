import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import { postRegister } from './joinApi.js'
import { ROUTES } from '../../constants/routes.js'
import { SIGNUP_CONSENT_ITEMS as CONSENT_ITEMS } from '../../components/consent/consentItems.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 결정3(2026-08-22): 약관을 게시해도 동의가 선택이면 계약 편입이 다투어질 수
// 있다는 법무 검토 결과로 terms를 필수 동의로 변경. validateStep2가
// CONSENT_ITEMS의 required만 보고 검증하므로 이 값만 바꾸면 UI(별표 표시)와
// 검증 로직에 자동 반영된다.
// [결함B 후속] 선물 수행 경로(GiftPerformPage.jsx)가 이 배열을 [{type:'privacy'}]로
// 임의 축소해 terms 필수 동의를 우회하던 문제가 있었다. 같은 배열을
// components/consent/consentItems.js로 옮겨 두 화면이 동일한 SSOT를 쓰게 한다.

const initialConsents = CONSENT_ITEMS.reduce(
  (acc, item) => ({ ...acc, [item.type]: false }),
  {},
)

export function useJoin() {
  const [step, setStep] = useState(1)

  // Step 1 필드
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')

  // Step 2 동의
  const [consents, setConsents] = useState(initialConsents)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const validateStep1 = () => {
    if (!EMAIL_REGEX.test(email)) return '유효한 이메일 주소를 입력해주세요.'
    if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
    if (nickname.trim().length < 2) return '닉네임은 2자 이상이어야 합니다.'
    return null
  }

  const validateStep2 = () => {
    const requiredItems = CONSENT_ITEMS.filter((item) => item.required)
    const allRequired = requiredItems.every((item) => consents[item.type])
    if (!allRequired) return '필수 동의 항목에 동의해주세요.'
    return null
  }

  const handleNextStep = (e) => {
    e.preventDefault()
    setError(null)
    const err = validateStep1()
    if (err) {
      setError(err)
      return
    }
    setStep(2)
  }

  const handleConsentChange = (type) => {
    setConsents((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  const handleAllConsent = (checked) => {
    const next = CONSENT_ITEMS.reduce((acc, item) => ({ ...acc, [item.type]: checked }), {})
    setConsents(next)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const err = validateStep2()
    if (err) {
      setError(err)
      return
    }

    const consentPayload = CONSENT_ITEMS.map((item) => ({
      type: item.type,
      isAgreed: consents[item.type],
    }))

    setIsLoading(true)
    try {
      const { user, accessToken } = await postRegister({
        email,
        password,
        nickname: nickname.trim(),
        consents: consentPayload,
      })
      setAuth(user, accessToken)
      navigate(ROUTES.HOME)
    } catch (err) {
      // FIX: DEV-24 - 회원가입 실패를 성공으로 위장해 로그인 페이지로 넘기지 않는다
      setError(err?.response?.data?.message ?? '회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const allChecked = CONSENT_ITEMS.every((item) => consents[item.type])

  return {
    step,
    setStep,
    email,
    setEmail,
    password,
    setPassword,
    nickname,
    setNickname,
    consents,
    handleConsentChange,
    handleAllConsent,
    allChecked,
    isLoading,
    error,
    handleNextStep,
    handleSubmit,
    consentItems: CONSENT_ITEMS,
  }
}
