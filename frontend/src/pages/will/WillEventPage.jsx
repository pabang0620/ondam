import { useWillEvent } from './useWillEvent.js'
import { AlertCircle } from 'lucide-react'
import './WillEventPage.css'

export default function WillEventPage() {
  const {
    wills,
    selectedWillId,
    setSelectedWillId,
    eventTypes,
    eventType,
    setEventType,
    contentText,
    setContentText,
    isSubmitting,
    submitError,
    handleSubmit,
  } = useWillEvent()

  return (
    <div className="will-event-page">
      <div className="will-event__content">
        <h1 className="will-event__title">이벤트 추가 영상</h1>
        <p className="will-event__sub">
          기존 음성을 활용하여 특별한 날을 위한 추가 영상을 제작합니다.
        </p>

        {/* 이벤트 타입 선택 */}
        <div className="will-event__field">
          <span className="will-event__label">이벤트 종류</span>
          <div className="will-event__type-group" role="group" aria-label="이벤트 종류 선택">
            {eventTypes.map(({ value, label, emoji }) => (
              <button
                key={value}
                type="button"
                className={`will-event__type-btn ${eventType === value ? 'is-active' : ''}`}
                onClick={() => setEventType(value)}
                aria-pressed={eventType === value}
              >
                <span aria-hidden="true">{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 기존 유언장 선택 */}
        {wills.length > 0 && (
          <div className="will-event__field">
            <label className="will-event__label" htmlFor="event-will-select">
              사용할 음성 (기존 유언장)
            </label>
            <select
              id="event-will-select"
              className="will-event__select"
              value={selectedWillId}
              onChange={(e) => setSelectedWillId(e.target.value)}
            >
              {wills.map((w) => (
                <option key={w.id || w.willId} value={w.id || w.willId}>
                  {w.title || '유언장'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 메시지 입력 */}
        <div className="will-event__field">
          <label className="will-event__label" htmlFor="event-content">
            이벤트 메시지
            <span className="will-event__required" aria-label="필수">*</span>
          </label>
          <textarea
            id="event-content"
            className="will-event__textarea"
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder={`${eventTypes.find((e) => e.value === eventType)?.label}을 맞이한 가족에게 하고 싶은 말을 적어주세요...`}
            rows={8}
            aria-required="true"
          />
          <span className="will-event__char-count">{contentText.length}자</span>
        </div>

        {submitError && (
          <div className="will-event__error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            {submitError}
          </div>
        )}

        <button
          type="button"
          className="will-event__submit"
          onClick={handleSubmit}
          disabled={isSubmitting || !contentText.trim()}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? '처리 중...' : '19,900원 추가 영상 제작'}
        </button>
      </div>
    </div>
  )
}
