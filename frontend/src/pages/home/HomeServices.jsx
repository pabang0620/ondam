import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useInView } from 'react-intersection-observer'
import { Camera, Heart, PawPrint, Sparkles, Play, Image as ImageIcon, Mic } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'
import LegalNotice from '../../components/common/LegalNotice.jsx'
import useAnimateInView from './useAnimateInView.js'
import './HomeServices.css'

// DEV-13: 상품 3종만 노출한다. 추모관은 03 문서 1절 "④ 추모관(부속 기능, 비상품) -
// 독립 판매하지 않는다"에 따라 랜딩의 판매 카드에서 제외한다(구매자 보관 공간일 뿐).
// 이벤트 영상(19,900원)은 03 문서 결정으로 판매 보류 - 홈에 노출하지 않는다.
//
// 레이아웃(2026-09, sticky scrollytelling으로 교체): 기존 "좌우 교차 2단 블록"
// 세로 스택(미리캔버스 colorize 레퍼런스) 대신, lg 이상에서 좌측에 sticky 고정
// 비주얼 패널(ServiceVisualStack) + 우측에 스크롤 트리거 3개(ServiceTrigger)를
// 두는 2단 구조로 바꿨다. react-intersection-observer의 useInView + CSS
// position: sticky만 사용하고(스크롤 이벤트 리스너 직접 구현 금지 - 성능/저사양
// 기기 이슈), 트리거가 뷰포트 세로 중앙을 지날 때마다 좌측 패널의 목업이
// 크로스페이드 전환된다. lg 미만(모바일/태블릿)에서는 기존과 동일하게 목업+텍스트가
// 위아래로 쌓이는 세로 스택을 유지한다(ServiceTrigger 안에 lg:hidden 인라인
// 목업을 함께 렌더 - 별도 모바일 전용 컴포넌트/파일은 만들지 않는다, mobile-first
// 프로젝트 규칙). 목업(PhotoMockup/WillMockup/PetMockup/MOCKUPS)과 SERVICES
// 데이터, 카피·라우트는 기존 그대로 유지한다(실제 스크린샷 자산이 없으므로
// CSS/아이콘 조합만 사용, PLACEHOLDER 안내는 HomeProcess.jsx 상단 주석 참고).
const SERVICES = [
  {
    icon: Camera,
    title: 'AI 사진관',
    description: '빛바랜 사진 한 장이면 충분해요. 복원하고, 색을 입히고, 배경까지 정리해 드려요.',
    price: '9,900원',
    priceNote: '결과물 4종 세트',
    to: ROUTES.PHOTO,
    cta: '바로 시작하기',
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
function PhotoMockup({ domainColor, domainBg, isActive = true }) {
  const [animRef, animating] = useAnimateInView(isActive)
  return (
    <div
      ref={animRef}
      className={`w-full mx-auto ondam-mock ondam-mock--photo${animating ? ' is-animating' : ''}`}
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
        <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
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
            className="block text-center mt-2 font-semibold"
            style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}
          >
            보정 전
          </span>
        </div>
        <div>
          <div
            className="flex items-center justify-center ondam-photo-after"
            style={{ aspectRatio: '3 / 4', borderRadius: 'var(--radius-card)', backgroundColor: domainBg }}
          >
            <ImageIcon size={30} style={{ color: domainColor }} />
          </div>
          <span className="block text-center mt-2 font-semibold" style={{ fontSize: 'var(--fs-caption)', color: domainColor }}>
            보정 후
          </span>
        </div>
      </div>
      <div
        className="flex items-center gap-2"
        style={{ padding: '0 22px 22px' }}
      >
        <Sparkles size={16} className="ondam-pulse" style={{ color: domainColor }} />
        <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          복원 · 컬러화 · 배경 정리 완료
        </span>
      </div>
    </div>
  )
}

// 영상 편지 목업 파형 막대 높이(px)
const WAVE_BARS = [8, 16, 10, 22, 14, 26, 12, 18, 9, 20, 15, 24]

// 영상 편지 목업: 재생 버튼이 있는 영상 카드
function WillMockup({ domainColor, domainBg, isActive = true }) {
  const [animRef, animating] = useAnimateInView(isActive)
  return (
    <div
      ref={animRef}
      className={`w-full mx-auto ondam-mock ondam-mock--will${animating ? ' is-animating' : ''}`}
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
          className="flex items-center justify-center ondam-will-play"
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
            fontWeight: 600,
            color: 'var(--color-surface)',
            backgroundColor: 'rgba(0,0,0,0.45)',
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
          <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            목소리 녹음 완료
          </span>
        </div>
        <div className="flex items-center gap-1" aria-hidden="true">
          {WAVE_BARS.map((h, i) => (
            <span
              key={i}
              className="ondam-wave-bar"
              style={{
                width: '4px',
                height: `${h}px`,
                borderRadius: '2px',
                backgroundColor: domainColor,
                opacity: 0.6,
                '--bar-delay': `${-((i * 37) % 11) * 0.12}s`,
                '--bar-dur': `${1 + ((i * 5) % 7) * 0.15}s`,
              }}
            />
          ))}
        </div>
        <div className="ondam-will-track" aria-hidden="true">
          <span className="ondam-will-fill" style={{ backgroundColor: domainColor }} />
        </div>
      </div>
    </div>
  )
}

// 반려동물 아카이브 목업: 사진 그리드 + AI 초상화 배지
function PetMockup({ domainColor, domainBg, isActive = true }) {
  const [animRef, animating] = useAnimateInView(isActive)
  return (
    <div
      ref={animRef}
      className={`w-full mx-auto ondam-mock ondam-mock--pet${animating ? ' is-animating' : ''}`}
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
        <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          함께한 사진 아카이브
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2" style={{ padding: '20px' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-center ondam-pet-cell"
            style={{
              aspectRatio: '1 / 1',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: i === 1 ? domainBg : 'var(--color-bg-alt)',
              '--cell-delay': `${i * 0.25}s`,
            }}
          >
            {i === 1 && <PawPrint size={18} className="ondam-pulse" style={{ color: domainColor }} />}
          </div>
        ))}
      </div>
      <div
        className="flex items-center gap-2"
        style={{ padding: '0 20px 20px' }}
      >
        <span
          className="flex items-center gap-1.5 font-semibold"
          style={{
            fontSize: 'var(--fs-caption)',
            color: domainColor,
            backgroundColor: domainBg,
            padding: '6px 12px',
            borderRadius: 'var(--radius-pill)',
          }}
        >
          <Sparkles size={14} className="ondam-pulse" />
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

// sticky 비주얼 패널의 고정 스테이지 높이. 목업 3종(PhotoMockup/WillMockup/
// PetMockup)은 내부 콘텐츠 높이가 서로 달라(사진 2단/영상 1단/그리드 3x2), 크기가
// 그대로면 전환마다 스테이지 높이가 들썩여(점프) 보인다. 고정 높이 안에서 항상
// 중앙 정렬해 이 문제를 없앤다. sticky top 오프셋 계산(아래 ServiceVisualStack)도
// 이 값을 기준으로 한다.
const VISUAL_STAGE_HEIGHT = 'clamp(440px, 52vh, 560px)'

/*
 * 좌측 sticky 비주얼 패널 - 3개 목업을 position:absolute + inset:0으로 겹쳐두고
 * activeIndex에 해당하는 것만 opacity:1(크로스페이드)로 보여준다. lg 미만에서는
 * 렌더하지 않는다(호출부에서 hidden lg:block으로 감쌈). 헤더가 모든 페이지에서
 * sticky(약 65px, Header.jsx h-16 + safe-area)로 상시 노출되므로, top 오프셋을
 * 헤더보다 더 아래(96px 이상 또는 뷰포트 중앙 정렬)로 계산해 겹치지 않게 한다.
 */
function ServiceVisualStack({ activeIndex, onDotClick }) {
  return (
    <div
      style={{
        position: 'sticky',
        // 헤더(sticky, 약 65px)와 겹치지 않도록 최소 96px을 보장하면서, 뷰포트가
        // 충분히 크면 스테이지가 세로 중앙 부근에 오도록 계산한다.
        top: 'max(96px, calc((100vh - 560px) / 2))',
      }}
    >
      <div
        className="relative w-full mx-auto"
        style={{ height: VISUAL_STAGE_HEIGHT, maxWidth: '440px', overflow: 'hidden' }}
      >
        {SERVICES.map(({ title, domainColor, domainBg, mockup }, index) => {
          const Mockup = MOCKUPS[mockup]
          const isActive = index === activeIndex
          return (
            <div
              key={title}
              aria-hidden="true"
              className="ondam-service-visual absolute inset-0 flex items-center justify-center"
              style={{
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'translateY(0)' : 'translateY(12px)',
                transitionProperty: 'opacity, transform',
                transitionDuration: '380ms',
                transitionTimingFunction: 'ease',
              }}
            >
              <Mockup domainColor={domainColor} domainBg={domainBg} isActive={isActive} />
            </div>
          )
        })}
      </div>

      {/* 진행 인디케이터 - 70vh로 압축된 트리거 구간을 스크롤하는 동안 "3개 중
          몇 번째"인지 방향 감각을 보조하고, 클릭하면 해당 서비스 트리거 위치로
          부드럽게 스크롤 이동한다. 점 자체는 10px로 작지만 클릭 가능 영역은
          48px(어르신 UX 최소 터치 타겟 규칙)를 그대로 유지한다 - 간격이 넓어 보이는
          문제는 클릭 영역을 줄이는 대신 컨테이너 gap을 0으로 좁혀서 해결한다
          (버튼끼리 경계가 맞닿을 뿐 48px 히트박스 자체는 줄지 않으므로 접근성
          트레이드오프 없음). */}
      <div className="flex items-center justify-center gap-0 mt-6" role="group" aria-label="서비스 바로가기">
        {SERVICES.map(({ title }, index) => (
          <button
            key={title}
            type="button"
            onClick={() => onDotClick(index)}
            aria-label={`${title}으로 이동`}
            aria-current={index === activeIndex ? 'true' : undefined}
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 'var(--min-touch-target)',
              height: 'var(--min-touch-target)',
              padding: 0,
              margin: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: index === activeIndex ? 'var(--home-gradient-decor)' : 'var(--color-border)',
                transition: 'background 300ms ease',
              }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

/*
 * 스크롤 트리거 1개 - 뷰포트 세로 중앙(-50% 0px -50% 0px rootMargin)을 지나는
 * 순간을 useInView로 감지해 부모의 activeIndex를 자신의 index로 갱신한다.
 * 텍스트 블록(배지/아이콘/제목/설명/가격/CTA)은 기존 마크업을 그대로 이식했고,
 * 그 위에 모바일 전용(lg:hidden) 인라인 목업을 추가했다 - 별도 모바일 컴포넌트를
 * 만들지 않고 이 컴포넌트 하나에서 Tailwind breakpoint로만 분기한다(lg 이상에서는
 * 좌측 ServiceVisualStack이 대신 목업을 보여주므로 이 인라인 목업은 lg:hidden으로
 * 숨긴다).
 */
function ServiceTrigger({ service, index, onActivate, registerRef }) {
  const { icon: Icon, title, description, price, priceNote, to, cta, highlight, domainColor, domainBg, mockup } = service
  const Mockup = MOCKUPS[mockup]

  const { ref: inViewRef, inView } = useInView({
    rootMargin: '-50% 0px -50% 0px',
    threshold: 0,
  })

  // dot 인디케이터 클릭 시 scrollIntoView 대상 노드를 부모(HomeServices)에
  // 등록하기 위해 useInView의 콜백 ref와 registerRef를 하나로 합친다.
  const setRefs = useCallback(
    (node) => {
      inViewRef(node)
      registerRef(index, node)
    },
    [inViewRef, registerRef, index]
  )

  useEffect(() => {
    if (inView) onActivate(index)
  }, [inView, index, onActivate])

  return (
    <div
      ref={setRefs}
      className="w-full flex flex-col justify-center lg:min-h-[70vh]"
    >
      {/* 모바일/태블릿 전용 인라인 목업 - lg 이상에서는 좌측 sticky 패널이 이를
          대신하므로 숨긴다. */}
      <div aria-hidden="true" className="w-full mb-8 lg:hidden">
        <Mockup domainColor={domainColor} domainBg={domainBg} />
      </div>

      <div className="w-full" style={{ minWidth: 0 }}>
        <div
          className="w-14 h-14 flex items-center justify-center flex-shrink-0 mb-6"
          style={{ backgroundColor: domainBg, borderRadius: 'var(--radius-sm)' }}
          aria-hidden="true"
        >
          <Icon size={26} style={{ color: domainColor }} />
        </div>

        <h3
          className="font-semibold mb-4"
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
            className="font-semibold"
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
            // 강조(highlight) CTA는 딥 코랄 로즈 그라디언트 - 반드시
            // background(단축 프로퍼티)로 지정한다. backgroundColor에
            // linear-gradient() 값을 넣으면 무효 처리되어 버튼이 투명해지는
            // 함정이 있다(2026-09 대비 검증 시 확인). 흰 텍스트는
            // var(--home-gradient-cta) 양 끝 stop 모두 4.5:1 이상 실측됨.
            // 비강조 CTA는 아웃라인 버튼(테두리 + 단색 텍스트)으로 전환.
            background: highlight ? 'var(--home-gradient-cta)' : 'transparent',
            color: highlight ? '#FFFFFF' : 'var(--home-color-primary)',
            borderRadius: 'var(--radius-pill)',
            border: highlight ? 'none' : '1.5px solid var(--home-color-primary)',
          }}
        >
          {cta}
        </Link>
      </div>
    </div>
  )
}

export default function HomeServices() {
  const [activeIndex, setActiveIndex] = useState(0)

  // dot 클릭으로 스크롤 이동하는 대상 트리거 DOM 노드 저장소(인덱스별 1개).
  const triggerNodesRef = useRef([])
  // dot 클릭으로 프로그래매틱 스크롤이 진행되는 동안, 중간에 지나치는 다른
  // 트리거들의 IntersectionObserver(useInView) 갱신이 activeIndex를 흔들어
  // dot이 깜빡이지 않도록 잠시 무시한다. 스크롤이 끝나면(scrollend 이벤트 또는
  // 폴백 타이머) 다시 관찰 결과를 반영한다.
  const suppressObserverRef = useRef(false)
  const suppressTimeoutRef = useRef(null)

  // 부모 콜백을 안정화해 각 ServiceTrigger의 useEffect 의존성 배열이 매 렌더마다
  // 새로 트리거되지 않게 한다.
  const handleActivate = useCallback((index) => {
    if (suppressObserverRef.current) return
    setActiveIndex(index)
  }, [])

  const registerTriggerRef = useCallback((index, node) => {
    triggerNodesRef.current[index] = node
  }, [])

  const handleDotClick = useCallback((index) => {
    setActiveIndex(index)
    suppressObserverRef.current = true
    if (suppressTimeoutRef.current) clearTimeout(suppressTimeoutRef.current)
    triggerNodesRef.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // scrollend 미지원 브라우저(Safari 등) 대비 폴백 - 스크롤 애니메이션이
    // 끝났을 법한 시점 이후 관찰을 재개한다.
    suppressTimeoutRef.current = setTimeout(() => {
      suppressObserverRef.current = false
    }, 1000)
  }, [])

  useEffect(() => {
    const clearSuppress = () => {
      suppressObserverRef.current = false
      if (suppressTimeoutRef.current) {
        clearTimeout(suppressTimeoutRef.current)
        suppressTimeoutRef.current = null
      }
    }
    window.addEventListener('scrollend', clearSuppress)
    return () => {
      window.removeEventListener('scrollend', clearSuppress)
      if (suppressTimeoutRef.current) clearTimeout(suppressTimeoutRef.current)
    }
  }, [])

  return (
    <section className="w-full">
      {/* prefers-reduced-motion: reduce에서는 좌측 비주얼 패널의 크로스페이드
          트랜지션과 위치 오프셋을 모두 제거해 즉시 전환되게 한다(HomeHero.jsx의
          기존 reduced-motion 처리 패턴과 동일하게 컴포넌트 내부 <style> 블록으로
          특정 클래스에 !important 오버라이드). */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .ondam-service-visual {
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 py-20 sm:py-28 lg:py-32">
        <h2
          className="text-center font-semibold mb-4 sm:mb-5"
          style={{
            fontSize: 'clamp(19px, 3.4vw, 26px)',
            fontWeight: 600,
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

        {/*
          lg 이상: 좌측 sticky 비주얼 패널 + 우측 스크롤 트리거 3개(70vh씩) 2단
          구조. lg 미만: 좌측 칼럼이 렌더되지 않아(hidden lg:block) 우측 트리거
          칼럼만 1열로 남고, 각 트리거 안의 인라인 목업(lg:hidden)이 기존과 동일한
          세로 스택을 만든다.
          주의: 이 grid 부모에는 절대 items-center/items-start를 주지 않는다
          (기본 stretch 유지) - 그래야 좌측 sticky 자식이 우측 트리거 스택 전체
          높이만큼 "여행"할 공간이 생긴다. shrink-wrap되면 sticky 전환이 아예
          일어나지 않는다.
        */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 xl:gap-20">
          <div className="hidden lg:block">
            <ServiceVisualStack activeIndex={activeIndex} onDotClick={handleDotClick} />
          </div>

          <div className="flex flex-col gap-24 sm:gap-32 lg:gap-0">
            {SERVICES.map((service, index) => (
              <ServiceTrigger
                key={service.title}
                service={service}
                index={index}
                onActivate={handleActivate}
                registerRef={registerTriggerRef}
              />
            ))}
          </div>
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
