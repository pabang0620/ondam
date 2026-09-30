import { Link } from 'react-router-dom'
import { CheckCircle2, Cloud, Sparkles } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'

/*
 * 히어로 비주얼 - Behance "FRESHCODE App Renewal" 레퍼런스의 구성(강한 배경 위
 * 아이폰 목업 2개가 원근감 있게 기울어져 있는 레이아웃)을 온담 버전으로 번역한다:
 *   - 왼쪽 폰: 빛바랜 옛날 사진(그레이스케일 필터) + "원본" 라벨
 *   - 오른쪽 폰: AI로 복원된 선명한 컬러 사진 + "복원 완료" 라벨. 두 폰은 서로
 *     겹치지 않게 가로로 간격을 두고, 세로로만 살짝 엇갈려 나란히 서 있다.
 *   - 폰 프레임(라운드 사각형·다이나믹 아일랜드·볼륨버튼)은 이미지 자산 없이 전부
 *     순수 CSS(div + border-radius)로 그린다. 입체감은 부모에 perspective를 주고
 *     각 폰에 rotateY/rotateX(원근 틸트) + rotate(기존 Z축 기울기)를 함께 적용해
 *     "화면 안쪽으로 기운" 3D처럼 보이게 한다(평면 rotate만 쓰던 이전 버전과 차이).
 * 두 폰 화면에 쓰는 사진은 같은 Unsplash License(상업적 사용 자유, 저작자 표시
 * 불필요) 인물 사진 1장을 재사용한다(왼쪽엔 grayscale 필터로 "복원 전", 오른쪽엔
 * 필터 없이 "복원 후"). 밝게 웃는 동양인 여성 인물 사진. 출처: Unsplash License,
 * 사진: Vitaly Gariev (@silverkblack), images.unsplash.com/photo-1758600587815-b654d1405e83
 * (이 프로젝트 HomeLatestCarousel.jsx에서 같은 작가의 다른 사진을 이미 사용 중).
 * 다른 홈 섹션(HomeLatestCarousel.jsx)처럼 자체 호스팅하지 않고 CDN을 그대로
 * hotlink하는 이유: 이 섹션 전용 1회성 대형 비주얼이라 별도 바이너리 자산을 리포에
 * 추가하지 않기 위함이다(동시 작업 중인 다른 에이전트와의 파일 충돌도 피한다).
 *
 * 배경(2026-09 "바랜 종이" 리디자인): 히어로/하단 CTA가 공유하던
 * var(--home-color-primary)(밝은 하늘색)를 이 파일 범위에서만 따뜻한 베이지 계열로
 * 직접 교체했다. HomeProcess.jsx/HomeServices.jsx/HomeTrust.jsx는 흰 배경 위
 * 아이콘·텍스트 색으로 이 토큰을 그대로 참조하므로, 토큰 자체(HomePage.jsx)는
 * 절대 건드리지 않고 HERO_BEIGE_BG처럼 이 파일에 로컬로 리터럴 값을 정의한다
 * (하단 CTA도 동일한 톤을 BottomCta 파일 자체에 별도로 정의).
 *   - 베이스: linear-gradient(135deg, #EFE6D3 0%, #E3D5B8 100%) (따뜻한 베이지 2톤)
 *   - 오버레이: 옅은 갈색 방사형 얼룩 + 상단 크림 하이라이트를 겹쳐 "바랜 종이"
 *     질감을 더한다(아래 오버레이 div 참고).
 * 대비 실측(WCAG 상대휘도 공식, 배경 두 톤 중 더 어두운 #E3D5B8 기준 = worst case):
 *   - 헤드라인(h1): var(--color-text-primary) #1D1D1F → 대비 약 11.60:1
 *     (밝은 쪽 #EFE6D3 기준으로는 약 13.57:1). AA 본문 기준(4.5:1) 여유 있게 통과.
 *   - 서브카피(p): rgba(29,29,31,0.8)를 배경과 합성한 실효색(#45423e) 기준 대비 약
 *     6.89:1(밝은 쪽 기준 약 7.69:1). AA 통과.
 * 장식용 구름은 흰색 반투명 대신 크림/황토 톤 반투명(HeroCloud 참고)으로 바꿔 베이지
 * 배경 위에서도 "바랜 종이" 느낌으로 자연스럽게 녹아들도록 조정했다.
 *
 * 레이아웃(2026-09): 기존에는 텍스트 블록(중앙정렬)이 위, 폰 목업 2개가 그 아래
 * 세로로 쌓인 1단 구성이었다. 이번에 좌(폰)-우(텍스트) 2단 그리드로 재구성했다
 * (lg 이상: grid-cols-2, 왼쪽 컬럼 = 폰 스테이지, 오른쪽 컬럼 = 텍스트 좌측정렬).
 * 폰 스테이지의 perspective/preserve-3d 및 각 폰의 rotateY/rotateX/rotate/translate
 * 값은 기존 그대로 재사용하고, 스테이지 컨테이너 크기(max-w/h)만 왼쪽 컬럼 폭에
 * 맞게 축소했다. lg 미만(모바일/태블릿)에서는 DOM 순서대로 텍스트 → 폰 순서로
 * 세로 스택된다(가독성상 텍스트를 먼저 노출).
 */
const HERO_PHOTO_URL = 'https://images.unsplash.com/photo-1758600587815-b654d1405e83?auto=format&fit=crop&w=1600&q=80'

// 히어로 섹션 전용 "바랜 종이" 베이지 배경. 홈 공유 토큰(--home-color-primary)은
// 다른 섹션(흰 배경 위 아이콘·텍스트)에서 그대로 쓰이므로 절대 변경하지 않고,
// 이 파일 범위에서만 리터럴 값으로 배경을 정의한다.
const HERO_BEIGE_BG = 'linear-gradient(135deg, #EFE6D3 0%, #E3D5B8 100%)'

/*
 * 순수 CSS 아이폰 프레임 목업. 이미지 자산(PNG 등) 없이 div만으로 검은 라운드
 * 프레임 + 상단 다이나믹 아일랜드 + 좌측 볼륨버튼 + 우측 전원버튼을 그리고, 그
 * 안에 실제 사진을 objectFit: cover로 채운다.
 */
function PhoneMockup({ widthClass, translate, rotate, rotateX, rotateY, zIndex, photoFilter, photoAlt, label, LabelIcon, labelTone }) {
  return (
    <div
      className={`absolute top-1/2 left-1/2 ${widthClass}`}
      style={{
        aspectRatio: '9 / 19.5',
        // translate로 위치를 잡은 뒤(원근 왜곡 전) rotateY/rotateX로 화면 안쪽으로
        // 기울여 입체감을 주고, 마지막에 기존 Z축 rotate를 더해 비스듬히 기울어진
        // 레퍼런스 구도를 유지한다. backfaceVisibility로 뒷면이 뒤집혀 보이는 것을 막는다.
        transform: `${translate} rotateY(${rotateY}deg) rotateX(${rotateX}deg) rotate(${rotate}deg)`,
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'hidden',
        zIndex,
      }}
    >
      <div
        className="relative w-full h-full"
        style={{
          borderRadius: 'clamp(24px, 8vw, 38px)',
          backgroundColor: '#0B0B0C',
          padding: 'clamp(6px, 1.6vw, 10px)',
          boxShadow: '0 34px 70px rgba(0,0,0,0.42), 0 12px 26px rgba(0,0,0,0.28)',
        }}
      >
        {/* 좌측 볼륨버튼 2개 + 무음 스위치 */}
        <div aria-hidden="true" className="absolute" style={{ left: '-2px', top: '16%', width: '3px', height: '6%', borderRadius: '2px', backgroundColor: '#0B0B0C' }} />
        <div aria-hidden="true" className="absolute" style={{ left: '-2px', top: '25%', width: '3px', height: '9%', borderRadius: '2px', backgroundColor: '#0B0B0C' }} />
        <div aria-hidden="true" className="absolute" style={{ left: '-2px', top: '37%', width: '3px', height: '9%', borderRadius: '2px', backgroundColor: '#0B0B0C' }} />
        {/* 우측 전원버튼 */}
        <div aria-hidden="true" className="absolute" style={{ right: '-2px', top: '22%', width: '3px', height: '13%', borderRadius: '2px', backgroundColor: '#0B0B0C' }} />

        <div
          className="relative w-full h-full overflow-hidden"
          style={{ borderRadius: 'clamp(18px, 6vw, 30px)', backgroundColor: '#000' }}
        >
          <img
            src={HERO_PHOTO_URL}
            alt={photoAlt}
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover', objectPosition: 'center 22%', filter: photoFilter }}
          />

          {/* 다이나믹 아일랜드 */}
          <div
            aria-hidden="true"
            className="absolute"
            style={{
              top: '3%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '34%',
              height: '3.5%',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: '#000',
            }}
          />

          {/* 앱 UI 느낌의 라벨 칩 */}
          <div
            className="absolute inline-flex items-center gap-1 font-bold whitespace-nowrap"
            style={{
              top: '9%',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: labelTone === 'before' ? 'rgba(0,0,0,0.72)' : 'var(--home-color-secondary)',
              color: labelTone === 'before' ? '#FFFFFF' : 'var(--color-text-primary)',
              // FIX: 11px → 16px(어르신 UX 하한선)
              fontSize: 'var(--fs-body)',
            }}
          >
            {LabelIcon ? <LabelIcon size={16} aria-hidden="true" /> : null}
            {label}
          </div>
        </div>
      </div>
    </div>
  )
}

/*
 * 장식용 구름 아이콘. 겹친 원(div) 조합으로 직접 그리던 이전 버전이 "구름처럼
 * 안 보인다"는 피드백을 받아 완전히 갈아엎고, lucide-react가 제공하는 진짜
 * Cloud 아이콘(SVG)으로 교체했다. 얇은 stroke + 옅은 fill을 함께 줘서 은은하게
 * "덩어리진" 구름 느낌을 내고, 크기는 clamp()로 반응형 지정한다(lucide의
 * size prop은 숫자만 받으므로 width/height 인라인 스타일로 대체).
 * 색상(2026-09 베이지 리디자인): 배경이 흰색 계열이 아닌 따뜻한 베이지로 바뀌며
 * 순백색 반투명은 "흰 얼룩"처럼 붕 떠 보이므로, 크림(fill)·옅은 황토(stroke) 톤의
 * 반투명으로 바꿔 "바랜 종이" 위 얼룩처럼 배경에 자연스럽게 녹아들게 했다.
 */
function HeroCloud({ className = '', style, fillOpacity, strokeOpacity }) {
  return (
    <Cloud
      aria-hidden="true"
      className={className}
      strokeWidth={1}
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        height: 'auto',
        fill: `rgba(250,240,220,${fillOpacity})`,
        stroke: `rgba(196,164,120,${strokeOpacity})`,
        ...style,
      }}
    />
  )
}

export default function HomeHero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: HERO_BEIGE_BG }}
    >
      {/* "바랜 종이" 질감 오버레이 - 옅은 갈색 방사형 얼룩(좌상단) + 상단 크림
          하이라이트를 겹쳐, 단색 그라디언트보다 얼룩덜룩한 종이 느낌을 더한다. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 30% 20%, rgba(168,138,90,0.10), transparent 60%), ' +
            'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.18) 0%, transparent 55%)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      {/*
        장식용 구름 레이어 - 텍스트/폰 목업보다 먼저 DOM에 위치하고(같은 relative
        섹션 안에서 z-index를 지정하지 않은 절대배치 요소는 DOM 순서대로 쌓이므로)
        추가로 zIndex: 0을 명시해 항상 배경 레이어로 고정한다. 순수 장식이라
        pointer-events: none + aria-hidden="true"로 완전히 격리한다.
      */}
      <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0, pointerEvents: 'none' }} aria-hidden="true">
        {/* 좌상단 큰 구름 - 큰 화면에서만 노출 */}
        <HeroCloud
          className="hidden sm:block"
          style={{ top: '7%', left: '-4%', width: 'clamp(150px, 20vw, 260px)' }}
          fillOpacity={0.4}
          strokeOpacity={0.55}
        />
        {/* 우측 중단 작은 구름 - 모바일에서도 은은하게 노출 */}
        <HeroCloud
          style={{ top: '30%', right: '3%', width: 'clamp(72px, 11vw, 130px)' }}
          fillOpacity={0.35}
          strokeOpacity={0.5}
        />
        {/* 하단 흐릿한 구름 - 큰 화면에서만 노출. 2단 레이아웃으로 바뀌며 텍스트
            컬럼과 겹치지 않도록 좌측 하단으로 위치를 옮겼다. */}
        <HeroCloud
          className="hidden sm:block"
          style={{ bottom: '4%', left: '4%', width: 'clamp(170px, 22vw, 300px)' }}
          fillOpacity={0.25}
          strokeOpacity={0.4}
        />
      </div>

      {/*
        좌(폰 목업)-우(텍스트) 2단 그리드(FRESHCODE 레퍼런스의 "강한 비주얼 +
        카피" 좌우 배치를 온담 버전으로 번역, 상세는 파일 상단 주석 참고).
        lg 미만에서는 1열로 전환되며, DOM 순서(텍스트 → 폰)를 그대로 따라 텍스트가
        먼저, 폰 비주얼이 아래에 온다(order 유틸리티로 lg 이상에서만 좌우를 바꾼다).
      */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-16 sm:pt-20 lg:pt-28 pb-20 sm:pb-24 lg:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-10 lg:gap-12">
          {/* 텍스트 블록 - 모바일/태블릿: 위(order-1) + 중앙정렬, 데스크톱: 오른쪽
              컬럼(lg:order-2) + 좌측정렬(일반적인 좌우 2단 히어로 관례) */}
          <div className="order-1 lg:order-2 text-center lg:text-left">
            <span
              className="inline-flex items-center gap-1.5 mb-5"
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--home-color-secondary)',
                // 베이지 배경 위에서 흰 배지가 묻히지 않도록 홈 팔레트 비비드
                // 톤(primary-light)으로 얇은 테두리를 둘러 윤곽을 살렸다.
                border: '1px solid var(--home-color-primary-light)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--fs-caption)',
                fontWeight: 700,
                letterSpacing: '0.02em',
              }}
            >
              <Sparkles size={16} aria-hidden="true" />
              AI 기억 플랫폼
            </span>

            {/*
              태그라인: 11 문서 2절 후보 중 대표로 지정된 문구를 사용한다.
              최종 확정(다른 2개 후보와의 선택)은 랜딩 제작 시점 오너 몫 - 아직 미확정이다.
            */}
            <h1
              className="font-bold leading-tight mb-5"
              style={{
                fontSize: 'clamp(28px, 6.5vw, 52px)',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: 'var(--ls-heading-ko)',
                lineHeight: 1.15,
                wordBreak: 'keep-all',
              }}
            >
              기억을 간직하는 가장 쉬운 방법
            </h1>

            <p
              className="mx-auto lg:mx-0"
              style={{
                fontSize: 'clamp(var(--fs-body), 2.5vw, var(--fs-body-lg))',
                color: 'rgba(29,29,31,0.8)',
                maxWidth: '520px',
                marginBottom: 0,
                lineHeight: 'var(--lh-relaxed)',
              }}
            >
              빛바랜 사진을 복원하고, 목소리를 담은 영상 편지를 남기고,
              <br className="hidden sm:block" />
              반려동물과의 순간을 오래 간직하세요.
            </p>

            {/* FIX: 히어로 CTA 회귀 - ad1219c 리디자인에서 첫 화면의 주/부 CTA 2개가
                빠져 첫 화면에서 바로 시작할 방법이 없었다. 베이지 톤에 맞춰 복원한다.
                - 주 CTA: 다크(#1D1D1F) 배경 + 밝은 글자(#F5F5F7) → 약 16:1
                - 부 CTA: 흰 배경 + 다크 글자(#1D1D1F) → 약 17:1, 세피아 테두리로 윤곽 확보
                높이 --size-button-h(56px), 글자 --fs-button(17px). */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start items-center" style={{ marginTop: 32 }}>
              <Link
                to={ROUTES.PHOTO}
                className="flex items-center justify-center font-bold transition-opacity hover:opacity-90"
                style={{
                  minHeight: 'var(--size-button-h)',
                  width: '100%',
                  maxWidth: '300px',
                  padding: '0 28px',
                  fontSize: 'var(--fs-button)',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-on-dark)',
                  borderRadius: 'var(--radius-pill)',
                  boxShadow: '0 10px 24px rgba(120, 90, 50, 0.22)',
                }}
              >
                사진 복원 시작 · 9,900원
              </Link>
              <Link
                to={ROUTES.WILL}
                className="flex items-center justify-center font-bold transition-opacity hover:opacity-90"
                style={{
                  minHeight: 'var(--size-button-h)',
                  width: '100%',
                  maxWidth: '300px',
                  padding: '0 28px',
                  fontSize: 'var(--fs-button)',
                  backgroundColor: 'var(--home-color-secondary)',
                  color: 'var(--color-text-primary)',
                  borderRadius: 'var(--radius-pill)',
                  border: '1.5px solid rgba(120, 90, 50, 0.35)',
                }}
              >
                영상 편지 알아보기
              </Link>
            </div>
          </div>

          {/* 폰 목업 스테이지 - 모바일/태블릿: 아래(order-2), 데스크톱: 왼쪽
              컬럼(lg:order-1). perspective/preserve-3d 스테이지와 각 폰의
              rotateY/rotateX/rotate/translate 값은 기존 그대로 재사용하고,
              컨테이너 크기만 좌측 컬럼 폭(데스크톱 기준 대략 45~50vw 이내)에
              맞게 축소했다.
              두 PhoneMockup은 translate(-110%,-60%)/translate(9%,-40%)처럼 자기
              자신 크기 기준의 큰 퍼센트 이동값 + rotateY/rotateX/rotate 조합으로
              배치되어, 실제 렌더링 바운딩박스가 아래 스테이지 컨테이너(max-w/h)의
              명목상 경계를 상당히 벗어난다(좌표 계산상 lg 기준 좌측 폰은 위/왼쪽으로
              약 40~67px, 우측 폰은 오른쪽/아래로 약 42~82px 초과). 이 때문에 스테이지
              컨테이너 자체에 overflow:hidden을 주면 폰 상단(다이나믹 아일랜드)이나
              모서리가 잘려 보이는 회귀가 발생한다.

              (정정, 이전 버그 수정 실패 기록) 과거에 이 부모(좌측 컬럼)에
              overflow-x-hidden + overflow-y-visible을 함께 지정한 적이 있었는데,
              실제로는 전혀 효과가 없었다. CSS Overflow 스펙(및 모든 주요 브라우저의
              실제 동작)상 overflow-x/overflow-y 중 하나가 'visible'이고 다른 하나가
              'visible'이 아닌 값(예: hidden)이면, 'visible'인 축은 그것이 초기값이든
              명시적으로 선언한 값이든 상관없이 무조건 'auto'로 강제 재계산된다
              (Playwright로 getComputedStyle 실측: overflow-x-hidden +
              overflow-y-visible을 함께 줬을 때 computed overflowY는 여전히
              'auto'였고, 위에서 설명한 세로 초과분 때문에 scrollHeight(576px) >
              clientHeight(520px)가 되어 실제로 세로 스크롤바가 렌더링됐다. 즉
              overflow-y-visible 선언은 이 조합에서 항상 무시된다).

              해결: 이 컨테이너에서 overflow 관련 클래스를 아예 제거했다. 가로
              방향 클리핑은 최상위 <section>(이 파일 172번째 줄 부근,
              className="relative overflow-hidden")이 이미 전담하므로 이 중간
              컨테이너가 별도로 overflow-x를 선언할 필요가 없다. 컨테이너에
              overflow를 전혀 지정하지 않으면 computed overflow-x/overflow-y가
              모두 진짜 'visible'로 남아(강제 승격 규칙은 두 값이 다를 때만
              적용되므로 둘 다 visible이면 트리거되지 않는다) 세로 초과분이 스크롤
              없이 그대로 보이고, 가로 초과분은 section의 overflow-hidden이 대신
              막아준다(Playwright로 desktop 1440px/mobile 375px 두 폭 모두에서
              재검증: 이 컨테이너의 computed overflowY가 'visible'로 바뀌고
              document.body/documentElement의 scrollWidth도 viewport 폭과 동일해
              가로 스크롤이 생기지 않음을 확인했다). */}
          <div className="order-2 lg:order-1 flex justify-center lg:justify-start">
            <div
              className="relative w-full max-w-[380px] sm:max-w-[460px] lg:max-w-[520px] h-[360px] sm:h-[440px] lg:h-[520px]"
              style={{ perspective: '950px', transformStyle: 'preserve-3d' }}
            >
              {/* 왼쪽 폰: 빛바랜 옛날 사진(원본), 화면 안쪽으로 살짝 기운 3D 원근. 오른쪽 폰과
                  겹치지 않도록 중심에서 왼쪽으로 크게 떨어뜨려 배치한다. */}
              <PhoneMockup
                widthClass="w-[132px] sm:w-[180px] lg:w-[218px]"
                translate="translate(-110%, -60%)"
                rotate={-13}
                rotateY={25}
                rotateX={9}
                zIndex={10}
                photoFilter="grayscale(1) contrast(0.85) brightness(0.85)"
                photoAlt="흑백으로 빛바랜 옛날 인물 원본 사진 예시 (밝게 웃는 동양인 여성)"
                label="원본"
                LabelIcon={null}
                labelTone="before"
              />

              {/* 오른쪽 폰: AI로 복원된 컬러 사진, 왼쪽 폰과 눈에 보이는 간격을 두고
                  오른쪽 아래로 살짝 엇갈려 나란히 서도록 배치, 반대 방향 원근 */}
              <PhoneMockup
                widthClass="w-[140px] sm:w-[190px] lg:w-[230px]"
                translate="translate(9%, -40%)"
                rotate={9}
                rotateY={-19}
                rotateX={6}
                zIndex={20}
                photoFilter="none"
                photoAlt="AI로 자연스럽게 복원된 인물 컬러 사진 예시 (밝게 웃는 동양인 여성)"
                label="복원 완료"
                LabelIcon={CheckCircle2}
                labelTone="after"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
