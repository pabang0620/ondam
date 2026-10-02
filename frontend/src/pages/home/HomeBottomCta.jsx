import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'

/*
 * 최종 CTA - 랜딩페이지 하단(푸터 직전) 섹션.
 *
 * 섹션 전체(풀블리드)에 위→아래(180deg) 그라디언트 배경을 직접 적용한다.
 * 카드 특유의 background/border-radius/box-shadow는 사용하지 않는다.
 *
 * 배경: 피치→살구→코랄 핑크 그라디언트. 바닥에 보라/라벤더 기운이 남지 않도록
 * 모든 스톱을 따뜻한 색상환(hue 약 12~25도, 파랑 성분 < 초록 성분) 안에 둔다.
 * 기존 #FBDCE3(hue 약 346도, 파랑 > 초록)과 #DDE0F7(라벤더)은 보라처럼 보일 수
 * 있어 제거했다. 홈 공유 토큰(--home-color-primary)과 무관하게 이 파일에
 * 로컬 리터럴 값으로 정의한다(HomePage.jsx 토큰은 건드리지 않는다).
 *   - CTA_SECTION_GRADIENT: 기준 색 #FDE6D8 / #FDD9CB / #FBCDC0 (0% / 55% / 100%),
 *     각 스톱 알파 0.35
 * 대비 실측(WCAG 상대휘도 공식, 3개 스톱 각각. 알파 0.35 배경을 --color-bg
 * #FFFFFF 위에 합성한 실효색 #FEF6F1 / #FEF2ED / #FEEEE9 기준):
 *   - 헤드라인(h2): var(--color-text-primary) #333336 →
 *     11.82:1 / 11.46:1 / 11.12:1(가장 어두운 스톱, worst case)
 *   - 서브텍스트(p): rgba(51,51,54,0.88)를 합성 배경과 다시 합성한 실효색 →
 *     8.22:1 / 8.02:1 / 7.83:1(worst case)
 *   모든 스톱이 AA 본문 기준(4.5:1)을 크게 웃돈다.
 * 장식 블롭은 딥 코랄 로즈 계열(--home-color-accent #E23E57 기반)이다. 버튼에는
 * box-shadow를 쓰지 않는다. 카피와 라우트는 기존 그대로 유지한다.
 */

// 하단 CTA 섹션 전용 파스텔 그라디언트(top → bottom). 홈 공유 토큰
// (--home-color-primary)은 다른 섹션에서 그대로 쓰이므로 변경하지 않고, 이 파일
// 범위에서만 리터럴 값으로 정의한다(의도적 중복, 공유 토큰화하지 않는다).
// 세 스톱 모두 알파 0.35(rgba)으로 뒤의 --color-bg(#FFFFFF)가 비치게 했다.
const CTA_SECTION_GRADIENT =
  'linear-gradient(180deg, rgba(253,230,216,0.35) 0%, rgba(253,217,203,0.35) 55%, rgba(251,205,192,0.35) 100%)'

// 하단 CTA 버튼 그라디언트: 로고 토큰과 같은 색 stop, 방향만 180deg(위→아래).
// 출처: global.css:182 --color-brand-gradient (135deg #F5A052 0%, #E23E57 100%).
// 토큰은 135deg로 고정이라 방향만 바꿀 수 없어 이 파일에 상수로 정의한다.
// 위쪽 #F5A052(오렌지), 아래쪽 #E23E57(코랄). 색 값은 토큰과 동일하게 유지할 것.
// 그라디언트는 backgroundColor가 아니라 반드시 background(단축)로 지정해야 유효하다.
const CTA_BUTTON_GRADIENT = 'linear-gradient(180deg, #F5A052 0%, #E23E57 100%)'

// 버튼 글자색: 사용자 요청에 따라 흰 글자(#FFFFFF) 사용. WCAG AA(4.5:1) 미달이며
// 의도된 선택이다: 시작 #F5A052 2.093:1 / 끝 #E23E57 4.150:1.
// 대비 보완용 배경 어둡게 하기·textShadow·boxShadow는 사용자 요청으로 적용하지 않는다.

export default function HomeBottomCta() {
  return (
    <section
      className="relative w-full overflow-hidden text-center"
      style={{
        background: CTA_SECTION_GRADIENT,
        padding: 'clamp(64px, 10vw, 120px) 16px',
      }}
    >
      {/* 장식용 원형 블롭 2개 - 섹션 좌상단/우하단에 걸쳐 반투명 원을 배치해
          그라디언트 배경에 은은한 입체감을 준다. 홈 4차 강조색인
          var(--home-color-accent)(레퍼런스 코랄 #E23E57)의 아주 옅은 반투명으로
          대체해 딥 코랄 로즈 톤을 강화했다(순수 배경 장식이라 대비 기준
          미적용). 클릭/포커스에 방해되지 않도록 항상 pointer-events: none +
          aria-hidden 처리. */}
      <div
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          top: 'clamp(-140px, -12vw, -100px)',
          left: 'clamp(-120px, -10vw, -80px)',
          width: 'clamp(220px, 26vw, 320px)',
          height: 'clamp(220px, 26vw, 320px)',
          backgroundColor: 'rgba(226, 62, 87, 0.14)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          bottom: 'clamp(-160px, -14vw, -110px)',
          right: 'clamp(-100px, -9vw, -60px)',
          width: 'clamp(260px, 30vw, 380px)',
          height: 'clamp(260px, 30vw, 380px)',
          backgroundColor: 'rgba(226, 62, 87, 0.10)',
          pointerEvents: 'none',
        }}
      />

      <div className="relative max-w-6xl mx-auto">
        <h2
          className="font-semibold mb-5 sm:mb-6"
          style={{
            fontSize: 'clamp(28px, 4.8vw, 40px)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: 'var(--ls-heading-ko)',
            wordBreak: 'keep-all',
          }}
        >
          사진 한 장으로 시작해보세요
        </h2>
        <p
          style={{
            fontSize: 'clamp(18px, 2.2vw, 20px)',
            color: 'rgba(51,51,54,0.88)',
            maxWidth: 'min(720px, 100%)',
            margin: '0 auto 44px',
            lineHeight: 'var(--lh-relaxed)',
            wordBreak: 'keep-all',
          }}
        >
          9,900원이면 복원부터 결과물 4종까지 받아보실 수 있어요.
        </p>
        <div className="flex justify-center">
          {/* 오렌지→코랄 위→아래 그라디언트 버튼 + 흰 글자(AA 미달, 사용자 요청.
              상단 주석 참고). hover는 opacity 방식을 유지한다. */}
          <Link
            to={ROUTES.PHOTO}
            className="flex items-center justify-center font-semibold transition-opacity hover:opacity-90"
            style={{
              height: 'clamp(56px, 5vw, 60px)',
              width: '100%',
              maxWidth: '360px',
              padding: '0 48px',
              fontSize: 'clamp(17px, 1.8vw, 19px)',
              background: CTA_BUTTON_GRADIENT,
              color: '#FFFFFF',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
            }}
          >
            시작하기
          </Link>
        </div>
      </div>
    </section>
  )
}
