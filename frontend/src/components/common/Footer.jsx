import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes.js'
import logoUrl from '../../assets/logo.svg'

// 전화 문의 번호는 하드코딩하지 않는다. 미설정 시 '고객센터' 항목은
// 임시 링크(href="#")로 남긴다 - DEV-13 HomePage.jsx와 동일한 규약.
const CONTACT_PHONE = import.meta.env.VITE_CONTACT_PHONE

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
          <div className="flex flex-col gap-3">
            <img
              src={logoUrl}
              alt="온담"
              height={36}
              width={135}
              style={{ display: 'block' }}
            />
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
                { to: ROUTES.WILL, label: '마지막 영상 편지' },
                { to: ROUTES.PET, label: '반려동물 아카이브' },
              ].map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  style={{
                    // FIX: 결함5 - 실제로 페이지를 이동시키는 링크(행동형)라
                    // 보조 정보가 아니다. --fs-body(16px)로 올린다. 터치 타겟은
                    // 이미 --min-touch-target(48px)을 충족하고 있었다.
                    fontSize: 'var(--fs-body)',
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
                // FIX: DEV-13 - 법무 문서(이용약관·개인정보처리방침)는 게시 전이라
                // 라우트 연결이 불가하다. "준비 중"으로 바꾸지 말고 현행(href="#")
                // 유지, 문서 게시 시 실제 경로로 교체할 것.
                { label: '이용약관', href: '#' },
                { label: '개인정보처리방침', href: '#' },
                CONTACT_PHONE
                  ? { label: `고객센터 ${CONTACT_PHONE}`, href: `tel:${CONTACT_PHONE}` }
                  : { label: '고객센터', href: '#' },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  style={{
                    // FIX: 결함5 - 실제로 페이지를 이동시키는 링크(행동형)라
                    // 보조 정보가 아니다. --fs-body(16px)로 올린다. 터치 타겟은
                    // 이미 --min-touch-target(48px)을 충족하고 있었다.
                    fontSize: 'var(--fs-body)',
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
