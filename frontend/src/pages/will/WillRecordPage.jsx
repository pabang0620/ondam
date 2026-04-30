import { useWillRecord } from './useWillRecord.js'
import { Mic, MicOff, Upload, RotateCcw, AlertCircle } from 'lucide-react'
import WillStepHeader from './WillStepHeader.jsx'
import './WillRecordPage.css'

export default function WillRecordPage() {
  const {
    isRecording,
    recordedBlob,
    audioUrl,
    isUploading,
    uploadError,
    formattedDuration,
    startRecording,
    stopRecording,
    resetRecording,
    handleUpload,
  } = useWillRecord()

  return (
    <div className="will-record-page">
      <WillStepHeader currentStep={2} title="음성 녹음" />

      <div className="will-record__content">
        <div className="will-record__guide-box">
          <p className="will-record__guide-title">녹음 안내</p>
          <ul className="will-record__guide-list">
            <li>조용한 장소에서 녹음해 주세요.</li>
            <li>10분 ~ 30분 분량을 권장합니다.</li>
            <li>가족에게 하고 싶은 말을 자유롭게 말씀해 주세요.</li>
            <li>목소리가 잘 들리도록 마이크와 15cm 이내 거리를 유지해 주세요.</li>
          </ul>
        </div>

        {/* 녹음 버튼 */}
        <div className="will-record__btn-area">
          {!recordedBlob ? (
            <button
              type="button"
              className={`will-record__btn ${isRecording ? 'is-recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              aria-label={isRecording ? '녹음 중지' : '녹음 시작'}
            >
              {isRecording
                ? <MicOff size={36} aria-hidden="true" />
                : <Mic size={36} aria-hidden="true" />}
              <span className="will-record__btn-label">
                {isRecording ? '중지' : '녹음 시작'}
              </span>
            </button>
          ) : (
            <div className="will-record__done-badge" aria-live="polite">
              <Mic size={24} aria-hidden="true" />
              녹음 완료
            </div>
          )}

          {/* 타이머 */}
          {(isRecording || recordedBlob) && (
            <div
              className={`will-record__timer ${isRecording ? 'is-active' : ''}`}
              aria-live="polite"
              aria-atomic="true"
            >
              {formattedDuration}
            </div>
          )}

          {/* 파형 애니메이션 */}
          {isRecording && (
            <div className="will-record__waveform" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="will-record__wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}
        </div>

        {/* 오디오 미리듣기 */}
        {audioUrl && (
          <div className="will-record__preview">
            <p className="will-record__preview-label">녹음 미리듣기</p>
            <audio
              controls
              src={audioUrl}
              className="will-record__audio"
              aria-label="녹음된 음성 미리듣기"
            />
            <button
              type="button"
              className="will-record__retry"
              onClick={resetRecording}
              aria-label="다시 녹음하기"
            >
              <RotateCcw size={16} aria-hidden="true" />
              다시 녹음
            </button>
          </div>
        )}

        {/* 에러 */}
        {uploadError && (
          <div className="will-record__error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            {uploadError}
          </div>
        )}

        {/* 업로드 */}
        {recordedBlob && (
          <button
            type="button"
            className="will-record__upload"
            onClick={handleUpload}
            disabled={isUploading}
            aria-busy={isUploading}
          >
            <Upload size={20} aria-hidden="true" />
            {isUploading ? '업로드 중...' : '다음 - 사진 업로드'}
          </button>
        )}
      </div>
    </div>
  )
}
