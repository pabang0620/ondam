import { useNavigate } from 'react-router-dom'
import { Sparkles, Palette, Scissors, Briefcase, ArrowRight } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'

const FEATURES = [
  {
    icon: Sparkles,
    title: '화질 복원',
    desc: '흐릿하고 손상된 사진을 선명하게 복원합니다.',
  },
  {
    icon: Palette,
    title: '흑백 컬러',
    desc: '흑백 사진에 자연스러운 색채를 입혀 드립니다.',
  },
  {
    icon: Scissors,
    title: '배경 제거',
    desc: '배경을 깔끔하게 제거하고 원하는 배경으로 교체합니다.',
  },
  {
    icon: Briefcase,
    title: '정장 착용',
    desc: '단정한 정장을 입힌 증명·장례 사진을 만들어 드립니다.',
  },
]

const PHOTO_TYPES = [
  { type: 'funeral', label: '장례 사진', desc: '고인의 영정 사진을 단정하게 보정합니다.' },
  { type: 'id', label: '증명 사진', desc: '증명사진 규격에 맞게 배경·복장을 정리합니다.' },
  { type: 'job', label: '취업 사진', desc: '취업용 사진을 깔끔하고 전문적으로 만듭니다.' },
]

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--spacing-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-sm)',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-alt)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={24} color="var(--color-photo)" />
      </div>
      <p style={{ fontWeight: 700, fontSize: 'var(--fs-body-lg)', color: 'var(--color-text-primary)', letterSpacing: 'var(--ls-heading-ko)' }}>{title}</p>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-relaxed)' }}>
        {desc}
      </p>
    </div>
  )
}

function PhotoTypeCard({ type, label, desc, onClick }) {
  return (
    <button
      onClick={() => onClick(type)}
      style={{
        background: 'var(--color-surface)',
        border: '2px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--spacing-lg)',
        cursor: 'pointer',
        textAlign: 'left',
        minHeight: 'var(--size-button-h)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        transition: 'border-color var(--transition-base), background-color var(--transition-base)',
        width: '100%',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-photo)'
        e.currentTarget.style.backgroundColor = 'var(--color-bg-alt)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border)'
        e.currentTarget.style.backgroundColor = 'var(--color-surface)'
      }}
    >
      <div>
        <p style={{ fontWeight: 700, fontSize: 'var(--fs-body-lg)', marginBottom: 4, color: 'var(--color-text-primary)', letterSpacing: 'var(--ls-heading-ko)' }}>{label}</p>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-body)' }}>{desc}</p>
      </div>
      <ArrowRight size={20} color="var(--color-photo)" style={{ flexShrink: 0 }} />
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
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: 'var(--spacing-xl) var(--spacing-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-2xl)',
        background: 'var(--color-bg)',
      }}
    >
      {/* Hero */}
      <section style={{ textAlign: 'center', padding: 'var(--spacing-xl) 0' }}>
        <h1
          style={{
            fontSize: 'var(--fs-h1)',
            fontWeight: 800,
            color: 'var(--color-photo)',
            lineHeight: 1.35,
            marginBottom: 'var(--spacing-md)',
            letterSpacing: 'var(--ls-heading-ko)',
          }}
        >
          AI가 되살리는<br />소중한 순간
        </h1>
        <p
          style={{
            fontSize: 'var(--fs-body-lg)',
            color: 'var(--color-text-secondary)',
            lineHeight: 'var(--lh-relaxed)',
            maxWidth: 480,
            margin: '0 auto',
          }}
        >
          오래되어 빛바랜 사진, 흐릿해진 기억을 AI가 선명하게 복원합니다.
          소중한 분의 사진을 가장 아름다운 모습으로 간직하세요.
        </p>
      </section>

      {/* 기능 카드 */}
      <section>
        <h2
          style={{
            fontSize: 'var(--fs-h2)',
            fontWeight: 700,
            marginBottom: 'var(--spacing-lg)',
            color: 'var(--color-text-primary)',
            letterSpacing: 'var(--ls-heading-ko)',
          }}
        >
          제공 기능
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--spacing-md)',
          }}
        >
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      {/* 사진 타입 선택 */}
      <section>
        <h2
          style={{
            fontSize: 'var(--fs-h2)',
            fontWeight: 700,
            marginBottom: 'var(--spacing-sm)',
            color: 'var(--color-text-primary)',
            letterSpacing: 'var(--ls-heading-ko)',
          }}
        >
          어떤 사진이 필요하신가요?
        </h2>
        <p
          style={{
            fontSize: 'var(--fs-body)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--spacing-lg)',
            lineHeight: 'var(--lh-relaxed)',
          }}
        >
          사진 종류를 선택하시면 바로 시작할 수 있습니다.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {PHOTO_TYPES.map((item) => (
            <PhotoTypeCard key={item.type} {...item} onClick={handleTypeSelect} />
          ))}
        </div>
      </section>

      {/* 가격 + 시작 버튼 */}
      <section
        style={{
          background: 'var(--color-surface-warm)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-xl)',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
          1세트 가격
        </p>
        <p
          style={{
            fontSize: 36,
            fontWeight: 800,
            color: 'var(--color-photo)',
            marginBottom: 'var(--spacing-lg)',
            letterSpacing: 'var(--ls-heading-ko)',
          }}
        >
          9,900원
        </p>
        <button
          onClick={handleStart}
          style={{
            background: 'var(--color-photo)',
            color: 'var(--color-text-on-dark)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            padding: '0 var(--spacing-2xl)',
            height: 'var(--size-button-h)',
            minHeight: 'var(--size-button-h)',
            fontSize: 'var(--fs-button)',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            transition: 'opacity var(--transition-base)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          지금 시작하기 <ArrowRight size={20} />
        </button>
      </section>
    </main>
  )
}

export default PhotoPage
