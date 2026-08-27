import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'

export default function HomeBottomCta() {
  return (
    <section className="w-full" style={{ backgroundColor: 'var(--color-bg-alt)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 py-20 sm:py-28 lg:py-36 text-center">
        <h2
          className="font-bold mb-5 sm:mb-6"
          style={{
            fontFamily: 'var(--font-brand)',
            fontSize: 'clamp(21px, 3.7vw, 32px)',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: 'var(--ls-heading-ko)',
            wordBreak: 'keep-all',
          }}
        >
          사진 한 장으로 시작해보세요
        </h2>
        <p
          style={{
            fontSize: 'var(--fs-body-lg)',
            color: 'var(--color-text-secondary)',
            maxWidth: '400px',
            margin: '0 auto 40px',
            lineHeight: 'var(--lh-relaxed)',
            wordBreak: 'keep-all',
          }}
        >
          9,900원이면 복원부터 결과물 4종까지 받아보실 수 있어요.
        </p>
        <div className="flex justify-center">
          <Link
            to={ROUTES.PHOTO}
            className="flex items-center justify-center font-bold transition-opacity hover:opacity-90"
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
            9,900원으로 시작하기
          </Link>
        </div>
      </div>
    </section>
  )
}
