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
// - 색상 참고: Behance "FRESHCODE App Renewal"(그린 주색 + 옐로우 포인트) →
//   이후 하늘색을 거쳐 연한 베이지 갈색(모카/커피 브라운) 톤으로 재조정(2026-09).
// 전역 --color-primary(다크 차콜)는 추모관/유언장/사진관/반려동물 등 다른 도메인의
// 고유 accent 체계(각자 네이비/베이지/차콜/테라코타)에 영향을 주므로 절대 건드리지
// 않는다. 대신 이 최상위 wrapper에만 유효한 홈 스코프 커스텀 프로퍼티를 정의하고,
// 하위 섹션들은 항상 var(--home-color-*)로만 참조한다(전역 토큰 미변경).
const HOME_THEME_VARS = {
  // 모카/커피 브라운(베이지 갈색 계열, 2026-09 리디자인) - HomeProcess.jsx/
  // HomeServices.jsx/HomeTrust.jsx에서 흰 배경(#FFFFFF) 위 아이콘·텍스트 색으로
  // 쓰인다. 과거 이 토큰을 밝게(하늘색 #38BDF8 등) 바꿨다가 흰 배경 위에서 아이콘이
  // 잘 안 보이는 회귀가 반복됐던 만큼, "연하다"는 요청에도 불구하고 흰 배경 대비
  // 최소 4.5:1(WCAG AA)을 반드시 유지해야 한다. Node로 WCAG 상대휘도 공식을 이용해
  // #FFFFFF 대비 직접 계산한 실측값(scratchpad/contrast.js 근거):
  //   #8B6F47 → 4.706:1 (AA 통과하지만 여유가 거의 없어 렌더링 오차에 취약)
  //   #7A5C3A → 6.141:1 (AA 여유 있게 통과, 채택)
  //   #6F5738 → 6.782:1
  // 이번엔 회귀 재발을 막기 위해 4.5:1에 아슬아슬한 값 대신 여유 마진이 있는
  // #7A5C3A(6.141:1)를 채택했다.
  '--home-color-primary': '#7A5C3A',
  // 좀 더 밝고 따뜻한 베이지 갈색 포인트 톤(모카보다 한 단계 밝은 캐러멜 브라운) -
  // 아이콘·보더 등 비텍스트 장식 전용(텍스트에 얹지 않으므로 대비 기준 미적용).
  '--home-color-primary-light': '#B08D5F',
  // 아주 연한 베이지 배경 틴트 - 카드 hover, 배지 배경 등 배경색으로만 쓰이므로
  // 대비 기준 미적용.
  '--home-color-primary-soft': '#F3E9D8',
  // 화이트(옐로우 포인트 제거, 2026-09) - 배지·CTA 버튼 등 소면적 포인트 강조 전용.
  // 위에는 반드시 어두운 텍스트(var(--color-text-primary))만 사용한다.
  '--home-color-secondary': '#FFFFFF',
  '--home-color-secondary-soft': '#FFF6CC',
  // 테라코타 - 3차 강조색, 기존 --color-pet과 톤이 가까워 소량만 사용
  '--home-color-accent': '#C55647',
}

export default function HomePage() {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg)',
        maxWidth: '100vw',
        overflowX: 'hidden',
        ...HOME_THEME_VARS,
      }}
    >
      <HomeHero />
      <HomeServices />
      <HomeProcess />
      <HomeTrust />
      <HomeBottomCta />
    </div>
  )
}
