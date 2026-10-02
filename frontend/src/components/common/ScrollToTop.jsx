import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

// 라우트(pathname) 변경 시 스크롤을 맨 위로 올린다.
// - query만 바뀌는 경우(?page=2 등)는 pathname이 같으므로 건드리지 않는다.
// - #hash가 있으면 해당 요소로 이동하고, 요소가 없으면 기본 동작에 맡긴다.
// - behavior: 'instant'로 전역 smooth 스크롤 설정이 있어도 애니메이션 없이 즉시 이동한다.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useLayoutEffect(() => {
    if (hash) {
      let id = hash.slice(1)
      try {
        id = decodeURIComponent(id)
      } catch {
        // 잘못된 인코딩이면 원문 그대로 사용한다.
      }
      const target = document.getElementById(id)
      if (target) target.scrollIntoView()
      return
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    // hash 변경만으로는 재실행하지 않는다(같은 페이지 내 앵커 이동은 브라우저 기본 동작).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
