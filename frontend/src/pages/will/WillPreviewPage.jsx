import { useWillPreview } from './useWillPreview.js'
import { Users, Mic, Image, AlertCircle } from 'lucide-react'
import WillStepHeader from './WillStepHeader.jsx'
import './WillPreviewPage.css'

export default function WillPreviewPage() {
  const {
    beneficiaries,
    audioS3Key,
    photoS3Key,
    title,
    setTitle,
    contentText,
    setContentText,
    isSubmitting,
    submitError,
    handleSubmit,
  } = useWillPreview()

  return (
    <div className="will-preview-page">
      <WillStepHeader currentStep={5} title="미리보기" />

      <div className="will-preview__content">
        {/* 수집된 정보 요약 */}
        <section className="will-preview__summary" aria-label="입력 정보 요약">
          <h2 className="will-preview__section-title">입력된 정보 확인</h2>

          <div className="will-preview__summary-row">
            <Users size={20} aria-hidden="true" />
            <span>유가족 {beneficiaries.length}명 등록</span>
            {beneficiaries.length > 0 && (
              <ul className="will-preview__ben-chips" aria-label="등록된 유가족">
                {beneficiaries.map((b, i) => (
                  <li key={i} className="will-preview__chip">{b.name} ({b.relationship || '미설정'})</li>
                ))}
              </ul>
            )}
          </div>

          <div className={`will-preview__summary-row ${audioS3Key ? 'is-done' : 'is-missing'}`}>
            <Mic size={20} aria-hidden="true" />
            <span>{audioS3Key ? '음성 녹음 완료' : '음성 녹음 없음'}</span>
          </div>

          <div className={`will-preview__summary-row ${photoS3Key ? 'is-done' : 'is-missing'}`}>
            <Image size={20} aria-hidden="true" />
            <span>{photoS3Key ? '얼굴 사진 업로드 완료' : '사진 업로드 없음'}</span>
          </div>
        </section>

        {/* 유언장 제목 */}
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

        {/* 유언 텍스트 */}
        <div className="will-preview__field">
          <label className="will-preview__label" htmlFor="will-content">
            편지 내용
            <span className="will-preview__required" aria-label="필수">*</span>
          </label>
          <p className="will-preview__field-hint">
            AI가 이 텍스트를 당신의 목소리로 읽어 영상을 만들어 드립니다.
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
            aria-describedby={submitError ? 'preview-error' : undefined}
          />
          <span className="will-preview__char-count">{contentText.length}자</span>
        </div>

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
