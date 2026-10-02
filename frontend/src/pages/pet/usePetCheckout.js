import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePetSubscription } from './usePetSubscription.js'
import { ARCHIVE_PLAN } from './subscriptionLabels.js'
import { ROUTES } from '../../constants/routes.js'
import { useAuthStore } from '../../store/authStore.js'

// 구독하기(토스 카드 등록 이동) 시작 전용 훅.
// - usePetSubscription 인스턴스를 하나만 쓰고, 조회는 하지 않는다
//   (skipInitialFetch: true → GET 0건, refreshAfterAction: false → 사후 재조회 없음).
// - 구독 상태 표시용 LiveSubscription 의 인스턴스와는 화면에 동시에 나오지 않으므로
//   두 인스턴스가 서로의 상태를 어긋나게 할 일이 없다.
// - canSubscribe 는 호출 측이 "무료 확정" 일 때만 true 로 준다(이중 가입 사전 차단).
export function usePetCheckout({ canSubscribe }) {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { handleSubscribe, isRedirecting, actionError } = usePetSubscription({
    skipInitialFetch: true,
    refreshAfterAction: false,
  })
  // 연타 방지 동기 락(state 는 비동기라 같은 렌더에서 두 번 통과할 수 있다).
  const pendingRef = useRef(false)

  const start = async (planKey) => {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN)
      return
    }
    if (planKey !== ARCHIVE_PLAN) return
    if (!canSubscribe) return
    if (pendingRef.current) return
    pendingRef.current = true
    try {
      await handleSubscribe(planKey)
    } finally {
      pendingRef.current = false
    }
  }

  return { start, isRedirecting, error: actionError }
}
