import { useRef } from 'react'
import { useWillRelease } from './useWillRelease.js'
import { Upload, FileText, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import './WillReleasePage.css'

export default function WillReleasePage() {
  const inputRef = useRef(null)
  const {
    previewUrl,
    selectedFile,
    isSubmitting,
    submitError,
    isSubmitted,
    handleFileSelect,
    handleSubmit,
  } = useWillRelease()

  if (isSubmitted) {
    return (
      <div className="will-release-page">
        <div className="will-release__done">
          <CheckCircle size={64} aria-hidden="true" />
          <h1 className="will-release__done-title">제출 완료</h1>
          <p className="will-release__done-desc">
            서류가 접수되었습니다.
            <br />
            관리자 검토 후 1~3 영업일 이내에 안내드립니다.
          </p>
          <div className="will-release__done-notice">
            <Clock size={16} aria-hidden="true" />
            검토 소요 시간: 1~3 영업일
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="will-release-page">
      <div className="will-release__content">
        <div className="will-release__header">
          <FileText size={40} aria-hidden="true" />
          <h1 className="will-release__title">유언 영상 수령 신청</h1>
          <p className="will-release__desc">
            고인의 유언을 전달받으려면 사망 확인 서류가 필요합니다.
            <br />
            서류 검토 후 1~3 영업일 이내에 영상 링크를 전달드립니다.
          </p>
        </div>

        {/* 업로드 영역 */}
        <div className="will-release__upload-area">
          <label className="will-release__label" htmlFor="release-file">
            사망 확인 서류
            <span className="will-release__required" aria-label="필수">*</span>
          </label>
          <p className="will-release__label-hint">
            사망진단서, 사망신고서 등 공식 서류를 업로드해 주세요. (PDF, JPG, PNG)
          </p>

          {!selectedFile ? (
            <button
              type="button"
              className="will-release__drop"
              onClick={() => inputRef.current?.click()}
              aria-label="사망 확인 서류 업로드"
            >
              <Upload size={40} aria-hidden="true" />
              <span className="will-release__drop-label">파일을 선택해 주세요</span>
              <span className="will-release__drop-hint">PDF, JPG, PNG 지원</span>
            </button>
          ) : (
            <div className="will-release__file-preview">
              {previewUrl && selectedFile.type.startsWith('image/') ? (
                <img
                  src={previewUrl}
                  alt="업로드된 서류 미리보기"
                  className="will-release__preview-img"
                  loading="lazy"
                />
              ) : (
                <div className="will-release__file-info">
                  <FileText size={32} aria-hidden="true" />
                  <span className="will-release__file-name">{selectedFile.name}</span>
                  <span className="will-release__file-size">
                    {(selectedFile.size / 1024).toFixed(0)} KB
                  </span>
                </div>
              )}
              <button
                type="button"
                className="will-release__reselect"
                onClick={() => inputRef.current?.click()}
                aria-label="사망 확인 서류 다시 선택"
              >
                다시 선택
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            id="release-file"
            type="file"
            accept="image/*,application/pdf"
            className="will-release__file-input"
            onChange={handleFileSelect}
            aria-label="사망 확인 서류 파일 선택"
          />
        </div>

        {/* 관리자 검토 안내 */}
        <div className="will-release__notice">
          <Clock size={16} aria-hidden="true" />
          <div>
            <p className="will-release__notice-title">관리자 검토 안내</p>
            <p className="will-release__notice-desc">
              제출된 서류는 전문 담당자가 1~3 영업일 이내에 검토합니다.
              검토 완료 후 등록된 연락처로 영상 링크를 전달드립니다.
            </p>
          </div>
        </div>

        {submitError && (
          <div className="will-release__error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            {submitError}
          </div>
        )}

        <button
          type="button"
          className="will-release__submit"
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedFile}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? '제출 중...' : '서류 제출하기'}
        </button>
      </div>
    </div>
  )
}
