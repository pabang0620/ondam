import { Outlet } from 'react-router-dom'
import Header from '../components/common/Header.jsx'
import Footer from '../components/common/Footer.jsx'

export default function MainLayout() {
  return (
    <div
      className="flex flex-col min-h-screen"
      style={{
        backgroundColor: 'var(--color-bg)',
        // overflow-x: hidden이 아닌 clip 사용 - hidden은 overflow-y(기본 visible)를
        // auto로 강제 승격시켜 이 div를 스크롤 컨테이너로 만들고, 그러면 내부의
        // position: sticky 자식이 이 div 기준으로 고정되는데 이 div는 실제로
        // 스크롤하지 않아(내용 높이에 맞춰 늘어남) sticky가 동작하지 않는다.
        // clip은 스크롤 컨테이너를 만들지 않으면서 가로 넘침 차단 목적은 동일하다.
        overflowX: 'clip',
      }}
    >
      <Header />
      <main
        className="flex-1 w-full"
        style={{
          // 위와 동일한 이유로 hidden 대신 clip - sticky 상품 섹션이 main 내부에
          // 위치할 예정이라 main이 스크롤 컨테이너로 승격되면 sticky가 깨진다.
          overflowX: 'clip',
          // Header가 position: fixed로 문서 흐름에서 빠지면서 생기는 상단 공백을
          // 보정한다. 이 패딩이 없으면 모든 페이지의 콘텐츠 상단이 fixed 헤더에
          // 가려진다. 히어로가 헤더와 의도적으로 겹쳐야 하는 홈 페이지만
          // HomePage.jsx에서 이만큼을 음수 마진으로 다시 되돌린다(다른 페이지의
          // 기존 배치는 이 패딩으로 그대로 보존된다).
          paddingTop: 'var(--header-height)',
        }}
      >
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
