import { Link } from 'react-router-dom'
import { Camera, Heart, PawPrint } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'
import LegalNotice from '../../components/common/LegalNotice.jsx'

// DEV-13: 상품 3종만 노출한다. 추모관은 03 문서 1절 "④ 추모관(부속 기능, 비상품) -
// 독립 판매하지 않는다"에 따라 랜딩의 판매 카드에서 제외한다(구매자 보관 공간일 뿐).
// 이벤트 영상(19,900원)은 03 문서 결정으로 판매 보류 - 홈에 노출하지 않는다.
const SERVICES = [
  {
    icon: Camera,
    title: 'AI 사진관',
    description: '빛바랜 사진 한 장이면 충분해요. 복원하고, 색을 입히고, 배경까지 정리해 드려요.',
    price: '9,900원',
    priceNote: '결과물 4종 세트',
    to: ROUTES.PHOTO,
    cta: '9,900원으로 시작하기',
    highlight: true,
    domainColor: 'var(--color-photo)',
    domainBg: 'var(--color-surface-warm)',
  },
  {
    icon: Heart,
    title: '마지막 영상 편지',
    description: '사진 한 장과 목소리로 짧은 영상 편지를 만들어, 지정한 분께 전해드려요.',
    price: '49,000원',
    priceNote: '베이직 · 영상 1편',
    to: ROUTES.WILL,
    cta: '영상 편지 알아보기',
    domainColor: 'var(--color-will)',
    domainBg: '#F3EDE4',
  },
  {
    icon: PawPrint,
    title: '반려동물 아카이브',
    description: '함께한 사진을 모아두고, AI 초상화로 반려동물의 모습을 오래 간직하세요.',
    price: '4,900원',
    priceNote: '월 · AI 초상화 3매 포함',
    to: ROUTES.PET,
    cta: '아카이브 시작',
    domainColor: 'var(--color-pet)',
    domainBg: 'var(--color-pet-soft)',
  },
]

export default function HomeServices() {
  return (
    <section className="w-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24">
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
          className="text-center mb-12 sm:mb-16"
          style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)', wordBreak: 'keep-all' }}
        >
          가격은 문의 없이 바로 확인하실 수 있어요. 결제 전에 무엇을 받으시는지 미리 알려드려요.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          {SERVICES.map(({ icon: Icon, title, description, price, priceNote, to, cta, highlight, domainColor, domainBg }) => (
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
                  가장 먼저 해보세요
                </div>
              )}

              <div className="flex flex-col gap-5 p-7 sm:p-8 flex-1" style={{ minWidth: 0 }}>
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

                {/* 가격 - 크고 명확하게 */}
                <div className="mt-auto">
                  <div
                    className="font-bold"
                    style={{ fontSize: 'var(--fs-h3)', color: 'var(--color-warm-accent)' }}
                  >
                    {price}
                  </div>
                  <div
                    style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-secondary)' }}
                  >
                    {priceNote}
                  </div>
                </div>
              </div>

              <div className="px-7 sm:px-8 pb-7 sm:pb-8">
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

        {/* 법적 유언 효력 없음 고지 - DEV-05. "마지막 영상 편지" 소개 직후,
            결제 유입 동선(카드 CTA)을 누르기 전에 안내한다. 3개 상품 중
            영상 편지 한정 고지임을 먼저 밝혀 오인을 막는다 */}
        <div className="max-w-xl mx-auto mt-8 sm:mt-10">
          <p
            className="text-center mb-2"
            style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}
          >
            마지막 영상 편지 안내
          </p>
          <LegalNotice theme="light" />
        </div>
      </div>
    </section>
  )
}
