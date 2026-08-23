import { useState, useEffect, useCallback } from 'react'
import { memorialApi } from './memorialApi.js'

// FIX: DEV-30 - 이전에는 accessCode를 전혀 받지도, API로 보내지도 않았다. 백엔드가
// "접근 코드 없으면 비공개(404), 틀리면 403"으로 확정했기 때문에, 이 훅이 accessCode를
// 넘기지 않는 한 정상적인 코드를 가진 방문자도 항상 실패했다(추모 페이지 전면 404).
// initialAccessCode는 링크의 ?accessCode= 쿼리에서 오고, retryWithAccessCode는 링크 없이
// 코드만 아는 방문자가 수동으로 입력했을 때 재조회하는 용도다.
export function useMemorial(slug, initialAccessCode) {
  const [pet, setPet] = useState(null)
  const [media, setMedia] = useState([])
  // FIX: DEV-31 - 초기값이 false면 마운트 직후(effect 실행 전) 첫 페인트에서
  // MemorialPage의 `error || !pet` 분기가 먼저 걸려 "찾을 수 없습니다" + 접근 코드
  // 입력 폼이 한 프레임 번쩍인다. 첫 조회는 항상 진행 중이므로 true로 시작한다.
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // FIX: 결함4 - signal 미전달로 abort()가 무효했던 문제 수정
  const fetchMemorial = useCallback(async (accessCode, signal) => {
    // slug가 없으면 조회 자체가 불가능하다 - 초기값이 true이므로 여기서 내려주지
    // 않으면 "불러오는 중..."에서 영원히 멈춘다.
    if (!slug) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await memorialApi.getMemorial(slug, accessCode, signal)
      if (data.success) {
        setPet(data.data.pet)
        setMedia(data.data.media ?? [])
      }
    } catch (err) {
      if (err.name === 'CanceledError') return
      // FIX: DEV-24 - 추모 페이지 조회 실패를 가짜 고인 데이터로 위장하지 않는다
      setError(err?.response?.data?.message ?? '추모 페이지를 찾을 수 없습니다.')
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    const ac = new AbortController()
    fetchMemorial(initialAccessCode, ac.signal)
    return () => ac.abort()
    // initialAccessCode는 URL 쿼리에서 오는 마운트 시점 값이라 매 렌더 재실행할 필요가
    // 없다 - 재시도는 retryWithAccessCode를 통해 사용자 액션으로만 트리거한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchMemorial])

  return { pet, media, isLoading, error, retryWithAccessCode: fetchMemorial }
}
