import { Link } from 'react-router-dom'
import { Camera, Heart, PawPrint, Star, Shield, Clock } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'

const SERVICES = [
  {
    icon: Camera,
    title: 'AI 사진관',
    description: '오래된 사진을 AI로 복원하고, 화질을 개선하며, 컬러라이징까지',
    price: '9,900원/세트',
    to: ROUTES.PHOTO,
    cta: '사진 복원 시작',
  },
  {
    icon: Heart,
    title: 'AI 유언장',
    description: '사진과 음성으로 AI 영상 메시지를 남겨 사랑하는 이에게 전하세요',
    price: '49,000원/건',
    to: ROUTES.WILL,
    cta: '유언장 만들기',
    highlight: true,
  },
  {
    icon: PawPrint,
    title: '반려동물 아카이브',
    description: '소중한 반려동물의 기억을 AI 초상화와 함께 영원히 보관하세요',
    price: '무료 ~ 9,900원/월',
    to: ROUTES.PET,
    cta: '아카이브 시작',
  },
]

const FEATURES = [
  {
    icon: Star,
    title: '최첨단 AI 기술',
    description: 'OpenAI, ElevenLabs 등 세계 최고 수준의 AI로 기억을 되살립니다.',
  },
  {
    icon: Shield,
    title: '철저한 보안',
    description: '소중한 사진과 음성은 AWS KMS 암호화로 안전하게 보관됩니다.',
  },
  {
    icon: Clock,
    title: '영원히 간직',
    description: '한번 만들어진 기억은 사라지지 않습니다. 언제든 꺼내볼 수 있습니다.',
  },
]

export default function HomePage() {
  return (
    <div style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Hero 섹션 */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 60%, var(--color-primary-light) 100%)`,
          padding: 'clamp(60px, 10vw, 120px) 16px',
        }}
      >
        {/* 배경 장식 */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 70% 30%, var(--color-gold) 0%, transparent 50%)',
          }}
          aria-hidden="true"
        />

        <div className="relative max-w-3xl mx-auto text-center">
          <h1
            className="font-bold leading-tight mb-6"
            style={{
              fontSize: 'clamp(28px, 5vw, 52px)',
              color: 'var(--color-surface)',
              letterSpacing: '-0.02em',
            }}
          >
            AI로 간직하는
            <br />
            소중한 기억
          </h1>
          <p
            className="mb-10 leading-relaxed"
            style={{
              fontSize: 'clamp(16px, 2.5vw, 20px)',
              color: 'rgba(255,255,255,0.85)',
              maxWidth: '520px',
              margin: '0 auto 40px',
            }}
          >
            빛바랜 사진을 복원하고, 목소리로 유언을 남기고,
            <br className="hidden sm:block" />
            반려동물의 기억을 영원히 보관하세요.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={ROUTES.PHOTO}
              className="inline-flex items-center justify-center rounded-xl font-bold transition-transform hover:scale-105"
              style={{
                minHeight: 'var(--min-touch-target)',
                minWidth: '160px',
                padding: '0 28px',
                fontSize: 'var(--font-size-lg)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-primary)',
              }}
            >
              AI 사진관 시작
            </Link>
            <Link
              to={ROUTES.WILL}
              className="inline-flex items-center justify-center rounded-xl font-bold transition-all hover:scale-105"
              style={{
                minHeight: 'var(--min-touch-target)',
                minWidth: '160px',
                padding: '0 28px',
                fontSize: 'var(--font-size-lg)',
                backgroundColor: 'transparent',
                color: 'var(--color-surface)',
                border: '2px solid rgba(255,255,255,0.6)',
              }}
            >
              유언장 만들기
            </Link>
          </div>
        </div>
      </section>

      {/* 서비스 3종 카드 섹션 */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2
          className="text-center font-bold mb-12"
          style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-text-primary)' }}
        >
          온담의 서비스
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SERVICES.map(({ icon: Icon, title, description, price, to, cta, highlight }) => (
            <div
              key={title}
              className="flex flex-col rounded-2xl overflow-hidden transition-transform hover:-translate-y-1"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: highlight
                  ? '2px solid var(--color-primary)'
                  : '1px solid var(--color-border)',
                boxShadow: highlight ? '0 4px 24px rgba(139,115,85,0.15)' : '0 1px 6px rgba(0,0,0,0.04)',
              }}
            >
              {highlight && (
                <div
                  className="text-center text-sm font-bold py-1.5"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-surface)',
                  }}
                >
                  인기
                </div>
              )}
              <div className="flex flex-col gap-4 p-6 flex-1">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                  aria-hidden="true"
                >
                  <Icon size={24} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <h3
                    className="font-bold mb-2"
                    style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text-primary)' }}
                  >
                    {title}
                  </h3>
                  <p
                    className="leading-relaxed"
                    style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}
                  >
                    {description}
                  </p>
                </div>
                <div
                  className="font-bold mt-auto"
                  style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-gold)' }}
                >
                  {price}
                </div>
              </div>
              <div className="px-6 pb-6">
                <Link
                  to={to}
                  className="block text-center rounded-xl font-semibold transition-opacity hover:opacity-90"
                  style={{
                    minHeight: 'var(--min-touch-target)',
                    lineHeight: 'var(--min-touch-target)',
                    fontSize: 'var(--font-size-base)',
                    backgroundColor: highlight ? 'var(--color-primary)' : 'var(--color-accent)',
                    color: highlight ? 'var(--color-surface)' : 'var(--color-primary)',
                  }}
                >
                  {cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 신뢰 섹션 */}
      <section
        className="py-16"
        style={{ backgroundColor: 'var(--color-accent)' }}
      >
        <div className="max-w-5xl mx-auto px-4">
          <h2
            className="text-center font-bold mb-4"
            style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary-dark)' }}
          >
            소중한 순간을 영원히
          </h2>
          <p
            className="text-center mb-12"
            style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-secondary)' }}
          >
            온담은 기억이 흐려지지 않도록 곁에 있겠습니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex flex-col items-center text-center gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                  aria-hidden="true"
                >
                  <Icon size={26} color="white" />
                </div>
                <h3
                  className="font-bold"
                  style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text-primary)' }}
                >
                  {title}
                </h3>
                <p
                  className="leading-relaxed"
                  style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}
                >
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 하단 CTA 섹션 */}
      <section className="py-20 text-center px-4">
        <h2
          className="font-bold mb-4"
          style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-text-primary)' }}
        >
          지금 시작하세요
        </h2>
        <p
          className="mb-8"
          style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-secondary)' }}
        >
          소중한 기억은 지금 이 순간에도 희미해지고 있습니다.
        </p>
        <Link
          to={ROUTES.JOIN}
          className="inline-flex items-center justify-center rounded-xl font-bold transition-transform hover:scale-105"
          style={{
            minHeight: 'var(--min-touch-target)',
            minWidth: '200px',
            padding: '0 36px',
            fontSize: 'var(--font-size-xl)',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-surface)',
          }}
        >
          무료로 시작하기
        </Link>
      </section>
    </div>
  )
}
