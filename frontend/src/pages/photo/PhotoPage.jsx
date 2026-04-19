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
        borderRadius: 'var(--radius-lg)',
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
          background: 'var(--color-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={24} color="var(--color-primary)" />
      </div>
      <p style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>{title}</p>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)', lineHeight: 1.6 }}>
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
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-lg)',
        cursor: 'pointer',
        textAlign: 'left',
        minHeight: 'var(--min-touch-target)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        transition: 'border-color 0.2s, background 0.2s',
        width: '100%',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-primary)'
        e.currentTarget.style.background = 'var(--color-accent)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border)'
        e.currentTarget.style.background = 'var(--color-surface)'
      }}
    >
      <div>
        <p style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', marginBottom: 4 }}>{label}</p>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>{desc}</p>
      </div>
      <ArrowRight size={20} color="var(--color-primary)" style={{ flexShrink: 0 }} />
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
      }}
    >
      {/* Hero */}
      <section style={{ textAlign: 'center', padding: 'var(--spacing-xl) 0' }}>
        <p
          style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 800,
            color: 'var(--color-primary-dark)',
            lineHeight: 1.4,
            marginBottom: 'var(--spacing-md)',
          }}
        >
          AI가 되살리는<br />소중한 순간
        </p>
        <p
          style={{
            fontSize: 'var(--font-size-lg)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.7,
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
        <p
          style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 700,
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          제공 기능
        </p>
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
        <p
          style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 700,
            marginBottom: 'var(--spacing-sm)',
          }}
        >
          어떤 사진이 필요하신가요?
        </p>
        <p
          style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--spacing-lg)',
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
          background: 'var(--color-accent)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-xl)',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
          1세트 가격
        </p>
        <p
          style={{
            fontSize: 36,
            fontWeight: 800,
            color: 'var(--color-primary-dark)',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          9,900원
        </p>
        <button
          onClick={handleStart}
          style={{
            background: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            padding: '0 var(--spacing-2xl)',
            minHeight: 'var(--min-touch-target)',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
          }}
        >
          지금 시작하기 <ArrowRight size={20} />
        </button>
      </section>
    </main>
  )
}

export default PhotoPage
