import { Outlet } from 'react-router-dom'
import Header from '../components/common/Header.jsx'
import Footer from '../components/common/Footer.jsx'

export default function MainLayout() {
  return (
    <div
      className="flex flex-col min-h-screen"
      style={{
        backgroundColor: 'var(--color-bg)',
        // hidden은 스크롤 컨테이너를 만들어 하위 position: sticky를 깨뜨린다 - clip은 그렇지 않다
        overflowX: 'clip',
      }}
    >
      <Header />
      <main
        className="flex-1 w-full"
        style={{ overflowX: 'clip' }}
      >
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
