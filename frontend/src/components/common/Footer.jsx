import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'

export default function Footer() {
  return (
    <footer
      className="border-t border-[var(--color-border)] mt-auto"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          {/* 브랜드 */}
          <div className="flex flex-col gap-2">
            <span
              className="font-bold text-lg"
              style={{ color: 'var(--color-primary)' }}
            >
              온담
            </span>
            <p
              className="text-sm leading-relaxed max-w-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              AI로 간직하는 소중한 기억.
              <br />
              사랑하는 이와의 추억을 영원히.
            </p>
          </div>

          {/* 서비스 링크 */}
          <div className="flex flex-col gap-2">
            <span
              className="text-sm font-semibold mb-1"
              style={{ color: 'var(--color-text-primary)' }}
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
                className="text-sm hover:underline transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* 고객 지원 */}
          <div className="flex flex-col gap-2">
            <span
              className="text-sm font-semibold mb-1"
              style={{ color: 'var(--color-text-primary)' }}
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
                className="text-sm hover:underline transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        <div
          className="mt-8 pt-6 border-t border-[var(--color-border)] text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          © {new Date().getFullYear()} 온담. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
