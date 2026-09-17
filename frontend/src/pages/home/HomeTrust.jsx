import { Phone, Mail } from 'lucide-react'

// 07 문서 3절 "온담의 약속" 초안 4문장 - 원문 그대로 게시한다.
const PROMISES = [
  {
    title: '하나. 본인의 기록만 만듭니다',
    description:
      '온담의 영상은 본인이 생전에 직접 촬영·녹음한 기록으로만 제작합니다. 제3자가 고인의 사진과 음성으로 의뢰하는 재현 영상은 만들지 않습니다.',
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
      <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 py-20 sm:py-28 lg:py-32">
        <h2
          className="text-center font-bold mb-4 sm:mb-5"
          style={{
            fontSize: 'clamp(24px, 4vw, 34px)',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: 'var(--ls-heading-ko)',
            wordBreak: 'keep-all',
          }}
        >
          믿고 맡기셔도 됩니다
        </h2>
        <p
          className="text-center mb-12 sm:mb-16"
          style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)', wordBreak: 'keep-all' }}
        >
          이것만은 약속드려요.
        </p>

        {/* "온담의 약속" - 편지 느낌 카드. 크림톤 서페이스(--color-surface-warm) +
            미세한 회전(-0.4deg)으로 종이 질감을 암시하고, 4개 조항은 숫자 대신 "하나./둘./
            셋./넷." 한글 순서말로 표기해 딱딱한 리스트 대신 여유 있는 줄간격의 편지 문단처럼
            배치한다. 실제 편지 형식을 살리기 위해 상단에 "To. 고객님", 하단 서명 앞에
            "From. 온담"을 덧붙였다. 카드 전체에 손글씨 웹폰트(Nanum Pen Script,
            index.html에 구글 폰트로 로드)를 최상위 요소 1곳에만 지정해 하위 텍스트가
            전부 상속받게 한다. 손글씨 폰트는 같은 px 값이라도 작아 보이는 경향이 있어
            본문(기존 --fs-body 16px)은 19px로, 제목은 기존 대비 약 25% 키워 가독성을
            확보했다. 색상 대비는 기존 텍스트 토큰을 그대로 써도 WCAG AA(본문 4.5:1)를
            충족해(측정: --color-text-muted vs --color-surface-warm ≈ 5.13:1) 그대로
            유지한다. */}
        <div className="mx-auto max-w-3xl">
          <div
            style={{
              backgroundColor: 'var(--color-surface-warm)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-card)',
              transform: 'rotate(-0.4deg)',
              padding: 'clamp(32px, 7vw, 56px) clamp(28px, 7vw, 52px)',
              fontFamily: "'Nanum Pen Script', cursive",
            }}
          >
            <p
              className="mb-3 sm:mb-4"
              style={{ fontSize: '16px', color: 'var(--color-text-muted)' }}
            >
              To. 고객님
            </p>

            <h3
              className="text-center font-bold mb-6 sm:mb-7"
              style={{ fontSize: 'clamp(25px, 3.3vw, 30px)', color: 'var(--color-text-primary)', wordBreak: 'keep-all' }}
            >
              온담의 약속
            </h3>

            {/* 장식용 구분선은 배경색이 아니라 포인트 컬러 역할이므로, 흰색이 된
                --home-color-secondary 대신 홈 주색(그린)을 사용해 카드 배경
                (--color-surface-warm, 거의 흰색) 위에서도 뚜렷하게 보이도록 한다. */}
            <div
              className="mx-auto mb-8 sm:mb-10"
              style={{
                width: '56px',
                height: '2px',
                backgroundColor: 'var(--home-color-primary)',
                borderRadius: 'var(--radius-pill)',
              }}
              aria-hidden="true"
            />

            <div className="flex flex-col gap-8 sm:gap-9">
              {PROMISES.map(({ title, description }) => (
                <p
                  key={title}
                  style={{ fontSize: '19px', lineHeight: '1.75', wordBreak: 'keep-all' }}
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
              <span style={{ fontSize: '16px', color: 'var(--color-text-muted)' }}>
                From. 온담
              </span>
              <Mail size={15} style={{ color: 'var(--home-color-primary)' }} aria-hidden="true" />
            </div>
          </div>
        </div>

        {CONTACT_PHONE && (
          <div
            className="flex items-center justify-center gap-2 mt-16 sm:mt-20"
            style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-primary)' }}
          >
            <Phone size={18} style={{ color: 'var(--home-color-primary)' }} aria-hidden="true" />
            <span>전화로 물어보셔도 돼요</span>
            <a
              href={`tel:${CONTACT_PHONE}`}
              className="font-bold"
              style={{ color: 'var(--home-color-primary)', textDecoration: 'underline' }}
            >
              {CONTACT_PHONE}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
