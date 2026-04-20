import { useNavigate, Link } from 'react-router-dom'
import {
  Heart,
  PawPrint,
  Image,
  Sparkles,
  ArrowRight,
  Plus,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore.js'
import { usePet } from './usePet.js'
import { ROUTES } from '../../constants/routes.js'
import './PetPage.css'

const PLANS = [
  {
    key: 'free',
    label: '무료',
    price: '0원',
    features: ['반려동물 1마리 등록', '사진 10장 보관', '기본 프로필 페이지'],
    highlight: false,
  },
  {
    key: 'standard',
    label: '스탠다드',
    price: '4,900원/월',
    features: ['반려동물 3마리', '사진 100장 보관', 'AI 초상화 1회', '추모 페이지 공개'],
    highlight: true,
  },
  {
    key: 'premium',
    label: '프리미엄',
    price: '9,900원/월',
    features: ['무제한 반려동물', '사진 무제한', 'AI 초상화 무제한', '추모 페이지 공개', '전용 슬러그'],
    highlight: false,
  },
]

const FEATURES = [
  { icon: PawPrint, title: '반려동물 프로필', desc: '이름, 종류, 생일 등 소중한 정보를 기록합니다.' },
  { icon: Image, title: '사진 아카이브', desc: '함께한 순간의 사진을 안전하게 보관합니다.' },
  { icon: Sparkles, title: 'AI 초상화', desc: '사진을 유화·수채화·일러스트로 변환합니다.' },
  { icon: Heart, title: '추모 페이지', desc: '무지개다리를 건넌 후에도 기억을 이어갑니다.' },
]

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="pet-feature-card">
      <div className="pet-feature-card__icon">
        <Icon size={24} color="var(--color-primary)" aria-hidden="true" />
      </div>
      <p className="pet-feature-card__title">{title}</p>
      <p className="pet-feature-card__desc">{desc}</p>
    </div>
  )
}

function PlanCard({ plan, onSelect }) {
  return (
    <div className={`pet-plan-card${plan.highlight ? ' pet-plan-card--highlight' : ''}`}>
      {plan.highlight && <span className="pet-plan-card__badge">인기</span>}
      <p className="pet-plan-card__label">{plan.label}</p>
      <p className="pet-plan-card__price">{plan.price}</p>
      <ul className="pet-plan-card__features">
        {plan.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <button
        className={`pet-plan-card__btn${plan.highlight ? ' pet-plan-card__btn--primary' : ''}`}
        onClick={() => onSelect(plan.key)}
        aria-label={`${plan.label} 플랜 선택`}
      >
        선택하기
      </button>
    </div>
  )
}

function PetListItem({ pet }) {
  const navigate = useNavigate()
  const SPECIES_LABEL = {
    dog: '강아지', cat: '고양이', rabbit: '토끼',
    bird: '새', hamster: '햄스터', fish: '물고기',
    reptile: '파충류', other: '기타',
  }

  return (
    <button
      className="pet-list-item"
      onClick={() => navigate(`/pet/${pet.pet_id}`)}
      aria-label={`${pet.name} 상세 보기`}
    >
      <div className="pet-list-item__avatar">
        {pet.profile_image_url
          ? (
            <img
              src={pet.profile_image_url}
              alt={pet.name}
              onError={(e) => { e.target.onerror = null; e.target.src = '' }}
            />
          )
          : <PawPrint size={28} color="var(--color-primary)" aria-hidden="true" />}
      </div>
      <div className="pet-list-item__info">
        <span className="pet-list-item__name">{pet.name}</span>
        <span className="pet-list-item__species">{SPECIES_LABEL[pet.species] || pet.species}</span>
        {pet.pet_status === 'deceased' && (
          <span className="pet-list-item__badge">무지개다리</span>
        )}
      </div>
      <ArrowRight size={18} color="var(--color-text-muted)" aria-hidden="true" />
    </button>
  )
}

export default function PetPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore((s) => ({ isAuthenticated: s.isAuthenticated }))
  const { pets, isLoading } = usePet()

  const handlePlanSelect = (plan) => {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN)
      return
    }
    navigate(ROUTES.PET_SUBSCRIPTION, { state: { selectedPlan: plan } })
  }

  const handleRegister = () => {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN)
      return
    }
    navigate(ROUTES.PET_NEW)
  }

  return (
    <main className="pet-page">
      {/* Hero */}
      <section className="pet-hero">
        <div className="pet-hero__inner">
          <Heart className="pet-hero__icon" size={48} aria-hidden="true" />
          <h1 className="pet-hero__title">
            소중한 반려동물의<br />기억을 간직하세요
          </h1>
          <p className="pet-hero__sub">
            함께한 순간의 사진을 안전하게 보관하고,<br />
            AI 초상화로 특별한 추억을 만들어 드립니다.
          </p>
          <button className="pet-hero__cta" onClick={handleRegister}>
            반려동물 등록하기
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* 기능 소개 */}
      <section className="pet-section">
        <div className="pet-section__inner">
          <h2 className="pet-section__title">반려동물 아카이브 기능</h2>
          <div className="pet-features-grid">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* 구독 플랜 */}
      <section className="pet-section pet-section--accent">
        <div className="pet-section__inner">
          <h2 className="pet-section__title">구독 플랜</h2>
          <p className="pet-section__sub">소중한 기억만큼 합리적인 가격으로 시작하세요.</p>
          <div className="pet-plans-grid">
            {PLANS.map((plan) => (
              <PlanCard key={plan.key} plan={plan} onSelect={handlePlanSelect} />
            ))}
          </div>
        </div>
      </section>

      {/* 등록된 반려동물 목록 */}
      {isAuthenticated && (
        <section className="pet-section">
          <div className="pet-section__inner">
            <div className="pet-list-header">
              <h2 className="pet-section__title" style={{ marginBottom: 0 }}>내 반려동물</h2>
              <button className="pet-list-add" onClick={handleRegister} aria-label="반려동물 추가">
                <Plus size={18} aria-hidden="true" />
                추가
              </button>
            </div>

            {isLoading && (
              <p className="pet-list-empty">불러오는 중...</p>
            )}

            {!isLoading && pets.length === 0 && (
              <p className="pet-list-empty">아직 등록된 반려동물이 없습니다.</p>
            )}

            {!isLoading && pets.length > 0 && (
              <div className="pet-list">
                {pets.map((pet) => (
                  <PetListItem key={pet.pet_id} pet={pet} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
