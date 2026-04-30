import { Outlet } from 'react-router-dom'
import Header from '../components/common/Header.jsx'
import Footer from '../components/common/Footer.jsx'

export default function MainLayout() {
  return (
    <div
      className="flex flex-col min-h-screen"
      style={{
        backgroundColor: 'var(--color-bg)',
        overflowX: 'hidden',
      }}
    >
      <Header />
      <main
        className="flex-1 w-full"
        style={{ overflowX: 'hidden' }}
      >
        {/* 최대 너비 1200px, 수평 중앙 정렬 — 모든 페이지 콘텐츠가 중앙에 위치 */}
        <div
          style={{
            maxWidth: '1200px',
            marginLeft: 'auto',
            marginRight: 'auto',
            width: '100%',
            paddingLeft: 'clamp(16px, 4vw, 32px)',
            paddingRight: 'clamp(16px, 4vw, 32px)',
          }}
        >
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  )
}
