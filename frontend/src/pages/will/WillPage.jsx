import { useNavigate } from 'react-router-dom'
import {
  Mic,
  Video,
  Lock,
  Send,
  ChevronRight,
  CheckCircle,
  Heart,
} from 'lucide-react'
import './WillPage.css'

const FEATURES = [
  {
    icon: Mic,
    title: '음성 복제',
    desc: '고인의 목소리를 AI가 학습하여 자연스러운 음성으로 재현합니다.',
  },
  {
    icon: Video,
    title: 'AI 영상 생성',
    desc: '사진과 음성을 결합하여 실제처럼 말하는 영상을 만들어 드립니다.',
  },
  {
    icon: Lock,
    title: '암호화 보관',
    desc: 'AWS KMS로 암호화된 안전한 공간에 영상을 보관합니다.',
  },
  {
    icon: Send,
    title: '사후 전달',
    desc: '사망 확인 후 관리자 검토를 거쳐 유가족에게 안전하게 전달합니다.',
  },
]

const STEPS = [
  { num: 1, label: '동의' },
  { num: 2, label: '녹음' },
  { num: 3, label: '사진' },
  { num: 4, label: '생성' },
  { num: 5, label: '보관' },
]

export default function WillPage() {
  const navigate = useNavigate()

  return (
    <div className="will-page">
      {/* Hero */}
      <section className="will-hero">
        <div className="will-hero__inner">
          <Heart className="will-hero__icon" size={48} aria-hidden="true" />
          <h1 className="will-hero__title">
            사랑하는 가족에게 전하는
            <br />
            마지막 선물
          </h1>
          <p className="will-hero__sub">
            AI가 당신의 목소리와 얼굴을 기억합니다.
            <br />
            세상을 떠난 후에도 진심이 담긴 영상 메시지가
            <br />
            사랑하는 이들에게 전달됩니다.
          </p>
          <button
            className="will-hero__cta"
            onClick={() => navigate('/will/consent')}
          >
            AI 유언장 만들기
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* 핵심 특징 */}
      <section className="will-features">
        <div className="will-section-inner">
          <h2 className="will-section-title">온담 AI 유언장이 특별한 이유</h2>
          <div className="will-features__grid">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="will-feature-card">
                <div className="will-feature-card__icon">
                  <Icon size={28} aria-hidden="true" />
                </div>
                <h3 className="will-feature-card__title">{title}</h3>
                <p className="will-feature-card__desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 제작 단계 */}
      <section className="will-steps">
        <div className="will-section-inner">
          <h2 className="will-section-title">5단계로 완성되는 AI 유언장</h2>
          <div className="will-steps__track">
            {STEPS.map((step, idx) => (
              <div key={step.num} className="will-step">
                <div className="will-step__circle">{step.num}</div>
                <span className="will-step__label">{step.label}</span>
                {idx < STEPS.length - 1 && (
                  <div className="will-step__line" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 가격 */}
      <section className="will-pricing">
        <div className="will-section-inner">
          <h2 className="will-section-title">가격 안내</h2>
          <div className="will-pricing__card">
            <div className="will-pricing__main">
              <span className="will-pricing__label">AI 유언장 제작</span>
              <span className="will-pricing__price">49,000원</span>
              <span className="will-pricing__unit">/ 건</span>
            </div>
            <ul className="will-pricing__list">
              <li><CheckCircle size={16} aria-hidden="true" /> 음성 복제 포함</li>
              <li><CheckCircle size={16} aria-hidden="true" /> AI 영상 생성 포함</li>
              <li><CheckCircle size={16} aria-hidden="true" /> 암호화 보관 포함</li>
              <li><CheckCircle size={16} aria-hidden="true" /> 유가족 전달 포함</li>
            </ul>
            <div className="will-pricing__subscription">
              <Lock size={14} aria-hidden="true" />
              장기 보관 구독: <strong>1,900원/월</strong> — 영상이 안전하게 보관됩니다
            </div>
            <button
              className="will-pricing__cta"
              onClick={() => navigate('/will/consent')}
            >
              지금 시작하기
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
