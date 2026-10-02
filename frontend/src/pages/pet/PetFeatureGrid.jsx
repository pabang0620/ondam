import { Heart, PawPrint, Image, Sparkles } from 'lucide-react'

const FEATURES = [
  { icon: PawPrint, tone: 'orange', title: '반려동물 프로필', desc: '이름, 종류, 생일 등 소중한 정보를 기록합니다.' },
  { icon: Image, tone: 'sky', title: '사진 아카이브', desc: '함께한 순간의 사진을 안전하게 보관합니다.' },
  { icon: Sparkles, tone: 'amber', title: 'AI 초상화', desc: '사진을 유화·수채화·일러스트로 변환합니다.' },
  { icon: Heart, tone: 'red', title: '추모 페이지', desc: '무지개다리를 건넌 후에도 기억을 이어갑니다.' },
]

function FeatureCard({ icon: Icon, tone, title, desc }) {
  return (
    <div className="pet-feature-card">
      <div className="pet-feature-card__icon" data-icon-tone={tone}>
        <Icon size={24} aria-hidden="true" />
      </div>
      <h3 className="pet-feature-card__title">{title}</h3>
      <p className="pet-feature-card__desc">{desc}</p>
    </div>
  )
}

export default function PetFeatureGrid() {
  return (
    <div className="pet-features__grid">
      {FEATURES.map((f) => (
        <FeatureCard key={f.title} {...f} />
      ))}
    </div>
  )
}
