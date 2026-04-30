import { Link } from 'react-router-dom'
import { Camera, Heart, PawPrint, Star, Shield, Clock, Flower2 } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'

const SERVICES = [
  {
    icon: Camera,
    title: 'AI 사진관',
    description: '오래된 사진을 AI로 복원하고, 화질을 개선하며, 컬러라이징까지',
    price: '9,900원/세트',
    to: ROUTES.PHOTO,
    cta: '사진 복원 시작',
    domainColor: 'var(--color-photo)',
    domainBg: 'var(--color-surface-warm)',
  },
  {
    icon: Heart,
    title: 'AI 유언장',
    description: '사진과 음성으로 AI 영상 메시지를 남겨 사랑하는 이에게 전하세요',
    price: '49,000원/건',
    to: ROUTES.WILL,
    cta: '유언장 만들기',
    highlight: true,
    domainColor: 'var(--color-will)',
    domainBg: '#F3EDE4',
  },
  {
    icon: PawPrint,
    title: '반려동물 아카이브',
    description: '소중한 반려동물의 기억을 AI 초상화와 함께 영원히 보관하세요',
    price: '무료 ~ 9,900원/월',
    to: ROUTES.PET,
    cta: '아카이브 시작',
    domainColor: 'var(--color-pet)',
    domainBg: 'var(--color-pet-soft)',
  },
  {
    icon: Flower2,
    title: '추모관',
    description: '고인의 기억을 유가족과 함께 소중히 모아두는 프라이빗 공간',
    price: '무료',
    to: ROUTES.MEMORIAL || '/memorial',
    cta: '추모관 방문',
    domainColor: 'var(--color-memorial)',
    domainBg: '#E8EDF4',
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
    <div style={{ backgroundColor: 'var(--color-bg)', maxWidth: '100vw', overflowX: 'hidden' }}>
      {/* Hero 섹션 */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(160deg, var(--color-primary) 0%, var(--color-primary-soft) 100%)`,
          padding: 'clamp(56px, 10vw, 120px) clamp(16px, 5vw, 48px)',
        }}
      >
        {/* 배경 장식 — 머스터드 골드 광원 */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(ellipse at 75% 25%, rgba(201,162,75,0.18) 0%, transparent 55%)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />

        <div className="relative max-w-3xl mx-auto text-center">
          {/* 서비스 뱃지 */}
          <span
            className="inline-block mb-6"
            style={{
              fontSize: 'var(--fs-caption)',
              fontWeight: 700,
              color: 'var(--color-warm-accent)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            AI 기억 플랫폼
          </span>

          <h1
            className="font-bold leading-tight mb-6"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(28px, 6vw, 48px)',
              fontWeight: 800,
              color: 'var(--color-text-on-dark)',
              letterSpacing: 'var(--ls-heading-ko)',
              lineHeight: 1.3,
              wordBreak: 'keep-all',
            }}
          >
            AI로 간직하는
            <br />
            소중한 기억
          </h1>

          <p
            style={{
              fontSize: 'clamp(var(--fs-body), 2.5vw, var(--fs-body-lg))',
              color: 'rgba(245,239,230,0.82)',
              maxWidth: '520px',
              margin: '0 auto 40px',
              lineHeight: 'var(--lh-relaxed)',
            }}
          >
            빛바랜 사진을 복원하고, 목소리로 유언을 남기고,
            <br className="hidden sm:block" />
            반려동물의 기억을 영원히 보관하세요.
          </p>

          {/* 모바일: 세로 스택 풀너비 / 데스크톱: 가로 나란히 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* Primary CTA — 크림 배경, 차콜 텍스트 */}
            <Link
              to={ROUTES.PHOTO}
              className="flex items-center justify-center font-bold transition-opacity hover:opacity-90"
              style={{
                height: 'var(--size-button-h)',
                width: '100%',
                maxWidth: '320px',
                margin: '0 auto',
                padding: '0 28px',
                fontSize: 'var(--fs-button)',
                backgroundColor: 'var(--color-surface-warm)',
                color: 'var(--color-primary)',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
              }}
            >
              AI 사진관 시작
            </Link>

            {/* Secondary CTA — 아웃라인 */}
            <Link
              to={ROUTES.WILL}
              className="flex items-center justify-center font-bold transition-opacity hover:opacity-90"
              style={{
                height: 'var(--size-button-h)',
                width: '100%',
                maxWidth: '320px',
                margin: '0 auto',
                padding: '0 28px',
                fontSize: 'var(--fs-button)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-on-dark)',
                borderRadius: 'var(--radius-pill)',
                border: '1.5px solid rgba(245,239,230,0.5)',
              }}
            >
              유언장 만들기
            </Link>
          </div>
        </div>
      </section>

      {/* 서비스 4종 카드 섹션 */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <h2
          className="text-center font-bold mb-4 sm:mb-5"
          style={{
            fontSize: 'clamp(22px, 4vw, var(--fs-h2))',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: 'var(--ls-heading-ko)',
            wordBreak: 'keep-all',
          }}
        >
          온담의 서비스
        </h2>
        <p
          className="text-center mb-10 sm:mb-14"
          style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}
        >
          기억을 지키는 네 가지 방법
        </p>

        {/* 모바일 1열 → 태블릿 2열 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {SERVICES.map(({ icon: Icon, title, description, price, to, cta, highlight, domainColor, domainBg }) => (
            <div
              key={title}
              className="flex flex-col overflow-hidden transition-colors"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: highlight
                  ? `1.5px solid var(--color-border-strong)`
                  : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-card)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-warm)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface)'
              }}
            >
              {highlight && (
                <div
                  className="text-center text-sm font-bold py-1.5"
                  style={{
                    backgroundColor: 'var(--color-warm-accent)',
                    color: 'var(--color-surface)',
                    fontSize: 'var(--fs-caption)',
                    letterSpacing: '0.05em',
                  }}
                >
                  인기
                </div>
              )}

              <div className="flex flex-col gap-5 p-6 sm:p-7 flex-1" style={{ minWidth: 0 }}>
                {/* 도메인 컬러 아이콘 영역 */}
                <div
                  className="w-12 h-12 flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: domainBg,
                    borderRadius: 'var(--radius-sm)',
                  }}
                  aria-hidden="true"
                >
                  <Icon size={22} style={{ color: domainColor }} />
                </div>

                <div style={{ minWidth: 0 }}>
                  <h3
                    className="font-bold mb-2"
                    style={{
                      fontSize: 'var(--fs-h3)',
                      color: 'var(--color-text-primary)',
                      letterSpacing: 'var(--ls-heading-ko)',
                      wordBreak: 'keep-all',
                    }}
                  >
                    {title}
                  </h3>
                  <p
                    className="leading-relaxed"
                    style={{
                      fontSize: 'var(--fs-body)',
                      color: 'var(--color-text-secondary)',
                      wordBreak: 'keep-all',
                      paddingRight: '4px',
                    }}
                  >
                    {description}
                  </p>
                </div>

                {/* 가격 — 머스터드 골드 */}
                <div
                  className="font-bold mt-auto"
                  style={{ fontSize: 'var(--fs-body)', color: 'var(--color-warm-accent)' }}
                >
                  {price}
                </div>
              </div>

              <div className="px-6 sm:px-7 pb-6 sm:pb-7">
                <Link
                  to={to}
                  className="block text-center font-semibold transition-opacity hover:opacity-90"
                  style={{
                    height: 'var(--size-button-h)',
                    lineHeight: 'var(--size-button-h)',
                    fontSize: 'var(--fs-button)',
                    backgroundColor: highlight ? 'var(--color-primary)' : 'var(--color-bg-alt)',
                    color: highlight ? 'var(--color-surface)' : 'var(--color-text-primary)',
                    borderRadius: 'var(--radius-pill)',
                    border: highlight ? 'none' : '1px solid var(--color-border)',
                  }}
                >
                  {cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 왜 온담인가 — FEATURES 섹션 */}
      <section
        className="py-14 sm:py-20 lg:py-24"
        style={{ backgroundColor: 'var(--color-bg-alt)' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            className="text-center font-bold mb-4 sm:mb-5"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(22px, 4vw, var(--fs-h2))',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: 'var(--ls-heading-ko)',
              wordBreak: 'keep-all',
            }}
          >
            왜 온담인가요
          </h2>
          <p
            className="text-center mb-10 sm:mb-14"
            style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)', wordBreak: 'keep-all' }}
          >
            온담은 기억이 흐려지지 않도록 곁에 있겠습니다.
          </p>

          {/* 모바일 1열 → 데스크톱 3열 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex flex-col items-center text-center gap-4">
                <div
                  className="w-14 h-14 flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-card)',
                    border: '1px solid var(--color-border)',
                  }}
                  aria-hidden="true"
                >
                  <Icon size={24} style={{ color: 'var(--color-warm-accent)' }} />
                </div>
                <h3
                  className="font-bold"
                  style={{ fontSize: 'var(--fs-h3)', color: 'var(--color-text-primary)', wordBreak: 'keep-all' }}
                >
                  {title}
                </h3>
                <p
                  className="leading-relaxed"
                  style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', wordBreak: 'keep-all' }}
                >
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 하단 CTA 섹션 */}
      <section
        className="py-16 sm:py-24 lg:py-28 text-center px-4 sm:px-6"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <h2
          className="font-bold mb-5 sm:mb-6"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(22px, 4vw, var(--fs-h2))',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: 'var(--ls-heading-ko)',
            wordBreak: 'keep-all',
          }}
        >
          지금 시작하세요
        </h2>
        <p
          style={{
            fontSize: 'var(--fs-body)',
            color: 'var(--color-text-secondary)',
            maxWidth: '400px',
            margin: '0 auto 40px',
            lineHeight: 'var(--lh-relaxed)',
          }}
        >
          소중한 기억은 지금 이 순간에도 희미해지고 있습니다.
        </p>
        {/* 모바일: 풀너비 / 데스크톱: 고정 너비 */}
        <Link
          to={ROUTES.JOIN}
          className="flex items-center justify-center font-bold transition-opacity hover:opacity-90 mx-auto"
          style={{
            height: 'var(--size-button-h)',
            width: '100%',
            maxWidth: '320px',
            padding: '0 40px',
            fontSize: 'var(--fs-button)',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-surface)',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
          }}
        >
          무료로 시작하기
        </Link>
      </section>
    </div>
  )
}
