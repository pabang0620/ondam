import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, ChevronLeft, ChevronRight, Gift, Heart, Images, PawPrint } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'
import './HomeLatestCarousel.css'

/*
 * 카드 배경 이미지 - 전부 Unsplash License(상업적 사용 자유, 저작자 표시 불필요) 무료
 * 이미지다. 외부 CDN(images.unsplash.com) 실시간 hotlink 대신 자체 호스팅한다
 * (src/assets/images/home-latest, w=800&q=75&fm=jpg&fit=crop&auto=format로 리사이즈
 * 후 다운로드) - 폰트와 동일한 원칙. 출처는 추적 가능하도록 파일별로 남겨둔다.
 *
 * - photo.jpg: Unsplash License, 사진: Laura Fuhrman (@lauracathleen),
 *   출처: images.unsplash.com/photo-1528569937393-ee892b976859
 * - will.jpg: Unsplash License, 사진: Vitaly Gariev (@silverkblack),
 *   출처: images.unsplash.com/photo-1758686254030-a6dae2f49e69
 * - pet.jpg: Unsplash License, 사진: Haberdoedas,
 *   출처: images.unsplash.com/photo-1760448918262-f89bb4da2c85
 * - memorial.jpg: Unsplash License, 사진: coincidence (@coincidence),
 *   출처: images.unsplash.com/photo-1572332727986-4de3e3d8d9a3
 * - gift.jpg: Unsplash License, 사진: A R (@zimbarus),
 *   출처: images.unsplash.com/photo-1629580484403-0ca253fcce3d
 */
import photoImg from '../../assets/images/home-latest/photo.jpg'
import willImg from '../../assets/images/home-latest/will.jpg'
import petImg from '../../assets/images/home-latest/pet.jpg'
import memorialImg from '../../assets/images/home-latest/memorial.jpg'
import giftImg from '../../assets/images/home-latest/gift.jpg'

// DEV-13 후속: 애플 스토어 홈 "최신 제품"(shelf-2) 섹션 참고 카드 캐러셀.
// 콘텐츠는 애플 제품이 아니라 온담 실제 서비스 5종으로 채운다. 카피·가격은
// HomeServices.jsx / GiftNewPage.jsx / MemorialPage.jsx에 이미 확정된 문구를 그대로
// 재사용하거나 최소한만 다듬었다 - 새로운 가격·기능을 지어내지 않는다.
//
// 추모관은 03 문서 1절 "④ 추모관(부속 기능, 비상품) - 독립 판매하지 않는다"에 따라
// 자체 가격이 없다(반려동물 아카이브 구매자에게 딸려오는 보관 공간). 그래서 이 카드만
// price가 없고, 진입 CTA도 실제 진입 경로인 반려동물 아카이브(ROUTES.PET)로 보낸다 -
// 홈에는 슬러그 없는 정적 /memorial 라우트가 없기 때문이다(SPEC-03).
const CARDS = [
  {
    id: 'photo',
    icon: Camera,
    dark: true,
    eyebrow: '가장 먼저 해보세요',
    title: 'AI 사진관',
    description: '빛바랜 사진 한 장이면 충분해요. 복원하고, 색을 입히고, 배경까지 정리해 드려요.',
    price: '9,900원',
    priceNote: '결과물 4종 세트',
    // 오너 요청(2026-08-26): AI 사진관 카드도 CTA 텍스트를 노출하지 않는다.
    // 카드 자체는 여전히 <Link to={ROUTES.PHOTO}>로 감싸여 클릭 진입은 유지된다.
    cta: null,
    to: ROUTES.PHOTO,
    domainColor: 'var(--color-photo)',
    mediaBg: 'rgba(255,255,255,0.08)',
    iconColor: 'var(--color-text-on-dark)',
    image: photoImg,
    imageAlt: '오래된 사진 앨범을 넘겨보는 손 - AI 사진 복원 서비스',
  },
  {
    id: 'will',
    icon: Heart,
    dark: false,
    eyebrow: '베이직 · 영상 1편',
    title: '마지막 영상 편지',
    description: '사진 한 장과 목소리로 짧은 영상 편지를 만들어, 지정한 분께 전해드려요.',
    price: '49,000원',
    priceNote: null,
    cta: '영상 편지 알아보기',
    to: ROUTES.WILL,
    domainColor: 'var(--color-will)',
    mediaBg: '#F3EDE4',
    iconColor: 'var(--color-will)',
    image: willImg,
    imageAlt: '화상 통화 화면 속 가족을 바라보는 노부부 - 영상 편지 서비스',
  },
  {
    id: 'pet',
    icon: PawPrint,
    dark: false,
    eyebrow: '구독형 서비스',
    title: '반려동물 아카이브',
    description: '함께한 사진을 모아두고, AI 초상화로 반려동물의 모습을 오래 간직하세요.',
    price: '4,900원',
    priceNote: '월 · AI 초상화 3매 포함',
    cta: '아카이브 시작',
    to: ROUTES.PET,
    domainColor: 'var(--color-pet)',
    mediaBg: 'var(--color-pet-soft)',
    iconColor: 'var(--color-pet)',
    image: petImg,
    imageAlt: '카메라를 올려다보는 강아지의 얼굴 - 반려동물 아카이브 서비스',
  },
  {
    id: 'memorial',
    icon: Images,
    dark: false,
    eyebrow: '반려동물 아카이브 구매자 전용',
    title: '추모관',
    description: '사진과 사연을 모아 두고, 원하는 분들과 함께 오래 간직할 수 있어요.',
    price: null,
    priceNote: '별도 결제 없이 자동으로 제공돼요',
    // 오너 요청(2026-08-26): 추모관 카드는 CTA 텍스트를 노출하지 않는다.
    // 카드 자체는 여전히 <Link to={ROUTES.PET}>으로 감싸여 클릭 진입은 유지된다.
    cta: null,
    to: ROUTES.PET,
    domainColor: 'var(--color-memorial)',
    mediaBg: 'var(--color-bg-alt)',
    iconColor: 'var(--color-memorial)',
    image: memorialImg,
    imageAlt: '촛불과 꽃으로 차분하게 꾸며진 추모 공간 - 추모관',
  },
  {
    id: 'gift',
    icon: Gift,
    dark: false,
    eyebrow: '결제는 지금, 사용은 나중에',
    title: '선물하기',
    description: '부모님께 온담 서비스를 선물해 드리세요. 사용은 부모님이 편하실 때 하시면 돼요.',
    price: '9,900원부터',
    priceNote: 'AI 사진관 · 영상 편지 중 선택',
    cta: '선물하기',
    to: ROUTES.GIFT_NEW,
    // 옐로우는 배지/아이콘 배경 등 소면적에만 사용 - 흰 원형 배지 위 아이콘 자체는
    // 대비 확보를 위해 홈 주색(그린)을 쓴다(옐로우 아이콘은 흰 배경과 대비가 약함)
    domainColor: 'var(--home-color-secondary)',
    mediaBg: 'var(--home-color-secondary-soft)',
    iconColor: 'var(--home-color-primary)',
    image: giftImg,
    imageAlt: '리본 장식이 달린 선물 상자 - 온담 선물하기 서비스',
  },
]

export default function HomeLatestCarousel() {
  const trackRef = useRef(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(true)

  const updateScrollState = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanScrollPrev(el.scrollLeft > 4)
    setCanScrollNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = trackRef.current
    if (!el) return undefined

    const handleResize = () => updateScrollState()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [updateScrollState])

  const scrollByDirection = useCallback((direction) => {
    const el = trackRef.current
    if (!el) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({
      left: direction * el.clientWidth * 0.85,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [])

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      scrollByDirection(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      scrollByDirection(-1)
    }
  }, [scrollByDirection])

  return (
    <section className="home-latest" aria-labelledby="home-latest-heading">
      <div className="home-latest__inner">
        <h2 id="home-latest-heading" className="home-latest__heading">
          <strong className="home-latest__heading-bold">한눈에 보는 서비스.</strong>
          <br />
          <span className="home-latest__heading-grey">필요한 것부터 하나씩 골라보세요.</span>
        </h2>

        <div
          className="home-latest__viewport"
          role="region"
          aria-roledescription="carousel"
          aria-label="온담 서비스 카드 목록"
          onKeyDown={handleKeyDown}
        >
          <ul
            className="home-latest__track"
            ref={trackRef}
            onScroll={updateScrollState}
          >
            {CARDS.map(({ id, icon: Icon, dark, eyebrow, title, description, price, priceNote, cta, to, domainColor, mediaBg, iconColor, image, imageAlt }, index) => (
              <li
                key={id}
                className="home-latest__slide"
                aria-roledescription="slide"
                aria-label={`${index + 1}/${CARDS.length}`}
              >
                <Link
                  to={to}
                  aria-label={cta ? `${title} - ${cta}` : `${title} 살펴보기`}
                  className="home-latest__card"
                  data-tone={dark ? 'dark' : 'light'}
                  style={{ backgroundColor: dark ? domainColor : 'var(--color-surface)' }}
                >
                  <div className="home-latest__body">
                    <p
                      className="home-latest__eyebrow"
                      style={{ color: dark ? 'var(--home-color-primary-light)' : 'var(--home-color-primary)' }}
                    >
                      {eyebrow}
                    </p>
                    <h3
                      className="home-latest__name"
                      style={{ color: dark ? 'var(--color-text-on-dark)' : 'var(--color-text-primary)' }}
                    >
                      {title}
                    </h3>
                    <p
                      className="home-latest__desc"
                      style={{ color: dark ? 'rgba(245,245,247,0.82)' : 'var(--color-text-secondary)' }}
                    >
                      {description}
                    </p>
                    <p className="home-latest__price">
                      {price && (
                        <span
                          className="home-latest__price-value"
                          style={{ color: dark ? 'var(--home-color-primary-light)' : 'var(--home-color-primary)' }}
                        >
                          {price}
                        </span>
                      )}
                      {priceNote && (
                        <span
                          className="home-latest__price-note"
                          style={{ color: dark ? 'rgba(245,245,247,0.72)' : 'var(--color-text-muted)' }}
                        >
                          {priceNote}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="home-latest__media" style={{ backgroundColor: mediaBg }}>
                    <img
                      className="home-latest__media-img"
                      src={image}
                      alt={imageAlt}
                      loading="lazy"
                    />
                    <span
                      className="home-latest__media-icon"
                      style={{ backgroundColor: dark ? 'rgba(0,0,0,0.35)' : 'var(--color-surface)' }}
                      aria-hidden="true"
                    >
                      <Icon size={20} style={{ color: iconColor }} />
                    </span>
                  </div>

                  {cta && (
                    <span
                      className="home-latest__cta"
                      style={{ color: dark ? 'var(--color-text-on-dark)' : 'var(--color-text-primary)' }}
                    >
                      {cta}
                      <ChevronRight size={20} aria-hidden="true" />
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="home-latest__nav-btn home-latest__nav-btn--prev"
            onClick={() => scrollByDirection(-1)}
            disabled={!canScrollPrev}
            aria-label="이전 서비스 카드 보기"
          >
            <ChevronLeft size={24} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="home-latest__nav-btn home-latest__nav-btn--next"
            onClick={() => scrollByDirection(1)}
            disabled={!canScrollNext}
            aria-label="다음 서비스 카드 보기"
          >
            <ChevronRight size={24} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
