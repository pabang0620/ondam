import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'

export default function Footer() {
  return (
    <footer
      style={{
        backgroundColor: 'var(--color-surface-warm)',
        borderTop: '1px solid var(--color-border)',
        marginTop: 'auto',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 lg:py-16">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8 sm:gap-12">
          {/* 브랜드 */}
          <div className="flex flex-col gap-2">
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: 'var(--fs-body-lg)',
                color: 'var(--color-text-primary)',
                letterSpacing: 'var(--ls-heading-ko)',
              }}
            >
              온담
            </span>
            <p
              style={{
                fontSize: 'var(--fs-caption)',
                lineHeight: 'var(--lh-relaxed)',
                color: 'var(--color-text-secondary)',
                maxWidth: '18rem',
              }}
            >
              AI로 간직하는 소중한 기억.
              <br />
              사랑하는 이와의 추억을 영원히.
            </p>
          </div>

          {/* 링크 그룹: 모바일에서 가로 2열, 데스크톱에서 나란히 */}
          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-8 sm:gap-16">
            {/* 서비스 링크 */}
            <div className="flex flex-col gap-2">
              <span
                style={{
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: 4,
                }}
              >
                서비스
              </span>
              {[
                { to: ROUTES.PHOTO, label: 'AI 사진관' },
                { to: ROUTES.WILL, label: 'AI 유언장' },
                { to: ROUTES.PET, label: '반려동물 아카이브' },
              ].map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  style={{
                    fontSize: 'var(--fs-caption)',
                    color: 'var(--color-text-secondary)',
                    transition: 'var(--transition-base)',
                    minHeight: 'var(--min-touch-target)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-primary)'
                    e.currentTarget.style.textDecoration = 'underline'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)'
                    e.currentTarget.style.textDecoration = 'none'
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* 고객 지원 */}
            <div className="flex flex-col gap-2">
              <span
                style={{
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: 4,
                }}
              >
                고객 지원
              </span>
              {[
                { label: '이용약관', href: '#' },
                { label: '개인정보처리방침', href: '#' },
                { label: '고객센터', href: '#' },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  style={{
                    fontSize: 'var(--fs-caption)',
                    color: 'var(--color-text-secondary)',
                    transition: 'var(--transition-base)',
                    minHeight: 'var(--min-touch-target)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-primary)'
                    e.currentTarget.style.textDecoration = 'underline'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)'
                    e.currentTarget.style.textDecoration = 'none'
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 'var(--spacing-2xl)',
            paddingTop: 'var(--spacing-xl)',
            borderTop: '1px solid var(--color-border)',
            fontSize: 'var(--fs-caption)',
            color: 'var(--color-text-muted)',
          }}
        >
          © {new Date().getFullYear()} 온담. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
