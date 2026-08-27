import { ShieldCheck, FileCheck, Lock, Trash2, Phone, PenLine, Mail } from 'lucide-react'

// 04 문서 메시징 기둥 2 + 03 문서 4절 그대로 게시하는 신뢰 문장.
const TRUST_POINTS = [
  { icon: ShieldCheck, text: '본인이 생전에 직접 남기는 기록입니다.' },
  { icon: FileCheck, text: '사망증명서 확인과 관리자 검수를 거쳐 전달됩니다.' },
  { icon: Trash2, text: '언제든 삭제할 수 있습니다.' },
  {
    icon: Lock,
    text:
      '리멤버미를 이용하시는 동안에는 계속 보관해 드리며, 서비스를 종료하게 되면 6개월 전에 미리 알려드리고 모든 기록을 내려받으실 수 있게 해드립니다.',
  },
]

// 07 문서 3절 "리멤버미의 약속" 초안 4문장 - 원문 그대로 게시한다.
const PROMISES = [
  {
    title: '하나. 본인의 기록만 만듭니다',
    description:
      '리멤버미의 영상은 본인이 생전에 직접 촬영·녹음한 기록으로만 제작합니다. 제3자가 고인의 사진과 음성으로 의뢰하는 재현 영상은 만들지 않습니다.',
  },
  {
    title: '둘. 전달은 검수를 거칩니다',
    description: '사망증명서 확인과 담당자 검수를 거친 뒤에만 지정된 분께 전달합니다.',
  },
  {
    title: '셋. 언제든 지울 수 있습니다',
    description: '본인은 언제든 기록을 삭제할 수 있고, 삭제된 데이터는 복구하지 않습니다.',
  },
  {
    title: '넷. 데이터는 암호화해 보관합니다',
    description: '음성·영상·서류는 암호화 저장하며, 접근 기록을 남깁니다.',
  },
]

// 전화 문의 번호는 하드코딩하지 않는다. 미설정 시 관련 UI를 숨긴다.
// .env에 VITE_CONTACT_PHONE=0000-0000 형태로 설정하면 노출된다.
const CONTACT_PHONE = import.meta.env.VITE_CONTACT_PHONE

export default function HomeTrust() {
  return (
    <section className="w-full" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-8 lg:px-12 py-20 sm:py-28 lg:py-32">
        <h2
          className="text-center font-bold mb-4 sm:mb-5"
          style={{
            fontFamily: 'var(--font-brand)',
            fontSize: 'clamp(19px, 3.4vw, 26px)',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: 'var(--ls-heading-ko)',
            wordBreak: 'keep-all',
          }}
        >
          믿고 맡기셔도 됩니다
        </h2>
        <p
          className="text-center mb-10 sm:mb-12"
          style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)', wordBreak: 'keep-all' }}
        >
          이것만은 약속드려요.
        </p>

        <ul className="flex flex-col gap-5 mb-16 sm:mb-20">
          {TRUST_POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-4">
              <span
                className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: 'var(--color-surface-warm)',
                  borderRadius: 'var(--radius-sm)',
                }}
                aria-hidden="true"
              >
                <Icon size={18} style={{ color: 'var(--color-warm-accent)' }} />
              </span>
              <span
                style={{
                  fontSize: 'var(--fs-body)',
                  color: 'var(--color-text-primary)',
                  lineHeight: 'var(--lh-relaxed)',
                  wordBreak: 'keep-all',
                  paddingTop: '4px',
                }}
              >
                {text}
              </span>
            </li>
          ))}
        </ul>

        {/* "리멤버미의 약속" - 편지 느낌 카드. 크림톤 서페이스(--color-surface-warm) +
            미세한 회전(-0.4deg)으로 종이 질감을 암시하고, 4개 조항은 숫자 대신 "하나./둘./
            셋./넷." 한글 순서말로 표기해 딱딱한 리스트 대신 여유 있는 줄간격의 편지 문단처럼
            배치한다. 실제 편지 형식을 살리기 위해 상단에 "To. 고객님", 하단 서명 앞에
            "From. 리멤버미"를 덧붙였다(둘 다 --fs-caption, 굵지 않은 보조 텍스트). 본문은
            여전히 --fs-body(16px) 이상, 색상 대비도 기존 텍스트 토큰을 그대로 써서 어르신
            UX 하한선(WCAG AA)을 그대로 유지한다. */}
        <div className="mx-auto max-w-2xl">
          <div
            style={{
              backgroundColor: 'var(--color-surface-warm)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-card)',
              transform: 'rotate(-0.4deg)',
              padding: 'clamp(28px, 6vw, 48px) clamp(24px, 6vw, 44px)',
            }}
          >
            <p
              className="mb-3 sm:mb-4"
              style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}
            >
              To. 고객님
            </p>

            <div className="flex items-center justify-center gap-2 mb-6 sm:mb-7">
              <PenLine size={17} style={{ color: 'var(--color-warm-accent)' }} aria-hidden="true" />
              <h3
                className="font-bold"
                style={{ fontSize: 'var(--fs-h3)', color: 'var(--color-text-primary)', wordBreak: 'keep-all' }}
              >
                리멤버미의 약속
              </h3>
            </div>

            <div
              className="mx-auto mb-8 sm:mb-10"
              style={{
                width: '56px',
                height: '2px',
                backgroundColor: 'var(--color-warm-accent-soft)',
                borderRadius: 'var(--radius-pill)',
              }}
              aria-hidden="true"
            />

            <div className="flex flex-col gap-7 sm:gap-8">
              {PROMISES.map(({ title, description }) => (
                <p
                  key={title}
                  style={{ fontSize: 'var(--fs-body)', lineHeight: '1.75', wordBreak: 'keep-all' }}
                >
                  <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {title}
                  </span>
                  <br />
                  <span style={{ color: 'var(--color-text-muted)' }}>{description}</span>
                </p>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 mt-9 sm:mt-11">
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}>
                From. 리멤버미
              </span>
              <Mail size={15} style={{ color: 'var(--color-warm-accent)' }} aria-hidden="true" />
            </div>
          </div>
        </div>

        {CONTACT_PHONE && (
          <div
            className="flex items-center justify-center gap-2 mt-16 sm:mt-20"
            style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-primary)' }}
          >
            <Phone size={18} style={{ color: 'var(--color-warm-accent)' }} aria-hidden="true" />
            <span>전화로 물어보셔도 돼요</span>
            <a
              href={`tel:${CONTACT_PHONE}`}
              className="font-bold"
              style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}
            >
              {CONTACT_PHONE}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
