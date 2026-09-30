import { Link } from 'react-router-dom'
import { Camera, Heart, PawPrint, Sparkles, Play, Image as ImageIcon, Mic } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'
import LegalNotice from '../../components/common/LegalNotice.jsx'

// DEV-13: 상품 3종만 노출한다. 추모관은 03 문서 1절 "④ 추모관(부속 기능, 비상품) -
// 독립 판매하지 않는다"에 따라 랜딩의 판매 카드에서 제외한다(구매자 보관 공간일 뿐).
// 이벤트 영상(19,900원)은 03 문서 결정으로 판매 보류 - 홈에 노출하지 않는다.
//
// 레이아웃: 미리캔버스(colorize) 레퍼런스처럼 "좌우 교차 2단 블록" 3개를 세로로
// 배치한다(좁은 3열 카드 그리드 금지). 각 블록은 HomeProcess.jsx와 동일하게
// max-w-6xl 컨테이너 + grid-cols-1 lg:grid-cols-2 구조를 쓰되, 목업은 서비스별로
// 다르게 그린다(실제 스크린샷 자산이 없으므로 CSS/아이콘 조합만 사용, PLACEHOLDER
// 안내는 HomeProcess.jsx 상단 주석 참고).
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
    mockup: 'photo',
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
    mockup: 'will',
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
    mockup: 'pet',
  },
]

// 사진관 목업: 보정 전/후 미니 비교 카드
function PhotoMockup({ domainColor, domainBg }) {
  return (
    <div
      className="w-full mx-auto"
      style={{
        maxWidth: '440px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-alt)' }}
      >
        <Camera size={16} style={{ color: domainColor }} />
        {/* FIX: bg-alt 헤더 바 위 텍스트 대비(AA) - text-secondary 4.1:1 → primary-soft 8.2:1 */}
        <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--color-primary-soft)' }}>
          사진 보정 전후 비교
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3" style={{ padding: '22px' }}>
        <div>
          <div
            className="flex items-center justify-center"
            style={{
              aspectRatio: '3 / 4',
              borderRadius: 'var(--radius-card)',
              backgroundColor: 'var(--color-bg-alt)',
              filter: 'grayscale(1) contrast(0.7)',
            }}
          >
            <ImageIcon size={30} style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <span
            className="block text-center mt-2 font-bold"
            style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}
          >
            보정 전
          </span>
        </div>
        <div>
          <div
            className="flex items-center justify-center"
            style={{ aspectRatio: '3 / 4', borderRadius: 'var(--radius-card)', backgroundColor: domainBg }}
          >
            <ImageIcon size={30} style={{ color: domainColor }} />
          </div>
          <span className="block text-center mt-2 font-bold" style={{ fontSize: 'var(--fs-caption)', color: domainColor }}>
            보정 후
          </span>
        </div>
      </div>
      <div
        className="flex items-center gap-2"
        style={{ padding: '0 22px 22px' }}
      >
        <Sparkles size={16} style={{ color: domainColor }} />
        <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
          복원 · 컬러화 · 배경 정리 완료
        </span>
      </div>
    </div>
  )
}

// 영상 편지 목업: 재생 버튼이 있는 영상 카드
function WillMockup({ domainColor, domainBg }) {
  return (
    <div
      className="w-full mx-auto"
      style={{
        maxWidth: '440px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{ aspectRatio: '16 / 10', backgroundColor: domainBg, position: 'relative' }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-surface)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <Play size={26} style={{ color: domainColor, marginLeft: '3px' }} fill={domainColor} />
        </div>
        <span
          style={{
            position: 'absolute',
            bottom: '14px',
            right: '14px',
            fontSize: 'var(--fs-caption)',
            fontWeight: 700,
            color: 'var(--color-surface)',
            // FIX: 0.45 → 0.7 (흰 글자 대비 약 3.9:1 → 7:1 이상)
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
          }}
        >
          00:42
        </span>
      </div>
      <div style={{ padding: '20px 22px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '10px' }}>
          <Mic size={16} style={{ color: domainColor }} />
          <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
            목소리 녹음 완료
          </span>
        </div>
        <div className="flex items-center gap-1" aria-hidden="true">
          {[8, 16, 10, 22, 14, 26, 12, 18, 9, 20, 15, 24].map((h, i) => (
            <span
              key={i}
              style={{ width: '4px', height: `${h}px`, borderRadius: '2px', backgroundColor: domainColor, opacity: 0.6 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// 반려동물 아카이브 목업: 사진 그리드 + AI 초상화 배지
function PetMockup({ domainColor, domainBg }) {
  return (
    <div
      className="w-full mx-auto"
      style={{
        maxWidth: '440px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-alt)' }}
      >
        <PawPrint size={16} style={{ color: domainColor }} />
        <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--color-primary-soft)' }}>
          함께한 사진 아카이브
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2" style={{ padding: '20px' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-center"
            style={{
              aspectRatio: '1 / 1',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: i === 1 ? domainBg : 'var(--color-bg-alt)',
            }}
          >
            {i === 1 && <PawPrint size={18} style={{ color: domainColor }} />}
          </div>
        ))}
      </div>
      <div
        className="flex items-center gap-2"
        style={{ padding: '0 20px 20px' }}
      >
        <span
          className="flex items-center gap-1.5 font-bold"
          style={{
            fontSize: 'var(--fs-caption)',
            // FIX: 테라코타 글자/연한 테라코타 배경은 약 2.2:1 - 글자만 다크로
            color: 'var(--color-text-primary)',
            backgroundColor: domainBg,
            padding: '6px 12px',
            borderRadius: 'var(--radius-pill)',
          }}
        >
          <Sparkles size={16} style={{ color: domainColor }} />
          AI 초상화 3매 포함
        </span>
      </div>
    </div>
  )
}

const MOCKUPS = {
  photo: PhotoMockup,
  will: WillMockup,
  pet: PetMockup,
}

export default function HomeServices() {
  return (
    <section className="w-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 py-20 sm:py-28 lg:py-32">
        <h2
          className="text-center font-bold mb-4 sm:mb-5"
          style={{
            fontSize: 'clamp(19px, 3.4vw, 26px)',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: 'var(--ls-heading-ko)',
            wordBreak: 'keep-all',
          }}
        >
          온담의 서비스
        </h2>
        <p
          className="text-center mb-16 sm:mb-20"
          style={{ fontSize: 'var(--fs-body-lg)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)', wordBreak: 'keep-all' }}
        >
          가격은 문의 없이 바로 확인하실 수 있어요.
          <br />
          결제 전에 무엇을 받으시는지 미리 알려드려요.
        </p>

        <div className="flex flex-col gap-24 sm:gap-32 lg:gap-40">
          {SERVICES.map(({ icon: Icon, title, description, price, priceNote, to, cta, highlight, domainColor, domainBg, mockup }, index) => {
            const Mockup = MOCKUPS[mockup]
            const imageFirst = index % 2 === 0

            return (
              <div key={title} className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                {/* 이미지/목업 블록 - 짝수 인덱스는 좌측, 홀수 인덱스는 우측 */}
                <div
                  aria-hidden="true"
                  className="w-full"
                  style={{ order: imageFirst ? 0 : 1 }}
                >
                  <Mockup domainColor={domainColor} domainBg={domainBg} />
                </div>

                {/* 텍스트 블록 - 이미지 반대편 */}
                <div className="w-full" style={{ order: imageFirst ? 1 : 0, minWidth: 0 }}>
                  {highlight && (
                    // 배지 배경(흰색, --home-color-secondary)이 페이지 배경(흰색/
                    // --color-surface)과 구분되지 않으므로 테두리를 더해 알약(pill)
                    // 윤곽을 뚜렷하게 만든다.
                    <span
                      className="inline-block font-bold mb-4"
                      style={{
                        backgroundColor: 'var(--home-color-secondary)',
                        color: 'var(--color-text-primary)',
                        fontSize: 'var(--fs-caption)',
                        letterSpacing: '0.05em',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-pill)',
                        border: '1.5px solid var(--home-color-primary)',
                      }}
                    >
                      가장 먼저 해보세요
                    </span>
                  )}

                  <div
                    className="w-14 h-14 flex items-center justify-center flex-shrink-0 mb-6"
                    style={{ backgroundColor: domainBg, borderRadius: 'var(--radius-sm)' }}
                    aria-hidden="true"
                  >
                    <Icon size={26} style={{ color: domainColor }} />
                  </div>

                  <h3
                    className="font-bold mb-4"
                    style={{
                      fontSize: 'clamp(21px, 3vw, var(--fs-h1))',
                      color: 'var(--color-text-primary)',
                      letterSpacing: 'var(--ls-heading-ko)',
                      wordBreak: 'keep-all',
                    }}
                  >
                    {title}
                  </h3>
                  <p
                    className="leading-relaxed mb-8"
                    style={{
                      fontSize: 'var(--fs-body-lg)',
                      color: 'var(--color-text-secondary)',
                      wordBreak: 'keep-all',
                      lineHeight: 'var(--lh-relaxed)',
                    }}
                  >
                    {description}
                  </p>

                  <div className="mb-8">
                    <div
                      className="font-bold"
                      style={{ fontSize: 'var(--fs-h1)', color: 'var(--home-color-primary)' }}
                    >
                      {price}
                    </div>
                    <div style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>
                      {priceNote}
                    </div>
                  </div>

                  <Link
                    to={to}
                    className="inline-block text-center font-semibold transition-opacity hover:opacity-90"
                    style={{
                      height: 'var(--size-button-h)',
                      lineHeight: 'var(--size-button-h)',
                      minWidth: '220px',
                      padding: '0 32px',
                      fontSize: 'var(--fs-button)',
                      backgroundColor: highlight ? 'var(--home-color-primary)' : 'var(--color-bg-alt)',
                      color: highlight ? 'var(--color-surface)' : 'var(--color-text-primary)',
                      borderRadius: 'var(--radius-pill)',
                      border: highlight ? 'none' : '1px solid var(--color-border)',
                    }}
                  >
                    {cta}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {/* 법적 유언 효력 없음 고지 - DEV-05. "마지막 영상 편지" 소개 직후,
            결제 유입 동선(CTA)을 누르기 전에 안내한다. 3개 상품 중
            영상 편지 한정 고지임을 먼저 밝혀 오인을 막는다 */}
        <div className="max-w-xl mx-auto mt-16 sm:mt-20">
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
