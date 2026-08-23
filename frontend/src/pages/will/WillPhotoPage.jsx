import { useRef } from 'react'
import { useWillPhoto } from './useWillPhoto.js'
import { ImagePlus, X, AlertCircle, CheckCircle } from 'lucide-react'
import WillStepHeader from './WillStepHeader.jsx'
import './WillPhotoPage.css'

export default function WillPhotoPage() {
  const inputRef = useRef(null)
  const { previewUrl, isUploading, uploadError, handleChange, clearPhoto } = useWillPhoto()

  return (
    <div className="will-photo-page">
      <WillStepHeader currentStep={4} title="사진 업로드" />

      <div className="will-photo__content">
        <div className="will-photo__guide-box">
          <p className="will-photo__guide-title">사진 안내</p>
          <ul className="will-photo__guide-list">
            <li>정면을 바라보는 얼굴 사진을 사용해 주세요.</li>
            <li>눈, 코, 입이 모두 보이는 사진을 권장합니다.</li>
            <li>선글라스나 모자로 얼굴이 가려지지 않도록 해 주세요.</li>
            <li>밝은 조명에서 촬영된 고화질 사진이 좋습니다.</li>
          </ul>
        </div>

        {/* 업로드 영역 */}
        {!previewUrl ? (
          <button
            type="button"
            className="will-photo__drop-area"
            onClick={() => inputRef.current?.click()}
            aria-label="얼굴 사진 업로드"
          >
            <ImagePlus size={48} aria-hidden="true" />
            <span className="will-photo__drop-label">사진을 선택해 주세요</span>
            <span className="will-photo__drop-hint">JPG, PNG, WEBP 지원</span>
          </button>
        ) : (
          <div className="will-photo__preview-wrap">
            <img
              src={previewUrl}
              alt="업로드된 얼굴 사진 미리보기"
              className="will-photo__preview-img"
              loading="lazy"
            />
            {!isUploading && (
              <button
                type="button"
                className="will-photo__preview-remove"
                onClick={clearPhoto}
                aria-label="사진 제거"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="will-photo__file-input"
          onChange={handleChange}
          aria-label="사진 파일 선택"
        />

        {/* 상태 표시 */}
        {isUploading && (
          <div className="will-photo__status is-loading" aria-live="polite">
            <span className="will-photo__spinner" aria-hidden="true" />
            사진을 업로드하고 있습니다...
          </div>
        )}

        {!isUploading && previewUrl && !uploadError && (
          <div className="will-photo__status is-done" aria-live="polite">
            <CheckCircle size={18} aria-hidden="true" />
            업로드 완료 - 다음 단계로 이동합니다
          </div>
        )}

        {uploadError && (
          <div className="will-photo__error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            {uploadError}
            <button
              type="button"
              className="will-photo__retry-btn"
              onClick={() => inputRef.current?.click()}
            >
              다시 선택
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
