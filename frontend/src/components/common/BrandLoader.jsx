import { useEffect, useRef, useState } from 'react'
import './BrandLoader.css'

/*
 * BrandLoader - 온담 브랜드 로딩 애니메이션.
 *
 * 재생 순서(각 단계 지속 시간은 아래 PHASE_DURATION_MS 참고):
 *   1. smile      - "ON:DAM" 중 ':D'만 90deg 회전된 채로 먼저 등장(웃는 얼굴 모양)
 *   2. unrotate   - ':D'가 회전값 0(정상 방향)으로 바운스감 있게 복귀
 *   3. letters    - 'ON'(왼쪽)/'AM'(오른쪽)이 통통 튀며 등장해 "ON:DAM" 완성
 *   4. hold       - "ON:DAM" 전체를 잠시 유지
 *   5. korean     - "ON:DAM"이 팝아웃되며 "온담"이 팝인(바운스)으로 교체
 *   6. koreanHold - "온담" 유지 후 다시 1번부터 반복(로딩이 길어질 경우 대비)
 *
 * Suspense fallback 등 로딩 지속 시간을 예측할 수 없는 위치에서 쓰이므로
 * 한 사이클이 끝나면 처음부터 다시 재생한다(무한 루프).
 */

const PHASE_DURATION_MS = {
  smile: 700,
  unrotate: 550,
  letters: 450,
  hold: 750,
  korean: 700,
  koreanHold: 1800,
}

const PHASE_ORDER = ['smile', 'unrotate', 'letters', 'hold', 'korean', 'koreanHold']

function getPrefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function BrandLoader() {
  // 모션 민감 사용자는 단계 재생 없이 바로 최종 상태("온담")로 시작한다.
  // (BrandLoader.css의 prefers-reduced-motion 미디어쿼리와 함께 이중으로 보장)
  const [prefersReducedMotion] = useState(getPrefersReducedMotion)
  const [phase, setPhase] = useState(() =>
    prefersReducedMotion ? 'koreanHold' : PHASE_ORDER[0]
  )
  const [cycle, setCycle] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion) {
      return undefined
    }

    const currentIndex = PHASE_ORDER.indexOf(phase)

    timerRef.current = setTimeout(() => {
      const nextIndex = (currentIndex + 1) % PHASE_ORDER.length
      if (nextIndex === 0) {
        // 한 사이클이 끝나고 다시 처음(smile)으로 돌아갈 때 key를 바꿔
        // CSS 애니메이션/트랜지션이 처음부터 다시 트리거되도록 한다.
        setCycle((prev) => prev + 1)
      }
      setPhase(PHASE_ORDER[nextIndex])
    }, PHASE_DURATION_MS[phase])

    return () => {
      clearTimeout(timerRef.current)
    }
  }, [phase, prefersReducedMotion])

  const phaseIndex = PHASE_ORDER.indexOf(phase)
  const hasReachedPhase = (target) => phaseIndex >= PHASE_ORDER.indexOf(target)
  const isKoreanPhase = phase === 'korean' || phase === 'koreanHold'

  return (
    <div className="brand-loader" role="status" aria-live="polite" aria-label="로딩 중">
      <div className="brand-loader__stage" key={cycle}>
        <div
          className={`brand-loader__en${isKoreanPhase ? ' brand-loader__en--popout' : ''}`}
          aria-hidden="true"
        >
          <span
            className={`brand-loader__part brand-loader__part--on${
              hasReachedPhase('letters') ? ' brand-loader__part--visible' : ''
            }`}
          >
            ON
          </span>
          <span
            className={`brand-loader__smiley${
              hasReachedPhase('unrotate') ? ' brand-loader__smiley--unrotated' : ''
            }`}
          >
            :D
          </span>
          <span
            className={`brand-loader__part brand-loader__part--am${
              hasReachedPhase('letters') ? ' brand-loader__part--visible' : ''
            }`}
          >
            AM
          </span>
        </div>

        <div
          className={`brand-loader__ko${isKoreanPhase ? ' brand-loader__ko--popin' : ''}`}
          aria-hidden="true"
        >
          온담
        </div>
      </div>

      <span className="brand-loader__sr-only">로딩 중입니다</span>
    </div>
  )
}
