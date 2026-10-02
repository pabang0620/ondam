import { UploadCloud, Sparkles, PackageCheck, Image as ImageIcon } from 'lucide-react'
import useAnimateInView from './useAnimateInView.js'
import './HomeProcess.css'

// 사진관 제작 과정을 "좌(이미지 목업) - 우(텍스트 타임라인)" 2단 레이아웃으로 안내한다.
// PLACEHOLDER 안내: 원래 이 위치에는 실제 제작 예시 스크린샷/영상이 들어가야
// 하지만(03 문서 4절), 아직 실물 자산이 없다. 브랜드 원칙(11 문서 5절 "미검증
// 자산을 검증된 실적처럼 포장 금지")에 따라 실제 화면인 것처럼 보이는 가짜
// 캡처는 만들지 않는다 - 대신 div/CSS로만 그린 추상적인 "앱 미리보기" 프레임을
// 좌측에 배치해 절차를 시각적으로 암시하고, 우측에는 절차를 담백하게 설명하는
// 텍스트 타임라인을 둔다. 실물 자산이 확보되면 좌측 목업만 실제 스크린샷으로
// 교체하면 된다.
const PROCESS_STEPS = [
  {
    title: '사진을 올려요',
    description: '빛바랜 사진 한 장이면 충분해요. 어떤 용도로 쓸지만 골라주세요.',
  },
  {
    title: 'AI가 다듬어요',
    description: '복원과 컬러화, 배경 정리를 진행해요. 다 되면 문자로 알려드려요.',
  },
  {
    title: '결과물 4종을 받아요',
    description: '완성된 사진 4장을 각각 저장하거나 한 번에 내려받을 수 있어요.',
  },
]

export default function HomeProcess() {
  const [animRef, animating] = useAnimateInView(true)
  return (
    <section className="w-full" style={{ backgroundColor: 'var(--color-bg-alt)' }}>
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
          이렇게 만들어드려요
        </h2>
        <p
          className="text-center mb-12 sm:mb-16"
          style={{ fontSize: 'var(--fs-body-lg)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)', wordBreak: 'keep-all' }}
        >
          사진 한 장이면 시작할 수 있어요.
          <br />
          절차는 이렇게 진행돼요.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* 좌측: CSS로 그린 "앱 미리보기" 목업 (실제 스크린샷 아님, 순수 장식) */}
          <div aria-hidden="true" className="w-full">
            <div
              ref={animRef}
              className={`w-full mx-auto ondam-process-mock${animating ? ' is-animating' : ''}`}
              style={{
                maxWidth: '420px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 24px 50px rgba(0,0,0,0.10)',
                overflow: 'hidden',
              }}
            >
              {/* 상단 바 */}
              <div
                className="flex items-center gap-2"
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-alt)',
                }}
              >
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--home-color-accent)' }} />
                {/* 흰색이 된 --home-color-secondary는 상단 바 배경(--color-bg-alt, 거의
                    흰색)과 구분되지 않으므로 얇은 테두리를 더해 점 형태를 유지한다. */}
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--home-color-secondary)',
                    border: '1px solid var(--color-border)',
                  }}
                />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--home-color-primary-light)' }} />
                <span
                  style={{
                    marginLeft: '8px',
                    flex: 1,
                    height: '20px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                />
              </div>

              {/* 본문 */}
              <div style={{ padding: '22px' }}>
                <div className="flex items-center gap-2" style={{ marginBottom: '14px' }}>
                  <UploadCloud size={16} style={{ color: 'var(--home-color-primary)' }} />
                  <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    업로드한 사진
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5" style={{ marginBottom: '22px' }}>
                  <div
                    className="flex items-center justify-center ondam-process-tile"
                    style={{ aspectRatio: '1 / 1', borderRadius: 'var(--radius-card)', backgroundColor: 'var(--home-color-primary-soft)' }}
                  >
                    <ImageIcon size={22} style={{ color: 'var(--home-color-primary)' }} />
                  </div>
                  {/* 소프트 옐로우(--home-color-secondary-soft)는 흰색으로 바뀌지 않았지만
                      매우 옅은 톤이라 거의 흰 배경 위에서 형태가 잘 드러나지 않으므로
                      얇은 테두리를 더해 썸네일 placeholder 윤곽을 유지한다. */}
                  <div
                    className="ondam-process-tile"
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: 'var(--radius-card)',
                      backgroundColor: 'var(--home-color-secondary-soft)',
                      border: '1px solid var(--color-border)',
                    }}
                  />
                  <div className="ondam-process-tile" style={{ aspectRatio: '1 / 1', borderRadius: 'var(--radius-card)', backgroundColor: 'var(--home-color-primary-light)', opacity: 0.35 }} />
                  <div className="ondam-process-tile" style={{ aspectRatio: '1 / 1', borderRadius: 'var(--radius-card)', backgroundColor: 'var(--home-color-primary-soft)' }} />
                </div>

                <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
                  <Sparkles size={16} className="ondam-process-spark" style={{ color: 'var(--home-color-primary)' }} />
                  <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    AI 보정 중 · <span className="ondam-process-pct" />
                  </span>
                </div>
                <div
                  style={{
                    height: '10px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'var(--home-color-primary-soft)',
                    overflow: 'hidden',
                    marginBottom: '22px',
                  }}
                >
                  {/* 프로그레스 바 fill은 순수 장식이라 대비 기준이 적용되지
                      않으므로 레퍼런스 그라디언트를 그대로 쓴다. background(단축
                      프로퍼티) 사용 필수 - backgroundColor에는 그라디언트가
                      적용되지 않는다. */}
                  <div className="ondam-process-fill" style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-pill)', background: 'var(--home-gradient-decor)' }} />
                </div>

                <div className="flex items-center gap-2">
                  <PackageCheck size={16} className="ondam-process-done" style={{ color: 'var(--home-color-primary)' }} />
                  <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    결과물 4종 준비 완료
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 우측: 3단계 텍스트 타임라인 */}
          <div className="w-full">
            {PROCESS_STEPS.map(({ title, description }, index) => (
              <div
                key={title}
                style={{ paddingBottom: index < PROCESS_STEPS.length - 1 ? '28px' : 0 }}
              >
                {/* 이 섹션은 <section>에 배경을 지정하지 않아 부모의
                    --color-bg-alt(#E8E8ED)가 그대로 비친다 - 3개 배경(surface/
                    bg/bg-alt) 중 가장 어두운 worst case로, HomePage.jsx
                    HOME_THEME_VARS 주석의 실측값(5.340:1)이 바로 이 텍스트
                    기준이다. */}
                <span
                  className="block font-semibold"
                  style={{ fontSize: 'var(--fs-caption)', color: 'var(--home-color-primary)', marginBottom: '4px', letterSpacing: '0.02em' }}
                >
                  STEP {index + 1}
                </span>
                <h3
                  className="font-semibold"
                  style={{ fontSize: 'var(--fs-h3)', color: 'var(--color-text-primary)', wordBreak: 'keep-all', marginBottom: '6px' }}
                >
                  {title}
                </h3>
                <p
                  className="leading-relaxed"
                  style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', wordBreak: 'keep-all' }}
                >
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p
          className="text-center mt-12 sm:mt-16"
          style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)', wordBreak: 'keep-all' }}
        >
          실제 제작 예시와 전후 비교는 준비 중입니다.
          <br />
          준비되는 대로 이 자리에서 보여드릴게요.
        </p>
      </div>
    </section>
  )
}
