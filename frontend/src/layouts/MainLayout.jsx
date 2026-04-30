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
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
