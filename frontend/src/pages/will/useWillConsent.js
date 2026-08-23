import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { willApi } from './willApi.js'
import { WILL_CONSENT_ITEMS } from '../../components/consent/consentItems.js'
import { useConsentChecklist } from '../../components/consent/useConsentChecklist.js'

export function useWillConsent() {
  const navigate = useNavigate()
  const { consents, allChecked, toggleItem, toggleAll } = useConsentChecklist(WILL_CONSENT_ITEMS)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const handleNext = useCallback(async () => {
    if (!allChecked || isSaving) return

    const consentPayload = WILL_CONSENT_ITEMS.map((item) => ({
      consentType: item.key,
      isAgreed: consents[item.key] ?? false,
    }))

    setIsSaving(true)
    setSaveError(null)
    try {
      await willApi.saveConsents(consentPayload)
      // FIX: D - 서버 저장이 성공했을 때만 localStorage에 기록한다. 서버 user_consents가
      // 법적 증빙의 정본이고, localStorage는 그 성공 이후의 UX 캐시일 뿐이다.
      localStorage.setItem('will_consents', JSON.stringify(consents))
      navigate('/will/beneficiaries')
    } catch (err) {
      // FIX: D - 빈 catch{}로 저장 실패를 삼키지 않는다. 동의 저장 실패 시 사용자에게
      // 알리고 다음 단계로 넘어가지 못하게 막는다(서버 기록 없이 진행 금지).
      setSaveError(
        err?.response?.data?.message ?? '동의 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setIsSaving(false)
    }
  }, [allChecked, isSaving, consents, navigate])

  return {
    consents,
    allChecked,
    consentItems: WILL_CONSENT_ITEMS,
    toggleItem,
    toggleAll,
    handleNext,
    isSaving,
    saveError,
  }
}
