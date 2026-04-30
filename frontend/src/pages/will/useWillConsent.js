import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { willApi } from './willApi.js'

const CONSENT_ITEMS = [
  {
    key: 'portrait',
    label: '초상권 동의 (필수)',
    desc: '본인의 얼굴 사진이 AI 영상 생성에 활용되는 것에 동의합니다.',
  },
  {
    key: 'voice',
    label: '음성권 동의 (필수)',
    desc: '본인의 음성이 AI 음성 복제에 활용되는 것에 동의합니다.',
  },
  {
    key: 'ai_generation',
    label: 'AI 생성물 동의 (필수)',
    desc: 'AI가 생성한 영상이 온담 서비스 내에 보관되는 것에 동의합니다.',
  },
  {
    key: 'posthumous_release',
    label: '사후 공개 동의 (필수)',
    desc: '본인 사망 확인 후 지정한 유가족에게 영상이 공개되는 것에 동의합니다.',
  },
]

const INITIAL_CONSENTS = {
  portrait: false,
  voice: false,
  ai_generation: false,
  posthumous_release: false,
}

export function useWillConsent() {
  const navigate = useNavigate()
  const [consents, setConsents] = useState(INITIAL_CONSENTS)

  const allChecked = Object.values(consents).every(Boolean)

  const toggleItem = useCallback((key) => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const toggleAll = useCallback(() => {
    const next = !allChecked
    setConsents({
      portrait: next,
      voice: next,
      ai_generation: next,
      posthumous_release: next,
    })
  }, [allChecked])

  const handleNext = useCallback(async () => {
    if (!allChecked) return
    localStorage.setItem('will_consents', JSON.stringify(consents))

    const consentPayload = CONSENT_ITEMS.map((item) => ({
      consentType: item.key,
      isAgreed: consents[item.key] ?? false,
    }))

    try {
      await willApi.saveConsents(consentPayload)
    } catch {
      // 동의 저장 실패는 비차단 - 로컬스토리지에 이미 저장됨
    }

    navigate('/will/beneficiaries')
  }, [allChecked, consents, navigate])

  return {
    consents,
    allChecked,
    consentItems: CONSENT_ITEMS,
    toggleItem,
    toggleAll,
    handleNext,
  }
}
