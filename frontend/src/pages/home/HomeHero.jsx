import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'

export default function HomeHero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(160deg, var(--color-primary) 0%, var(--color-primary-soft) 100%)`,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(ellipse at 75% 25%, rgba(201,162,75,0.18) 0%, transparent 55%)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-3xl mx-auto text-center px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-28">
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

        {/*
          태그라인: 11 문서 2절 후보 중 대표로 지정된 문구를 사용한다.
          최종 확정(다른 2개 후보와의 선택)은 랜딩 제작 시점 오너 몫 - 아직 미확정이다.
        */}
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
          기억을 간직하는
          <br />
          가장 쉬운 방법
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
          빛바랜 사진을 복원하고, 목소리를 담은 영상 편지를 남기고,
          <br className="hidden sm:block" />
          반려동물과의 순간을 오래 간직하세요.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
            사진 복원 시작 · 9,900원
          </Link>

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
            영상 편지 알아보기
          </Link>
        </div>
      </div>
    </section>
  )
}
