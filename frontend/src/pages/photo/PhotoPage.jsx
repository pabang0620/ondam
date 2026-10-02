import { useNavigate } from 'react-router-dom'
import { Sparkles, Palette, Scissors, Briefcase, Flower2, IdCard, BriefcaseBusiness, ArrowRight, ListChecks, Images, Archive } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'
import './PhotoPage.css'

const FEATURES = [
  {
    icon: Sparkles,
    tone: 'amber',
    title: '화질 복원',
    desc: '흐릿하고 손상된 사진을 선명하게 복원합니다.',
  },
  {
    icon: Palette,
    tone: 'rose',
    title: '흑백 컬러',
    desc: '흑백 사진에 자연스러운 색채를 입혀 드립니다.',
  },
  {
    icon: Scissors,
    tone: 'teal',
    title: '배경 제거',
    desc: '배경을 깔끔하게 제거하고 원하는 배경으로 교체합니다.',
  },
  {
    icon: Briefcase,
    tone: 'navy',
    title: '정장 착용',
    desc: '단정한 정장을 입힌 증명·장례 사진을 만들어 드립니다.',
  },
]

const PHOTO_TYPES = [
  { type: 'funeral', icon: Flower2, label: '장례 사진', desc: '고인의 영정 사진을 단정하게 보정합니다.' },
  { type: 'id', icon: IdCard, label: '증명 사진', desc: '증명사진 규격에 맞게 배경·복장을 정리합니다.' },
  { type: 'job', icon: BriefcaseBusiness, label: '취업 사진', desc: '취업용 사진을 깔끔하고 전문적으로 만듭니다.' },
]

// 결과물 4장: backend photoResultSet.js VARIANT_DEFS (용도 3종 모두 동일)
const PRICING_INCLUDES = [
  { icon: ListChecks, text: '용도 1가지를 선택해 주문해요' },
  { icon: Images, text: '결과물 4장 세트를 받아요' },
  { icon: Archive, text: '결과물은 내 보관함에 자동으로 저장돼요' },
]

function FeatureCard({ icon: Icon, tone, title, desc }) {
  return (
    <div className="photo-feature-card">
      <div className="photo-feature-card__icon" data-icon-tone={tone}>
        <Icon size={24} aria-hidden="true" />
      </div>
      <h3 className="photo-feature-card__title">{title}</h3>
      <p className="photo-feature-card__desc">{desc}</p>
    </div>
  )
}

function PhotoTypeCard({ type, icon: Icon, label, desc, onClick }) {
  return (
    <button type="button" className="photo-type-card" onClick={() => onClick(type)}>
      <span className="photo-type-card__body">
        <span className="photo-type-card__label">{label}</span>
        <span className="photo-type-card__desc">{desc}</span>
      </span>
      <span className="photo-type-card__footer">
        <span className="photo-type-card__cta">
          <span className="photo-type-card__cta-text">시작하기</span>
          <ArrowRight className="photo-type-card__cta-icon" size={18} aria-hidden="true" />
        </span>
        <span className="photo-type-card__icon">
          <Icon size={28} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </span>
    </button>
  )
}

function PhotoPage() {
  const navigate = useNavigate()

  const handleTypeSelect = (type) => {
    navigate(ROUTES.PHOTO_ORDER, { state: { photoType: type } })
  }

  const handleStart = () => {
    navigate(ROUTES.PHOTO_ORDER)
  }

  return (
    <div className="photo-page">
      {/* Hero */}
      <section className="photo-hero">
        <div className="photo-hero__inner">
          <h1 className="photo-hero__title">
            필요한 순간의 사진, 단정하게 완성해요
          </h1>
          <p className="photo-hero__sub">
            증명·취업·장례 사진을 AI로 깔끔하게 만들어 드려요
          </p>
          <button className="photo-hero__cta" type="button" onClick={handleStart}>
            사진 만들어 보기
          </button>
        </div>
      </section>

      {/* 기능 카드 */}
      <section className="photo-features">
        <div className="photo-features__inner">
          <h2 className="photo-features__title">온담 AI 사진관이 전하는 새로운 순간</h2>
          <div className="photo-features__grid">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* 사진 타입 선택 */}
      <section className="photo-section">
        <div className="photo-section__inner photo-section__inner--wide">
          <h2 className="photo-section__title">어떤 사진이 필요하신가요?</h2>
          <p className="photo-section__sub">사진 종류를 선택하시면 바로 시작할 수 있습니다.</p>
          <div className="photo-type-list">
            {PHOTO_TYPES.map((item) => (
              <PhotoTypeCard key={item.type} {...item} onClick={handleTypeSelect} />
            ))}
          </div>
        </div>
      </section>

      {/* 가격 + 시작 버튼 */}
      <section className="photo-pricing">
        <div className="photo-pricing__inner">
          <article className="photo-pricing__card">
            <h2 className="photo-pricing__label">1세트 가격</h2>
            <p className="photo-pricing__main">
              <span className="photo-pricing__price">9,900원</span>
              <span className="photo-pricing__unit">/ 1회</span>
            </p>
            <button className="photo-pricing__cta" type="button" onClick={handleStart}>
              지금 시작하기
            </button>
            <ul className="photo-pricing__includes">
              {PRICING_INCLUDES.map(({ icon: Icon, text }) => (
                <li key={text} className="photo-pricing__include">
                  <Icon className="photo-pricing__check" size={20} aria-hidden="true" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </div>
  )
}

export default PhotoPage
