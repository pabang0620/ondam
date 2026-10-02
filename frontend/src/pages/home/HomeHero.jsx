import { CheckCircle2, Sparkles } from 'lucide-react'

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
 * 배경: <section>에는 별도 background를 지정하지 않는다. 상위 HomePage.jsx의
 * 단색 배경(--color-bg, #FFFFFF)과 페이지 전역 장식 블롭(HomeBackgroundBlobs)이
 * 그대로 비쳐 보인다. 그라디언트 배경이나 콘텐츠를 감싸는 흰색 카드는 한때 이
 * 섹션에 로컬로 추가됐던 적이 있으나(요청 범위를 벗어난 시도였음), 이후 완전히
 * 철회되어 현재는 사용하지 않는다.
 * 대비 실측(WCAG 상대휘도 공식, 배경 #FFFFFF 기준):
 *   - 헤드라인(h1): var(--color-text-primary) #333336 → 대비 12.59:1
 *   - 서브카피(p): rgba(51,51,54,0.88)를 배경과 합성한 실효색(#4B4B4E) 기준 대비
 *     8.63:1
 *   두 값 모두 AA 본문 기준(4.5:1)을 여유 있게 통과한다.
 *
 * 레이아웃(2026-09, v3): 텍스트-폰 2단 그리드의 좌우를 교체했다. lg 이상에서
 * 텍스트가 왼쪽 컬럼, 폰 스테이지가 오른쪽 컬럼에 오도록 order 유틸리티의
 * lg 오버라이드를 반대로 뒤집었다(마크업 DOM 순서 자체는 텍스트가 먼저이므로,
 * lg 오버라이드를 제거하면 자연스럽게 텍스트가 1번 컬럼(왼쪽)에 온다). lg 미만
 * (모바일/태블릿)에서는 기존과 동일하게 텍스트 → 폰 순서로 세로 스택된다.
 * 폰 스테이지의 perspective/preserve-3d 및 각 폰의 rotateY/rotateX/rotate/translate
 * 값은 기존 그대로 재사용한다.
 *
 * 등장 애니메이션(v3 → v5로 방식 교체): v3에서는 wrapper div에 opacity 0→1 +
 * translateY 페이드인 애니메이션을 걸고, 이어서 무한 반복 "공중부양" 애니메이션을
 * 붙였었다. v5에서 요청에 따라 완전히 새로 짰다:
 *   - opacity는 더 이상 애니메이션하지 않는다(처음부터 끝까지 항상 1). 대신
 *     PhoneMockup 자신의 transform을 "시작(더 아래, 다른 rotate 각도) → 최종
 *     착지 자세(translate/rotateY/rotateX/rotate)"로 직접 보간해 순수하게
 *     위치 이동 + 회전만으로 "아래에서 위로 솟아오르며 기울어지는" 느낌을 낸다
 *     (별도 wrapper 없이 PhoneMockup 루트 요소에 직접 건다 - 상세 계산은
 *     PhoneMockup 정의부의 finalTransform/startTransform 주석 참고).
 *   - 두 폰은 여전히 진입 delay(100ms/250ms)로 따로 올라오고, 시작 오프셋
 *     (140px/120px)·시작 rotate(6deg/-6deg)도 서로 달라 완전히 같은 모양으로
 *     움직이지 않는다.
 *   - 등장이 끝난 뒤의 무한 반복 "공중부양" 애니메이션은 v5에서 완전히
 *     제거했다 - 착지 후에는 정지 상태를 유지한다.
 *   - prefers-reduced-motion: reduce에서는 `.ondam-hero-phone-rise`에 대해
 *     animation을 꺼서, PhoneMockup의 기본 인라인 transform(최종 착지 자세)이
 *     전환 없이 바로 보이게 한다.
 *   - 스테이지 컨테이너에 overflow:hidden을 걸어 등장 시작 시점(가장 아래로
 *     내려가 있는 순간)에 폰이 섹션 밖으로 삐져나오지 않게 가리는 방안도
 *     검토했으나, 이 컨테이너는 이미 "폰이 정지 상태에서도 경계를 넘어간다"는
 *     이유로 overflow를 의도적으로 지정하지 않고 있다(아래 스테이지 컨테이너
 *     주석 참고) - overflow:hidden을 추가하면 착지 후 정지 상태의 다이나믹
 *     아일랜드/모서리가 다시 잘리는 회귀가 재발한다. 대신 Playwright로 등장
 *     애니메이션의 가장 아래로 내려간 프레임(시작 직후, translateY 오프셋
 *     최대)까지 실제로 스크린샷 검증한 결과 섹션 하단 밖으로 튀어나오는
 *     시각적 문제가 없어(스테이지 아래 pb-20~32 여백이 충분함) overflow를
 *     추가하지 않기로 했다.
 *
 * 폰 크기/겹침/그림자/회전 조정(v4): 두 폰을 더 크게 키우고 화면비를
 * 9/19.5(좁고 김) → 9/16(좀 더 넓적함)으로 조정했다. translate 값을 좁혀
 * 두 폰이 이전보다 훨씬 더 겹치도록 했고, boxShadow의 blur/spread를 줄여
 * 그림자가 덜 퍼지게 했다. 왼쪽(원본) 폰의 Z축 rotate를 -13deg → -7deg로
 * 0에 가깝게 낮췄다(오른쪽 폰 rotate=9deg는 그대로 유지).
 *
 * 장식 정리(v4): 배경 장식 구름(HeroCloud, lucide Cloud 아이콘 기반)을
 * 완전히 제거했다.
 */
const HERO_PHOTO_URL = 'https://images.unsplash.com/photo-1758600587815-b654d1405e83?auto=format&fit=crop&w=1600&q=80'

/*
 * 순수 CSS 아이폰 프레임 목업. 이미지 자산(PNG 등) 없이 div만으로 검은 라운드
 * 프레임 + 상단 다이나믹 아일랜드 + 좌측 볼륨버튼 + 우측 전원버튼을 그리고, 그
 * 안에 실제 사진을 objectFit: cover로 채운다.
 */
function PhoneMockup({
  widthClass,
  translate,
  rotate,
  rotateX,
  rotateY,
  zIndex,
  photoFilter,
  photoAlt,
  label,
  LabelIcon,
  labelTone,
  animName,
  animDelay,
  enterRotate,
  enterOffsetY,
}) {
  // 최종(착지) transform - translate(위치) → rotateY/rotateX(3D 원근 틸트) →
  // rotate(Z축 기울기) 순서로 합성한다(자세한 순서 이유는 아래 style 주석 참고).
  const finalTransform = `${translate} rotateY(${rotateY}deg) rotateX(${rotateX}deg) rotate(${rotate}deg)`
  // 등장 시작 transform - 같은 translate/rotateY/rotateX 뒤에 화면 좌표계 기준
  // 순수 수직 이동(translateY, px)을 추가로 끼워 넣고(translate끼리는 순서에
  // 상관없이 더해지므로 화면상 "아래에서" 시작하는 순수 수직 오프셋이 된다),
  // Z축 rotate만 시작 각도(enterRotate)로 바꿔 "평평하다가 최종 기울기로
  // 회전하며 올라오는" 느낌을 만든다(v5, 상세는 파일 상단 주석 참고).
  const startTransform = `${translate} translateY(${enterOffsetY}px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) rotate(${enterRotate}deg)`
  return (
    <>
      <style>{`
        @keyframes ${animName} {
          from { transform: ${startTransform}; }
          to { transform: ${finalTransform}; }
        }
      `}</style>
      <div
        className={`absolute top-1/2 left-1/2 ondam-hero-phone-rise ${widthClass}`}
        style={{
          aspectRatio: '9 / 16',
          // 평상시(애니메이션 종료 후/reduced-motion)에는 이 인라인 transform이
          // 최종 착지 자세를 그대로 유지한다. 애니메이션이 활성 상태인 동안에는
          // CSS 애니메이션이 non-!important 인라인 스타일보다 우선 적용되어
          // startTransform → finalTransform으로 보간되고, 종료 후에는
          // animation-fill-mode: both가 finalTransform 상태를 계속 유지한다.
          transform: finalTransform,
          animation: `${animName} 550ms cubic-bezier(0.22, 0.61, 0.36, 1) ${animDelay}ms both`,
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
            boxShadow: '0 14px 26px rgba(0,0,0,0.28), 0 4px 10px rgba(0,0,0,0.18)',
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
              className="absolute inline-flex items-center gap-1 font-semibold whitespace-nowrap"
              style={{
                top: '9%',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: labelTone === 'before' ? 'rgba(0,0,0,0.6)' : 'var(--home-color-secondary)',
                color: labelTone === 'before' ? '#FFFFFF' : 'var(--color-text-primary)',
                fontSize: '11px',
              }}
            >
              {LabelIcon ? <LabelIcon size={11} aria-hidden="true" /> : null}
              {label}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function HomeHero() {
  return (
    <section
      className="relative"
      // 가로 스크롤 방지 목적의 overflow-x만 clip으로 유지한다(프로젝트 전반의
      // MainLayout.jsx/HomePage.jsx와 동일한 관례). 기존에는 Tailwind
      // overflow-hidden(양쪽 축 모두 hidden)을 썼는데, 이는 overflow-y까지
      // 함께 숨겨 아래 폰 스테이지의 원근 틸트로 섹션 padding-box를 살짝
      // 벗어나는 폰 모서리/다이나믹 아일랜드나 등장 애니메이션 중간 프레임이
      // 세로 방향으로 잘려 보이는 원인이었다. overflow-x: clip은 가로 넘침만
      // 차단하고 overflow-y는 진짜 'visible'로 남긴다(clip은 hidden과 달리
      // 스크롤 컨테이너로 승격되지도 않는다).
      style={{ overflowX: 'clip' }}
    >
      {/*
        등장 애니메이션 reduced-motion 처리(v5). 실제 keyframes는 각 PhoneMockup가
        자신의 translate/rotate 값으로부터 동적으로 계산해 인스턴스별 <style>에
        직접 심는다(상세는 PhoneMockup 정의부 주석 참고). 전역 규칙
        (global.css의 animation-duration: 0.01ms)만으로는 "both" fill이 극도로
        짧은 시간 동안 시작/끝 프레임을 순간적으로 스치듯 지나가면서 미세한
        깜빡임처럼 보일 수 있어, 여기서 명시적으로 animation을 완전히 꺼서
        PhoneMockup의 기본 인라인 transform(finalTransform, 착지 자세)이 아무
        전환 없이 바로 보이게 한다.
      */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .ondam-hero-phone-rise {
            animation: none !important;
          }
        }
      `}</style>

      {/*
        텍스트(왼쪽)-폰 목업(오른쪽) 2단 그리드(v3, 기존 좌-폰/우-텍스트 배치를
        반대로 뒤집었다 - 상세는 파일 상단 주석 참고). lg 미만에서는 1열로
        전환되며, DOM 순서(텍스트 → 폰)를 그대로 따라 텍스트가 먼저, 폰 비주얼이
        아래에 온다(order 유틸리티로 lg 이상에서만 좌우를 명시한다).
      */}
      {/*
        콘텐츠 컨테이너 - 배지/헤드라인/서브카피/폰 스테이지 전체를 담는
        max-w-7xl 컨테이너. 배경/보더/그림자 없이 좌우/상하 패딩만 갖는다.
      */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-16 sm:pt-20 lg:pt-28 pb-20 sm:pb-24 lg:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-10 lg:gap-12">
          {/* 텍스트 블록 - 모바일/태블릿: 위(order-1) + 중앙정렬, 데스크톱: 왼쪽
              컬럼(lg:order-1) + 좌측정렬(일반적인 좌우 2단 히어로 관례) */}
          <div className="order-1 lg:order-1 text-center lg:text-left">
            <span
              className="inline-flex items-center gap-1.5 mb-5"
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--home-color-secondary)',
                // 페이지 배경(--color-bg #FFFFFF) 위에서 흰 배지가 묻히지
                // 않도록 얇은 테두리를 둘렀다(배경색과 배지색이 같아 이
                // 테두리에만 의존해 경계를 구분한다).
                // primary-light(레퍼런스 오렌지 원색, 흰 배경 대비 2.093:1)는
                // 비텍스트 보더 기준(3:1)도 미달이라 쓸 수 없어, 3:1을 여유
                // 있게 통과하는 비텍스트 전용 중간톤 primary-mid(4.820:1)로
                // 교체했다.
                border: '1px solid var(--home-color-primary-mid)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--fs-caption)',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              <Sparkles size={14} aria-hidden="true" />
              AI 기억 플랫폼
            </span>

            {/*
              태그라인: 11 문서 2절 후보 중 대표로 지정된 문구를 사용한다.
              최종 확정(다른 2개 후보와의 선택)은 랜딩 제작 시점 오너 몫 - 아직 미확정이다.
            */}
            <h1
              className="font-semibold leading-tight mb-5"
              style={{
                fontSize: 'clamp(28px, 6.5vw, 52px)',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                letterSpacing: 'var(--ls-heading-ko)',
                lineHeight: 1.15,
                wordBreak: 'keep-all',
              }}
            >
              기억을 간직하는
              <br />
              가장 쉬운 방법
            </h1>

            <p
              className="mx-auto lg:mx-0"
              style={{
                fontSize: 'clamp(var(--fs-body), 2.5vw, var(--fs-body-lg))',
                color: 'rgba(51,51,54,0.88)',
                maxWidth: '520px',
                marginBottom: 0,
                lineHeight: 'var(--lh-relaxed)',
              }}
            >
              빛바랜 사진을 복원하고, 목소리를 담은 영상 편지를 남기고,
              <br className="hidden sm:block" />
              반려동물과의 순간을 오래 간직하세요.
            </p>
          </div>

          {/* 폰 목업 스테이지 - 모바일/태블릿: 아래(order-2), 데스크톱: 오른쪽
              컬럼(lg:order-2, v3에서 좌우를 뒤집었다). perspective/preserve-3d
              스테이지와 각 폰의 rotateY/rotateX/rotate/translate 값은 기존
              그대로 재사용하고, 컨테이너 크기만 컬럼 폭(데스크톱 기준 대략
              45~50vw 이내)에 맞게 축소했다.
              두 PhoneMockup은 translate(-78%,-62%)/translate(-5%,-28%)처럼
              (v6에서 두 폰 사이 간격을 더 벌리고 겹치는 지점을 얼굴/다이나믹
              아일랜드가 없는 하단 쪽으로 옮기기 위해 v4 값에서 더 조정했다 -
              상세 사유는 두 PhoneMockup 사이의 v6 주석 참고) 자기 자신 크기
              기준의 퍼센트 이동값 + rotateY/rotateX/rotate 조합으로 배치되어,
              실제 렌더링 바운딩박스가 아래 스테이지 컨테이너(max-w/h)의 명목상
              경계를 벗어난다. 이 때문에 스테이지 컨테이너 자체에 overflow:hidden을
              주면 폰 상단(다이나믹 아일랜드)이나 모서리가 잘려 보이는 회귀가
              발생한다.

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
              방향 클리핑은 최상위 <section>(이 파일 상단의
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
          <div className="order-2 lg:order-2 flex justify-center lg:justify-end">
            <div
              className="relative w-full max-w-[380px] sm:max-w-[460px] lg:max-w-[520px] h-[360px] sm:h-[440px] lg:h-[520px]"
              style={{ perspective: '950px' }}
            >
              {/*
                (중요, v6 원인 규명) 이 스테이지 컨테이너는 과거 perspective와
                함께 transformStyle: 'preserve-3d'도 지정하고 있었는데, 이 조합이
                "오른쪽 폰이 z-index(20 > 10)에도 불구하고 시각적으로 왼쪽 폰에
                가려 보인다"는 버그의 실제 원인이었다(Playwright 스크린샷으로 직접
                확인). preserve-3d가 부모에 걸리면 두 PhoneMockup 형제가 하나의
                공유 3D 공간에 함께 배치되고, 브라우저는 z-index가 아니라 각
                폰이 rotateY/rotateX로 기울어지며 생기는 실제 3D 깊이(z좌표)로
                형제 간 페인트 순서를 다시 계산한다 - 그 결과 z-index만으로는
                어느 폰이 앞에 그려질지 픽셀 단위로 보장되지 않았다(원본 폰의
                일부 영역이 실제로는 복원 폰보다 카메라에 더 가까운 z값을 가지면
                그 영역만 원본이 앞서 그려진다). 폰 스테이지 뒤에 새로 추가한
                색상 원형 장식이 (낮은 zIndex를 줬음에도) 오히려 두 폰 위에 얹혀
                보인 것도 같은 원인이다.
                해결: 이 컨테이너에서 transformStyle: 'preserve-3d'를 제거했다
                (perspective만 유지). 각 PhoneMockup은 여전히 자기 자신의 루트
                요소에 transform(rotateY/rotateX/rotate)과 자체
                transformStyle: 'preserve-3d'를 갖고 있으므로 - perspective를
                상속받아 낱개로는 지금까지와 동일하게 3D 원근 틸트로 보인다
                (Playwright로 재검증: 두 폰의 기울어진 외형에 시각적 차이 없음).
                다만 이제 두 형제(원형 장식 포함 3개 요소)는 더 이상 공유 3D
                공간에서 실제 깊이로 재정렬되지 않고, 평범한 2D 스태킹처럼
                DOM 순서 + z-index(원형 장식 1 → 왼쪽 폰 10 → 오른쪽 폰 20)로만
                페인트 순서가 결정된다 - 오른쪽 폰이 항상 전부 보이고, 원형
                장식은 항상 두 폰 뒤에 확실히 깔린다.
              */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  // 기존 140% → 약 82%로 축소(115%). 위치(중앙 정렬)·색상·blur는 그대로 유지.
                  width: '115%',
                  aspectRatio: '1 / 1',
                  borderRadius: '50%',
                  background: 'var(--home-gradient-decor)',
                  opacity: 0.55,
                  filter: 'blur(48px)',
                  zIndex: 1,
                  pointerEvents: 'none',
                }}
              />

              {/* 왼쪽 폰: 빛바랜 옛날 사진(원본), 화면 안쪽으로 살짝 기운 3D 원근.
                  v4에서 두 폰이 좀 더 겹치도록 translate 간격을 좁혔고, Z축 회전을
                  -13deg → -7deg로 완만하게 낮췄다(오른쪽으로 살짝 덜 기울어지게).
                  v5: 등장 애니메이션(translateY + rotate 보간)은 PhoneMockup
                  자신에게 직접 건다(상세는 PhoneMockup 정의부 주석 참고).
                  v6: "오른쪽(복원 완료) 폰이 가려져 보인다"는 피드백에 따라
                  translate를 (-70%,-55%) → (-78%,-62%)로 왼쪽/위로 더 밀어
                  오른쪽 폰과의 간격을 넓히고, 겹치는 지점이 두 폰의 얼굴/다이나믹
                  아일랜드가 아니라 하단(옷깃 부근, 내용 없는 여백)에서 생기도록
                  옮겼다. rotate/rotateY/rotateX 각도값 자체는 건드리지 않았다
                  (요청에 따름). 근본 원인(preserve-3d 3D 깊이 정렬로 z-index가
                  무시되던 문제)은 스테이지 컨테이너의 v6 주석에서 별도로
                  수정했다 - translate 조정은 그 위에 얹는 추가 개선이다. */}
              <PhoneMockup
                widthClass="w-[150px] sm:w-[205px] lg:w-[250px]"
                translate="translate(-78%, -62%)"
                rotate={-7}
                rotateY={25}
                rotateX={9}
                zIndex={10}
                photoFilter="grayscale(1) contrast(0.85) brightness(0.85)"
                photoAlt="흑백으로 빛바랜 옛날 인물 원본 사진 예시 (밝게 웃는 동양인 여성)"
                label="원본"
                LabelIcon={null}
                labelTone="before"
                animName="ondamHeroPhoneRise1"
                animDelay={100}
                enterRotate={6}
                enterOffsetY={140}
              />

              {/* 오른쪽 폰: AI로 복원된 컬러 사진. v4에서 왼쪽 폰과 좀 더 겹치도록
                  오른쪽으로 밀어두던 translate를 왼쪽 방향으로 당겼다. v6:
                  (-15%,-38%) → (-5%,-28%)로 오른쪽/아래로 더 밀어 왼쪽 폰과의
                  간격을 넓혔다(왼쪽 폰 쪽 v6 주석 참고 - 겹침을 하단으로 이동). */}
              <PhoneMockup
                widthClass="w-[158px] sm:w-[215px] lg:w-[264px]"
                translate="translate(-5%, -28%)"
                rotate={9}
                rotateY={-19}
                rotateX={6}
                zIndex={20}
                photoFilter="none"
                photoAlt="AI로 자연스럽게 복원된 인물 컬러 사진 예시 (밝게 웃는 동양인 여성)"
                label="복원 완료"
                animName="ondamHeroPhoneRise2"
                animDelay={250}
                enterRotate={-6}
                enterOffsetY={120}
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
