import { Info } from 'lucide-react'
import './LegalNotice.css'

const SENTENCES = [
  '이 영상은 마음을 전하는 편지이지, 법적으로 유언의 효력을 갖는 문서가 아닙니다.',
  '재산 문제는 이 영상으로 정할 수 없습니다.',
]

/**
 * "법적 유언 효력 없음" 고지 - DEV-05 수용 기준
 * (docs/strategy/06-dev-backlog.md DEV-05: "랜딩·구매 플로우에 '법적 유언 효력은 없습니다' 고지 1줄 추가")
 *
 * 문구는 창작하지 않고 docs/legal/TERMS_OF_SERVICE.draft.md 제4장 "쉬운 말 요약"을
 * 그대로 인용한다(법적 근거는 같은 문서 제13조 1·3항). 화면 고지와 약관의 표현이
 * 어긋나면 그 자체가 분쟁 소재가 되므로 문구를 이 컴포넌트 한 곳에서만 관리한다.
 *
 * 이 문구 안의 "유언"이라는 단어는 브랜드 가이드(11-brand-messaging.md)의 명시적
 * 예외로 유지한다(고지 자체가 그 단어를 필요로 함).
 *
 * @param {'light'|'dark'} theme - light: 크림/화이트 배경 화면(결제·동의·수령 신청 등)
 *                                 dark: 차콜 배경 화면(WillWatchPage 등 유족 열람 화면)
 * @param {boolean} splitSentences - true면 '~다.' 문장마다 줄바꿈(기본 false: 기존 한 문단 흐름)
 * @param {string} className - 호출부에서 여백 등을 추가로 조정할 때 사용
 */
export default function LegalNotice({ theme = 'light', className = '', splitSentences = false }) {
  return (
    <div
      className={`legal-notice legal-notice--${theme}${className ? ` ${className}` : ''}`}
      role="note"
      aria-label="법적 효력 안내"
    >
      <Info size={20} aria-hidden="true" className="legal-notice__icon" />
      <p className="legal-notice__text">
        {splitSentences
          ? SENTENCES.map((sentence, i) => (
              <span key={sentence}>
                {i > 0 ? ' ' : null}
                <span className="legal-notice__sentence">{sentence}</span>
              </span>
            ))
          : SENTENCES.join(' ')}
      </p>
    </div>
  )
}
