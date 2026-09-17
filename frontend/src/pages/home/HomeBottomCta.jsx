import { Link } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'

/*
 * 최종 CTA - 랜딩페이지 하단(푸터 직전)에 흔히 쓰이는 "최종 CTA 카드" 패턴.
 * 배경색만 있던 텍스트 중앙정렬 섹션을, 큰 둥근 카드로 바꿔 시각적 임팩트를 준다.
 *
 * 배경(2026-09 "바랜 종이" 리디자인): 이 카드가 HomeHero.jsx와 공유하던
 * var(--home-color-primary)(밝은 하늘색)를 이 파일 범위에서만 따뜻한 베이지
 * 그라디언트로 직접 교체했다. HomeProcess.jsx/HomeServices.jsx/HomeTrust.jsx는
 * 흰 배경 위 아이콘·텍스트 색으로 이 토큰을 그대로 참조하므로, 토큰 자체
 * (HomePage.jsx)는 절대 건드리지 않고 CTA_BEIGE_BG처럼 이 파일에 로컬로 리터럴
 * 값을 정의한다(HomeHero.jsx도 동일한 톤을 자체 파일에 별도로 정의).
 *   - CTA_BEIGE_BG: linear-gradient(135deg, #EFE6D3 0%, #E3D5B8 100%)
 * 대비 실측(WCAG 상대휘도 공식, 배경 두 톤 중 더 어두운 #E3D5B8 기준 = worst case,
 * HomeHero.jsx 상단 주석과 동일 배경 값이라 동일 결과):
 *   - 헤드라인(h2): var(--color-text-primary) #1D1D1F → 대비 약 11.60:1
 *     (밝은 쪽 #EFE6D3 기준으로는 약 13.57:1). AA 본문 기준(4.5:1) 여유 있게 통과.
 *   - 서브텍스트(p): rgba(29,29,31,0.8)를 배경과 합성한 실효색(#45423e) 기준 대비
 *     약 6.89:1(밝은 쪽 기준 약 7.69:1). AA 통과.
 * 카드 자체에 세피아 톤 그림자를 줘 배경(--color-bg-alt, 거의 흰색) 위에서
 * 입체적으로 떠 보이게 하고, 모서리에 반투명 블롭 2개 + 헤드라인 위 아이콘 배지로
 * 장식 깊이감을 더한다. 블롭은 하늘색 반투명 대신 홈 3차 강조색인
 * var(--home-color-accent)(테라코타 #C55647) 계열의 아주 옅은 반투명으로 바꿔
 * "바랜 종이 + 세피아" 느낌을 강화했다(아이콘·텍스트 색으로 쓰는 게 아니라 배경
 * 장식 전용이라 --home-color-primary 토큰과 무관, 공유 토큰 규칙에 영향 없음).
 * 흰 배경 CTA 버튼은 베이지 배경 위에서 대비가 낮아(백/베이지 약 1.2~1.5:1)
 * 테두리를 더 또렷하게, 그림자도 세피아 톤으로 바꿔 배경과 확실히 분리되도록
 * 보강했다. 카피와 라우트는 기존 그대로 유지한다.
 */

// 하단 CTA 카드 전용 "바랜 종이" 베이지 배경. 홈 공유 토큰(--home-color-primary)은
// 다른 섹션(흰 배경 위 아이콘·텍스트)에서 그대로 쓰이므로 절대 변경하지 않고,
// 이 파일 범위에서만 리터럴 값으로 배경을 정의한다(HomeHero.jsx와 동일한 톤을
// 각자 파일에 독립적으로 정의 - 의도적 중복, 공유 토큰화하지 않는다).
const CTA_BEIGE_BG = 'linear-gradient(135deg, #EFE6D3 0%, #E3D5B8 100%)'

export default function HomeBottomCta() {
  return (
    <section
      className="w-full"
      style={{
        backgroundColor: 'var(--color-bg-alt)',
        padding: 'clamp(48px, 8vw, 96px) 16px',
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div
          className="relative overflow-hidden text-center"
          style={{
            borderRadius: 'clamp(24px, 4vw, 32px)',
            background: CTA_BEIGE_BG,
            padding: 'clamp(48px, 8vw, 80px) clamp(24px, 6vw, 56px)',
            // 그림자 색을 하늘색 틴트에서 베이지 배경에 어울리는 세피아/브라운 톤으로
            // 교체해 "바랜 종이" 카드가 떠 보이는 느낌을 유지했다.
            boxShadow: '0 30px 60px rgba(120, 90, 50, 0.22), 0 10px 24px rgba(120, 90, 50, 0.14)',
          }}
        >
          {/* 장식용 원형 블롭 2개 - 카드 좌상단/우하단에 걸쳐 반투명 원을 배치해
              단색 배경에 은은한 입체감을 준다. 배경이 베이지로 바뀌며 하늘색 반투명은
              어울리지 않으므로, 홈 3차 강조색인 var(--home-color-accent)(테라코타
              #C55647)의 아주 옅은 반투명으로 대체해 "바랜 종이 + 세피아" 톤을
              강화했다. 클릭/포커스에 방해되지 않도록 항상 pointer-events: none +
              aria-hidden 처리. */}
          <div
            aria-hidden="true"
            className="absolute rounded-full"
            style={{
              top: 'clamp(-140px, -12vw, -100px)',
              left: 'clamp(-120px, -10vw, -80px)',
              width: 'clamp(220px, 26vw, 320px)',
              height: 'clamp(220px, 26vw, 320px)',
              backgroundColor: 'rgba(197, 86, 71, 0.14)',
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
              backgroundColor: 'rgba(197, 86, 71, 0.10)',
              pointerEvents: 'none',
            }}
          />

          {/* 헤드라인 위 아이콘 배지 - 베이지 배경 위에서 또렷하게 보이도록 크림에
              가까운 흰색 원(불투명도를 살짝 높임) + 어두운 텍스트 톤 아이콘 조합을
              사용한다. */}
          <div
            aria-hidden="true"
            className="relative inline-flex items-center justify-center mb-6 sm:mb-7"
            style={{
              width: 'clamp(72px, 8vw, 88px)',
              height: 'clamp(72px, 8vw, 88px)',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.62)',
            }}
          >
            <Camera size={44} strokeWidth={1.75} color="var(--color-text-primary)" />
          </div>

          <h2
            className="relative font-bold mb-5 sm:mb-6"
            style={{
              fontSize: 'clamp(24px, 4.2vw, 36px)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: 'var(--ls-heading-ko)',
              wordBreak: 'keep-all',
            }}
          >
            사진 한 장으로 시작해보세요
          </h2>
          <p
            className="relative"
            style={{
              fontSize: 'var(--fs-body-lg)',
              color: 'rgba(29,29,31,0.8)',
              maxWidth: '440px',
              margin: '0 auto 44px',
              lineHeight: 'var(--lh-relaxed)',
              wordBreak: 'keep-all',
            }}
          >
            9,900원이면 복원부터 결과물 4종까지 받아보실 수 있어요.
          </p>
          <div className="relative flex justify-center">
            {/* 카드 배경이 베이지로 바뀌며 흰 버튼과의 명도 대비가 낮아지므로(흰 vs
                베이지 약 1.2~1.5:1), 테두리를 더 또렷한 세피아 톤으로, 그림자도
                같은 계열로 바꿔 배경과 확실히 분리되도록 보강했다. */}
            <Link
              to={ROUTES.PHOTO}
              className="flex items-center justify-center font-bold transition-opacity hover:opacity-90"
              style={{
                height: 'clamp(56px, 5vw, 60px)',
                width: '100%',
                maxWidth: '360px',
                padding: '0 48px',
                fontSize: 'clamp(17px, 1.8vw, 19px)',
                backgroundColor: 'var(--home-color-secondary)',
                color: 'var(--color-text-primary)',
                borderRadius: 'var(--radius-pill)',
                border: '1.5px solid rgba(120, 90, 50, 0.28)',
                boxShadow: '0 14px 30px rgba(120, 90, 50, 0.30), 0 6px 14px rgba(120, 90, 50, 0.18)',
              }}
            >
              9,900원으로 시작하기
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
