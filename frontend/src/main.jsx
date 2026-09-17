import './styles/global.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// [DESIGN-PREVIEW] 로컬 백엔드 없이 디자인 검토를 위한 MSW 워커.
// import.meta.env.DEV 체크로 프로덕션 빌드에는 이 분기와 ./mocks/browser.js가
// 트리쉐이킹되어 빠진다 (Vite 표준 패턴). onUnhandledRequest: 'bypass'로 아직
// mock되지 않은 엔드포인트는 실제 네트워크로 통과시켜 기존 에러 핸들링 경로를 보존한다.
// [DESIGN-PREVIEW] 서비스워커 등록/활성화가 지연되거나 끝나지 않는 경우
// 앱 전체가 무한정 빈 화면으로 남는 것을 막기 위해 4초 타임아웃을 둔다.
// worker.start()가 타임아웃되거나 reject되어도 렌더링은 항상 진행되어야 한다.
async function enableMocking() {
  if (!import.meta.env.DEV) return
  try {
    const { worker } = await import('./mocks/browser.js')
    const MOCK_START_TIMEOUT_MS = 4000
    await Promise.race([
      worker.start({ onUnhandledRequest: 'bypass' }),
      new Promise((resolve) => setTimeout(resolve, MOCK_START_TIMEOUT_MS)),
    ])
  } catch {
    // mock 초기화 실패는 무시하고 렌더링을 계속 진행한다.
  }
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
