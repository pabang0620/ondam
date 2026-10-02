import { ArrowRight } from 'lucide-react'
import PetFeatureGrid from './PetFeatureGrid.jsx'
import PetPlanGrid from './PetPlanGrid.jsx'

// subscriptionSlot: 구독 중/확인 불가일 때 Hero 위에 놓일 '내 구독' 영역(없으면 null).
// 해지·결제 문제처럼 바로 봐야 하는 상태라 스크롤 없이 보이도록 맨 위에 둔다.
export default function PetLanding({
  onRegister,
  checkout,
  canSubscribe = false,
  subscriptionStatus = null,
  subscriptionSlot = null,
}) {
  return (
    <>
      {subscriptionSlot && <div className="pet-dash">{subscriptionSlot}</div>}

      {/* Hero */}
      <section className="pet-hero">
        <div className="pet-hero__inner">
          <h1 className="pet-hero__title">
            반려동물의 기억을 간직하세요
          </h1>
          <p className="pet-hero__sub">
            사진은 안전하게 보관하고, AI 초상화로 추억을 남기세요.
          </p>
          <button className="pet-hero__cta" onClick={onRegister}>
            반려동물 등록하기
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* 기능 소개 */}
      <section className="pet-features">
        <div className="pet-features__inner">
          <h2 className="pet-features__title">온담이 반려동물과의 추억을 간직하는 방법</h2>
          <PetFeatureGrid />
        </div>
      </section>

      {/* 구독 플랜 */}
      <section className="pet-section pet-section--accent">
        <div className="pet-section__inner">
          <h2 className="pet-section__title">구독 플랜</h2>
          <p className="pet-section__sub">소중한 기억만큼 합리적인 가격으로 시작하세요.</p>
          <PetPlanGrid checkout={checkout} canSubscribe={canSubscribe} status={subscriptionStatus} />
        </div>
      </section>
    </>
  )
}
