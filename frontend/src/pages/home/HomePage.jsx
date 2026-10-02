import HomeHero from './HomeHero.jsx'
import HomeServices from './HomeServices.jsx'
import HomeProcess from './HomeProcess.jsx'
import HomeTrust from './HomeTrust.jsx'
import HomeBottomCta from './HomeBottomCta.jsx'

// DEV-13: 랜딩 섹션 구성 (위→아래)
// 1. Hero (태그라인·주/부 CTA)
// 2. 상품 3종 - 가격 전면 공개
// 3. 제작 과정 안내 - 실물 전후비교 자산 없음, 텍스트로 대체(플레이스홀더)
// 4. 정직과 신뢰 - 03/07 문서 확정 문구
// 5. 하단 CTA (사진관 재유도)
//
// 홈 전용 컬러 팔레트(리디자인, 2026-09):
// - 레이아웃 참고: MiriCanvas "AI 흑백사진 컬러화" 랜딩(중앙 정렬 히어로 + 단일
//   강한 CTA + 히어로 직후 큰 비주얼 앵커)
// - 색상 참고: 핀터레스트 레퍼런스(오렌지→코랄 그라디언트 3D 캐릭터 랜딩)의
//   색감을 홈 전체에 반영(2026-09, 딥 코랄 로즈로 확정). 그린 → 하늘색 → 모카
//   브라운을 거쳐 이번에 최종 확정했다.
// 전역 --color-primary(다크 차콜)는 추모관/유언장/사진관/반려동물 등 다른 도메인의
// 고유 accent 체계(각자 네이비/베이지/차콜/테라코타)에 영향을 주므로 절대 건드리지
// 않는다. 대신 이 최상위 wrapper에만 유효한 홈 스코프 커스텀 프로퍼티를 정의하고,
// 하위 섹션들은 항상 var(--home-color-*)로만 참조한다(전역 토큰 미변경).
//
// 중요(대비 회귀 방지 - 과거 2번 발생 전례): 핀터레스트 레퍼런스 원색 자체
// (오렌지 #F5A052, 코랄 #E23E57)는 흰 배경(#FFFFFF) 대비 각각 2.093:1, 4.150:1로
// WCAG AA 본문 기준(4.5:1) 미달이라 텍스트·아이콘 단색으로 쓸 수 없다. 그래서
// "텍스트용 단색(어둡게 눌러 대비 확보)"과 "장식/그라디언트용(레퍼런스 원색 그대로)"
// 을 토큰 레벨에서 완전히 분리했다 - 장식 전용 토큰(primary-light/accent/
// gradient-decor)은 절대 텍스트·얇은 보더에 사용하지 않는다.
// 아래 실측값은 모두 scratchpad/contrast.js(WCAG 2.x 상대휘도 공식, 세션 임시
// 스크립트, 리포 미포함)로 직접 계산했다.
const HOME_THEME_VARS = {
  // 딥 코랄 로즈(2026-09 확정) - HomeProcess.jsx/HomeServices.jsx/HomeTrust.jsx/
  // HomeBottomCta.jsx에서 텍스트·아이콘 단색 전용으로 쓰인다. worst case는
  // HomeProcess.jsx의 "STEP N" 텍스트가 얹히는 --color-bg-alt(#E8E8ED, 3개 배경
  // 중 가장 어두움)이며, 그 경우에도 여유 마진을 확보하도록 실측 후 채택했다.
  //   #A8324A vs #FFFFFF(--color-surface) → 6.522:1
  //   #A8324A vs #FFFFFF(--color-bg, 2026-10 흰색으로 변경) → 6.522:1
  //   (구 회색 #F5F5F7(--color-bg-subtle) 위에서는 5.989:1)
  //   #A8324A vs #E8E8ED(--color-bg-alt, worst case) → 5.340:1
  // 세 경우 모두 AA 4.5:1을 여유 있게 통과한다.
  '--home-color-primary': '#A8324A',
  // 레퍼런스 오렌지 원색 그대로 - 장식/면적 채색 전용(위 사유로 텍스트·얇은 보더
  // 금지, 흰 배경 대비 2.093:1로 AA 미달). HomeHero.jsx DecorativeCircle 등
  // var(--home-gradient-decor)의 시작 stop으로만 쓰인다.
  '--home-color-primary-light': '#F5A052',
  // 신규: 레퍼런스 오렌지~코랄 사이 중간톤 - 비텍스트 보더/구분선 전용(WCAG
  // 1.4.11 non-text 기준 3:1). 흰 배경(#FFFFFF, 페이지 배경과 동일)·구 회색(#F5F5F7,
  // --color-bg-subtle) 양쪽 모두 대비를 실측했다: #C24A44 vs #FFFFFF → 4.820:1,
  // vs #F5F5F7 → 4.427:1(둘 다
  // 3:1 기준을 여유 있게 통과). HomeHero.jsx 배지 보더가 이 토큰을 쓴다(기존
  // primary-light 보더는 대비 미달이라 교체).
  '--home-color-primary-mid': '#C24A44',
  // 연한 피치 틴트 - 배경 틴트 전용(카드/타일 배경색으로만 쓰이므로 자체 대비
  // 기준은 미적용이나, 위에 얹히는 primary 텍스트/아이콘과는 5.629:1로 별도
  // 문제 없음을 확인했다).
  '--home-color-primary-soft': '#FDEBDF',
  // 화이트 유지 - 배지·비강조 CTA 배경 등 소면적 포인트 강조 전용.
  // 위에는 반드시 어두운 텍스트(var(--color-text-primary))만 사용한다.
  '--home-color-secondary': '#FFFFFF',
  // 연한 파스텔 핑크 틴트(레퍼런스 톤) - 배경 틴트 전용.
  '--home-color-secondary-soft': '#FBDCE3',
  // 레퍼런스 코랄 원색 그대로 - 장식 전용(작은 점 등, 흰 배경 대비 4.150:1로
  // AA 4.5:1에 근소하게 미달이라 텍스트 사용 금지). HomeProcess.jsx 상단 바
  // 장식 점 등 순수 장식 요소에만 쓰인다.
  '--home-color-accent': '#E23E57',
  // 신규: 장식 전용 그라디언트(레퍼런스 원색 그대로, 텍스트 얹기 절대 금지).
  // HomeHero.jsx DecorativeCircle, HomeProcess.jsx 프로그레스 바 fill 등에 쓰인다.
  '--home-gradient-decor': 'linear-gradient(135deg, #F5A052 0%, #E23E57 100%)',
  // 신규: 흰 텍스트를 얹는 CTA 버튼 전용 - 레퍼런스 오렌지/코랄보다 각각 더 어둡게
  // 눌러 흰 텍스트가 그라디언트 양 끝 어디서 읽혀도 AA 4.5:1을 넘도록 실측했다:
  //   흰색 vs 시작(#B8471F) → 5.304:1, 흰색 vs 끝(#96253F) → 7.975:1
  // (17px semibold 버튼 텍스트는 WCAG large text 기준(3:1)에 못 미쳐 일반 텍스트
  // 기준 4.5:1을 적용했다.)
  '--home-gradient-cta': 'linear-gradient(135deg, #B8471F 0%, #96253F 100%)',
}

// 페이지 전역 배경 장식 - 파스텔 블롭 3개(좌상단 라벤더, 우상단 살구색, 중앙
// 핑크)를 콘텐츠 뒤(z-index -1)에 깔아 단색 흰 배경(--color-bg #FFFFFF) 위에 은은한
// 입체감을 더한다. 순수 장식 레이어라 클릭/포커스에 전혀 관여하지 않는다
// (pointer-events: none + aria-hidden). 색상은 HomeBottomCta.jsx의
// CTA_PASTEL_BG(피치 #FDE6D8 / 핑크 #FBDCE3 / 라벤더 #DDE0F7) 톤과 계열을
// 맞췄다.
function HomeBackgroundBlobs() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: 'hidden', zIndex: -1 }}
    >
      {/* 좌상단 라벤더 블롭 */}
      <div
        className="absolute rounded-full"
        style={{
          top: '-120px',
          left: '-100px',
          width: 'clamp(260px, 30vw, 420px)',
          height: 'clamp(260px, 30vw, 420px)',
          backgroundColor: '#DDE0F7',
          opacity: 0.5,
          filter: 'blur(60px)',
        }}
      />
      {/* 우상단 살구색 블롭 */}
      <div
        className="absolute rounded-full"
        style={{
          top: '-80px',
          right: '-120px',
          width: 'clamp(260px, 30vw, 420px)',
          height: 'clamp(260px, 30vw, 420px)',
          backgroundColor: '#FDE6D8',
          opacity: 0.5,
          filter: 'blur(60px)',
        }}
      />
      {/* 핑크 블롭 */}
      <div
        className="absolute rounded-full"
        style={{
          top: '640px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'clamp(280px, 32vw, 440px)',
          height: 'clamp(280px, 32vw, 440px)',
          backgroundColor: '#FBDCE3',
          opacity: 0.45,
          filter: 'blur(70px)',
        }}
      />
    </div>
  )
}

export default function HomePage() {
  return (
    <div
      className="relative"
      style={{
        backgroundColor: 'var(--color-bg)',
        maxWidth: '100vw',
        // overflow-x: hidden이 아닌 clip 사용 - hidden은 overflow-y(기본 visible)를
        // auto로 강제 승격시켜 이 div를 스크롤 컨테이너로 만들고, sticky-scrollytelling
        // 패턴으로 구현된 HomeServices의 position: sticky가 이 div 기준으로
        // 고정되어 버려(그런데 이 div는 실제로 스크롤하지 않음) 항상 오프셋 0으로
        // 깨진다. clip은 스크롤 컨테이너를 만들지 않으면서 가로 넘침 차단 목적은
        // 동일하게 유지한다.
        overflowX: 'clip',
        // 히어로 풀블리드 오버랩: MainLayout.jsx의 <main>이 fixed 헤더를 보정하기
        // 위해 모든 페이지에 paddingTop: var(--header-height)를 두는데, 랜딩
        // 히어로(HomeHero, 바로 아래)만은 뷰포트 최상단(top: 0)부터 시작해 fixed
        // 헤더 밑으로 겹쳐 보여야 하므로 그 패딩을 이 음수 마진으로 되돌린다.
        // 히어로 안쪽 콘텐츠(배지/헤드라인)는 자체 pt-16 이상 패딩으로 이미
        // header-height(64px) 이상 확보되어 있어 헤더에 가려지지 않는다. 이
        // 페이지 아래의 다른 섹션(HomeServices 등)은 이 마진만큼만 함께
        // 올라오므로 전체 배치는 기존과 동일하게 유지된다.
        marginTop: 'calc(var(--header-height) * -1)',
        ...HOME_THEME_VARS,
      }}
    >
      <HomeBackgroundBlobs />
      <HomeHero />
      <HomeServices />
      <HomeProcess />
      <HomeTrust />
      <HomeBottomCta />
    </div>
  )
}
