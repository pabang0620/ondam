import { UploadCloud, Sparkles, PackageCheck } from 'lucide-react'

// 사진관 제작 과정을 텍스트·아이콘으로 안내한다.
// PLACEHOLDER 안내: 원래 이 위치에는 복원 전후 비교 슬라이더와 실제 제작 예시
// 영상이 들어가야 하지만(03 문서 4절), 아직 실물 자산이 없다. 브랜드 원칙(11 문서
// 5절 "미검증 자산을 검증된 실적처럼 포장 금지")에 따라 가짜 이미지·연출된
// before/after는 만들지 않는다. 실물 자산이 확보되면 이 섹션을 슬라이더/영상
// 컴포넌트로 교체할 것 - 지금은 절차를 담백하게 설명하는 3단계 안내로 대체한다.
const PROCESS_STEPS = [
  {
    icon: UploadCloud,
    title: '사진을 올려요',
    description: '빛바랜 사진 한 장이면 충분해요. 어떤 용도로 쓸지만 골라주세요.',
  },
  {
    icon: Sparkles,
    title: 'AI가 다듬어요',
    description: '복원과 컬러화, 배경 정리를 진행해요. 다 되면 문자로 알려드려요.',
  },
  {
    icon: PackageCheck,
    title: '결과물 4종을 받아요',
    description: '완성된 사진 4장을 각각 저장하거나 한 번에 내려받을 수 있어요.',
  },
]

export default function HomeProcess() {
  return (
    <section className="w-full" style={{ backgroundColor: 'var(--color-bg-alt)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 py-20 sm:py-28 lg:py-32">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 lg:gap-12">
          {PROCESS_STEPS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col items-center text-center gap-4">
              <div
                className="w-14 h-14 flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--color-border)',
                }}
                aria-hidden="true"
              >
                <Icon size={24} style={{ color: 'var(--color-warm-accent)' }} />
              </div>
              <h3
                className="font-bold"
                style={{ fontSize: 'var(--fs-h3)', color: 'var(--color-text-primary)', wordBreak: 'keep-all' }}
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
