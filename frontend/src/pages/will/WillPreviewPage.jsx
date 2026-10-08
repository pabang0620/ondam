import { useWillPreview } from './useWillPreview.js'
import { Users, AlertCircle } from 'lucide-react'
import WillStepHeader from './WillStepHeader.jsx'
import './WillPreviewPage.css'

// 낭독 분량 안내용 가정치(분당 글자 수). 정확한 약속이 아닌 "약" 표기에만 사용한다.
const READ_CHARS_PER_MINUTE = 300

export default function WillPreviewPage() {
  const {
    beneficiaries,
    title,
    setTitle,
    contentText,
    setContentText,
    isSubmitting,
    submitError,
    handleSubmit,
  } = useWillPreview()

  const readMinutes = contentText.length > 0
    ? Math.max(1, Math.ceil(contentText.length / READ_CHARS_PER_MINUTE))
    : 0

  return (
    <div className="will-preview-page">
      <WillStepHeader currentStep={5} title="편지 쓰기" />

      <div className="will-preview__content">
        {/* 편지 입력 (페이지의 중심) */}
        <div className="will-preview__field">
          <label className="will-preview__label" htmlFor="will-content">
            목소리로 읽어 드릴 편지
            <span className="will-preview__required" aria-label="필수">*</span>
          </label>
          <p id="will-content-hint" className="will-preview__hint">
            쓰신 편지를 내 얼굴 사진 속 모습이 내 목소리로 읽어 드립니다.
          </p>
          <textarea
            id="will-content"
            className="will-preview__textarea"
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="사랑하는 가족에게 전하고 싶은 말을 자유롭게 적어주세요..."
            rows={10}
            aria-required="true"
            aria-invalid={!contentText.trim() && submitError ? 'true' : 'false'}
            aria-describedby={submitError ? 'will-content-hint preview-error' : 'will-content-hint'}
          />
          <div className="will-preview__count-row">
            {readMinutes > 0 && (
              <span className="will-preview__read-time">약 {readMinutes}분 분량으로 읽어 드립니다</span>
            )}
            <span className="will-preview__char-count">{contentText.length}자</span>
          </div>
        </div>

        {/* 영상 편지 제목: 서버가 빈 제목을 거부(min 1)하므로 "(선택)" 표기하지 않는다 */}
        <div className="will-preview__field">
          <label className="will-preview__label" htmlFor="will-title">영상 편지 제목</label>
          <input
            id="will-title"
            type="text"
            className="will-preview__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="나의 영상 편지"
            maxLength={50}
          />
        </div>

        {/* 받는 분 목록 */}
        <section className="will-preview__summary" aria-label="받는 분">
          <div className="will-preview__summary-row">
            <Users size={20} aria-hidden="true" />
            <span className="will-preview__summary-text">유가족 {beneficiaries.length}명 등록</span>
            <ul className="will-preview__ben-chips" aria-label="등록된 유가족">
              {beneficiaries.map((b, i) => (
                <li key={i} className="will-preview__chip">{b.name} ({b.relationship || '미설정'})</li>
              ))}
            </ul>
          </div>
        </section>

        {submitError && (
          <div id="preview-error" className="will-preview__error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            {submitError}
          </div>
        )}

        <button
          type="button"
          className="will-preview__submit"
          onClick={handleSubmit}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? '저장 중...' : '제작 시작 및 결제'}
        </button>
      </div>
    </div>
  )
}
