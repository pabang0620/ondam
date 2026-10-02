import { Fragment } from 'react'

// 3D 아이콘 출처: 3dicons.co (github.com/realvjy/3dicons), CC0 라이선스 -
// 저작자 표시 불필요, 상업적 사용 자유. 기존 lucide Phone 아이콘을
// 대체한다. 고정 렌더링 색을 가진 raster 이미지라 색을 바꿀 수 없으므로
// (기존 lucide처럼 var(--home-color-primary)로 색을 입히지 않고) 이미지
// 고유색(오렌지~코랄 글로시 렌더)을 그대로 사용한다.
const CALL_ICON_URL = 'https://bvconuycpdvgzbvbkijl.supabase.co/storage/v1/object/public/sizes/1b19dc-call-only/dynamic/200/color.webp'

// 07 문서 3절 "온담의 약속" 초안 4문장 - 원문 그대로 게시한다.
const PROMISES = [
  {
    title: '하나. 본인의 기록만 만듭니다',
    description: [
      '온담의 영상은 본인이 생전에 직접 촬영·녹음한 기록으로만 제작합니다.',
      '제3자가 고인의 사진과 음성으로 의뢰하는 재현 영상은 만들지 않습니다.',
    ],
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

// "온담의 약속" 편지지 스타일. 종이색 토큰이 없어 이 컴포넌트에 한정해 정의한다.
// 텍스트 가독성(AA)을 위해 줄/결의 alpha는 0.04 이하로 유지한다.
const PAPER_BG = '#FFFFFF'
const PAPER_TEXTURE = [
  // 상단 접힘 느낌: 위쪽 가장자리만 아주 옅게 어두워짐
  'linear-gradient(to bottom, rgba(29, 29, 31, 0.04) 0, rgba(29, 29, 31, 0) 14px)',
  // 미세한 종이 결(점 패턴)
  'radial-gradient(rgba(29, 29, 31, 0.03) 0.6px, transparent 0.8px)',
  // 옅은 가로 줄(편지지)
  'linear-gradient(to bottom, transparent 31px, rgba(29, 29, 31, 0.04) 31px, rgba(29, 29, 31, 0.04) 32px)',
].join(', ')
const PAPER_SHADOW = [
  '0 1px 1px rgba(29, 29, 31, 0.06)',
  '0 2px 4px rgba(29, 29, 31, 0.05)',
  '0 8px 16px rgba(29, 29, 31, 0.05)',
  '0 16px 32px rgba(29, 29, 31, 0.04)',
].join(', ')

// 전화 문의 번호는 하드코딩하지 않는다. 미설정 시 관련 UI를 숨긴다.
// .env에 VITE_CONTACT_PHONE=0000-0000 형태로 설정하면 노출된다.
const CONTACT_PHONE = import.meta.env.VITE_CONTACT_PHONE

export default function HomeTrust() {
  return (
    <section className="w-full relative overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 pt-12 pb-20 sm:pt-16 sm:pb-28 lg:pt-20 lg:pb-32">
        {/* "온담의 약속" - 편지지(종이) 형태. 카드 테두리/둥근 모서리/카드 그림자를
            쓰지 않고, 흰색 종이색(PAPER_BG) + 옅은 가로 줄/미세 결 gradient + 여러 겹의
            약한 그림자 + 미세한 회전(-0.4deg)으로 배경 위에 놓인 종이를 표현한다.
            4개 조항은 숫자 대신 "하나./둘./셋./넷." 한글 순서말로 표기해 딱딱한 리스트 대신 여유 있는 줄간격의 편지 문단처럼
            배치한다. 실제 편지 형식을 살리기 위해 상단에 "To. 고객님", 하단 서명 앞에
            "From. 온담"을 덧붙였다. 종이 전체에 조선100년체 웹폰트(Joseon100Years,
            global.css의 @font-face, 폴백 Nanum Pen Script)를 최상위 요소 1곳에만 지정해
            하위 텍스트가 전부 상속받게 한다. 조선100년체는 일반 명조 계열이라 손글씨체처럼
            작아 보이지 않으므로 본문은 17px로 두고, 제목은 기존 크기(약 25% 키움)를
            유지해 위계를 확보했다. 색상 대비: 종이색은 토큰에 없어 이 파일에 한정해 정의한다.
            --color-text-muted(#6B6B70) vs PAPER_BG(#FFFFFF) ≈ 5.30:1, 가로 줄 위
            최악 지점(줄 0.04 + 결 점 0.03 겹침, 약 #EFEFEF) ≈ 4.62:1로 WCAG AA(본문 4.5:1) 충족.
            --color-text-primary(#333336)는 흰 종이 ≈ 12.59:1, 최악 지점(≈#EFEFF0) ≈ 10.96:1. 조선100년체는 400 굵기만 있어 제목·약속 제목은 fontWeight 400으로 명시(가짜 볼드 방지). 줄+결 합산 alpha를 올리면 AA 아래로
            떨어질 수 있으니 줄 0.04, 결 0.03(합 0.07)을 넘기지 말 것. 틴트는 갈색이 아닌 중립 회색(29,29,31)이라 흰 종이가 누렇게 보이지 않는다. */}
        <div className="mx-auto max-w-3xl">
          <div
            style={{
              backgroundColor: PAPER_BG,
              backgroundImage: PAPER_TEXTURE,
              backgroundSize: '100% 100%, 5px 5px, 100% 32px',
              borderRadius: '2px',
              boxShadow: PAPER_SHADOW,
              transform: 'rotate(-0.4deg)',
              padding: 'clamp(32px, 7vw, 56px) clamp(28px, 7vw, 52px)',
              fontFamily: "'Joseon100Years', 'Nanum Pen Script', cursive",
            }}
          >
            <p
              className="mb-3 sm:mb-4"
              style={{ fontSize: '16px', color: 'var(--color-text-muted)' }}
            >
              To. 고객님
            </p>

            <h3
              className="text-center mb-6 sm:mb-7"
              style={{
                fontWeight: 400,
                fontSize: 'clamp(25px, 3.3vw, 30px)',
                color: 'var(--color-text-primary)',
                wordBreak: 'keep-all',
              }}
            >
              온담의 약속
            </h3>

            {/* 장식용 구분선은 배경색이 아니라 포인트 컬러 역할이므로, 흰색이 된
                --home-color-secondary 대신 홈 주색(그린)을 사용해 종이 배경(PAPER_BG)
                위에서도 뚜렷하게 보이도록 한다. */}
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
                  style={{ fontSize: '17px', lineHeight: '1.75', wordBreak: 'keep-all' }}
                >
                  <span style={{ fontWeight: 400, color: 'var(--color-text-primary)' }}>
                    {title}
                  </span>
                  <br />
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {[].concat(description).map((line, index) => (
                      <Fragment key={line}>
                        {index > 0 && <br />}
                        {line}
                      </Fragment>
                    ))}
                  </span>
                </p>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 mt-9 sm:mt-11">
              <span style={{ fontSize: '16px', color: 'var(--color-text-muted)' }}>
                From. 온담
              </span>            </div>
          </div>
        </div>

        {CONTACT_PHONE && (
          <div
            className="flex items-center justify-center gap-2 mt-16 sm:mt-20"
            style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-primary)' }}
          >
            <img src={CALL_ICON_URL} alt="" loading="lazy" width={28} height={28} aria-hidden="true" style={{ objectFit: 'contain' }} />
            <span>전화로 물어보셔도 돼요</span>
            <a
              href={`tel:${CONTACT_PHONE}`}
              className="font-semibold"
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
