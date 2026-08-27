import HomeHero from './HomeHero.jsx'
import HomeLatestCarousel from './HomeLatestCarousel.jsx'
import HomeServices from './HomeServices.jsx'
import HomeProcess from './HomeProcess.jsx'
import HomeTrust from './HomeTrust.jsx'
import HomeBottomCta from './HomeBottomCta.jsx'

// DEV-13: 랜딩 섹션 구성 (위→아래)
// 1. Hero (태그라인·주/부 CTA)
// 1-1. 서비스 카드 캐러셀 (애플 스토어 "최신 제품" 섹션 참고 - 5종 한눈에 훑어보기)
// 2. 상품 3종 - 가격 전면 공개
// 3. 제작 과정 안내 - 실물 전후비교 자산 없음, 텍스트로 대체(플레이스홀더)
// 4. 정직과 신뢰 - 03/07 문서 확정 문구
// 5. 하단 CTA (사진관 재유도)
export default function HomePage() {
  return (
    <div style={{ backgroundColor: 'var(--color-bg)', maxWidth: '100vw', overflowX: 'hidden' }}>
      <HomeHero />
      <HomeLatestCarousel />
      <HomeServices />
      <HomeProcess />
      <HomeTrust />
      <HomeBottomCta />
    </div>
  )
}
