import { useRef } from 'react'
import { useWillRecord } from './useWillRecord.js'
import { Mic, MicOff, Upload, RotateCcw, AlertCircle, FileAudio } from 'lucide-react'
import WillStepHeader from './WillStepHeader.jsx'
import './WillRecordPage.css'

export default function WillRecordPage() {
  const fileInputRef = useRef(null)

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
    handleFileUpload,
  } = useWillRecord()

  return (
    <div className="will-record-page">
      <WillStepHeader currentStep={3} title="음성 녹음" />

      <div className="will-record__content">
        <div className="will-record__guide-box">
          <p className="will-record__guide-title">목소리 샘플 녹음</p>
          <p className="will-record__flow-highlight">이 녹음으로 AI가 목소리를 학습합니다</p>
          <ul className="will-record__guide-list">
            <li>가족에게 하실 말씀은 다음 단계(영상 편지 내용)에서 텍스트로 작성해 주세요</li>
            <li>AI가 이 목소리로 작성하신 내용을 읽어드립니다</li>
            <li>어떤 말씀을 하셔도 됩니다 - AI가 목소리 패턴만 학습합니다</li>
            <li>조용한 장소에서 1~5분 분량을 권장합니다</li>
            <li>마이크와 15cm 이내 거리를 유지해 주세요</li>
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

        {/* 파일 업로드 섹션 - recordedBlob이 없을 때만 표시 */}
        {!recordedBlob && (
          <div className="will-record__file-upload-area">
            <div className="will-record__divider">또는 오디오 파일 업로드</div>
            <p className="will-record__file-upload-hint">
              이미 녹음된 파일이 있으시면 업로드하세요
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              hidden
              aria-hidden="true"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
                // 같은 파일 재선택 가능하도록 초기화
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="will-record__file-upload"
              onClick={() => fileInputRef.current?.click()}
              aria-label="오디오 파일 선택하여 업로드"
            >
              <FileAudio size={20} aria-hidden="true" />
              파일 업로드
            </button>
          </div>
        )}

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
