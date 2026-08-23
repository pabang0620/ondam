import { useState, useCallback, useMemo } from 'react'

/**
 * 카드형 동의 체크리스트 상태 훅 - WillConsentPage/GiftPerformWillPage/
 * PhotoOrderPage/GiftPerformPhotoPage 4개 화면이 공통으로 쓴다.
 * @param {Array<{ key: string }>} items - consentItems.js의 WILL_CONSENT_ITEMS 등
 */
export function useConsentChecklist(items) {
  const initial = useMemo(
    () => items.reduce((acc, item) => ({ ...acc, [item.key]: false }), {}),
    [items],
  )
  const [consents, setConsents] = useState(initial)

  const allChecked = items.every((item) => consents[item.key])

  const toggleItem = useCallback((key) => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const toggleAll = useCallback(() => {
    setConsents((prev) => {
      const next = !items.every((item) => prev[item.key])
      return items.reduce((acc, item) => ({ ...acc, [item.key]: next }), {})
    })
  }, [items])

  return { consents, allChecked, toggleItem, toggleAll }
}
