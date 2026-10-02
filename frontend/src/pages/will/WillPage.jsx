import { useNavigate } from 'react-router-dom'
import {
  Mic,
  Video,
  Lock,
  Send,
  ChevronRight,
  UserRound,
  Archive,
  Info,
} from 'lucide-react'
import './WillPage.css'

const FEATURES = [
  {
    icon: Mic,
    tone: 'green',
    title: '음성 복제',
    desc: '고인의 목소리를 AI가 학습하여 자연스러운 음성으로 재현합니다.',
  },
  {
    icon: Video,
    tone: 'indigo',
    title: 'AI 영상 생성',
    desc: '사진과 음성을 결합하여 실제처럼 말하는 영상을 만들어 드립니다.',
  },
  {
    icon: Lock,
    tone: 'slate',
    title: '암호화 보관',
    desc: 'AWS KMS로 암호화된 안전한 공간에 영상을 보관합니다.',
  },
  {
    icon: Send,
    tone: 'violet',
    title: '사후 전달',
    desc: '사망 확인 후 관리자 검토를 거쳐 유가족에게 안전하게 전달합니다.',
  },
]

// 출처: 약관 제4장 취지를 요약한 가격 카드 전용 짧은 문구, 전체 문구는 LegalNotice.jsx 참조
const PRICING_NOTICE_SENTENCES = [
  '마음을 전하는 편지이며, 법적 유언의 효력은 없습니다.',
  '재산 문제는 이 영상으로 정할 수 없습니다.',
]

const PRICING_INCLUDES = [
  { icon: Video, text: '사진 1장과 음성 샘플로 영상 1편 제작 (1분 이내)' },
  { icon: UserRound, text: '수신인 1명' },
  { icon: Archive, text: '보관비 포함' },
]

export default function WillPage() {
  const navigate = useNavigate()

  return (
    <div className="will-page">
      {/* Hero */}
      <section className="will-hero">
        <div className="will-hero__inner">
          <h1 className="will-hero__title">
            목소리로 남기는 영상 편지
          </h1>
          <p className="will-hero__sub">
            AI가 내 목소리와 얼굴로 가족에게 전할{' '}
            <br />
            진심 어린 영상 메시지를 만들어요.
          </p>
          <button
            className="will-hero__cta"
            onClick={() => navigate('/will/consent')}
          >
            AI 영상 편지 만들기
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* 핵심 특징 */}
      <section className="will-features">
        <div className="will-section-inner will-features__inner">
          <h2 className="will-section-title">온담 AI 영상 편지가 특별한 이유</h2>
          <div className="will-features__grid">
            {FEATURES.map(({ icon: Icon, tone, title, desc }) => (
              <div key={title} className="will-feature-card">
                <div className="will-feature-card__icon" data-icon-tone={tone}>
                  <Icon size={24} aria-hidden="true" />
                </div>
                <h3 className="will-feature-card__title">{title}</h3>
                <p className="will-feature-card__desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 가격 안내 */}
      <section className="will-pricing">
        <div className="will-section-inner will-pricing__inner">
          <article className="will-pricing__card">
            <h2 className="will-pricing__label">AI 영상 편지 제작</h2>
            <p className="will-pricing__main">
              <span className="will-pricing__price">49,000원</span>
              <span className="will-pricing__unit">/ 건</span>
            </p>
            <button
              className="will-pricing__cta"
              onClick={() => navigate('/will/consent')}
            >
              시작하기
            </button>
            <ul className="will-pricing__includes">
              {PRICING_INCLUDES.map(({ icon: Icon, text }) => (
                <li key={text} className="will-pricing__include">
                  <Icon
                    className="will-pricing__check"
                    size={20}
                    aria-hidden="true"
                  />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            {/* 법적 유언 효력 없음 고지 - DEV-05. 카드 안, 포함 내용 아래 (카드 마지막) */}
            <div
              className="will-pricing__legal-notice"
              role="note"
              aria-label="법적 효력 안내"
            >
              <ul className="will-pricing__notice-list">
                {PRICING_NOTICE_SENTENCES.map((sentence) => (
                  <li key={sentence} className="will-pricing__include">
                    <Info
                      className="will-pricing__check"
                      size={20}
                      aria-hidden="true"
                    />
                    <span>{sentence}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}
