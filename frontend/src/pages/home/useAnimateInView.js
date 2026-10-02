import { useEffect, useRef, useState } from 'react'

// 장식용 CSS 애니메이션 전용 훅 - 요소가 화면에 보이고(enabled) 활성일 때만
// true를 돌려준다. 호출부는 true일 때 `is-animating` 클래스를 붙인다.
// enabled가 false이면 IntersectionObserver를 만들지 않고 visible을 false로 초기화한다
// (같은 값 setState는 React가 무시하므로 불필요한 리렌더 없음).
// enabled가 true인 동안에만 observe 하며, effect 정리(enabled 전환/언마운트/
// StrictMode 재마운트) 시 항상 disconnect 한다.
export default function useAnimateInView(enabled = true) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setVisible(false)
      return undefined
    }
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled])

  return [ref, visible && enabled]
}
