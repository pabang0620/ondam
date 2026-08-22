import { useState } from 'react'
import { Heart, AlertCircle, Clock, Lock, ShieldCheck } from 'lucide-react'
import { useWillWatch, PHASE } from './useWillWatch.js'
import './WillWatchPage.css'

/* 본인 확인 입력 화면 - 어르신 UX 규칙(48px 터치, 16px 이상 폰트) 준수.
   실패해도 무엇을 하면 되는지 바로 알 수 있게 안내한다. */
function VerifyStep({ beneficiaryName, verifyError, isVerifying, onSubmit }) {
  const [phoneLast4, setPhoneLast4] = useState('')

  const handleChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 4)
    setPhoneLast4(digitsOnly)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (phoneLast4.length !== 4 || isVerifying) return
    onSubmit(phoneLast4)
  }

  return (
    <div className="will-watch__verify">
      <ShieldCheck size={40} aria-hidden="true" />
      <p className="will-watch__greeting">
        {beneficiaryName ? `${beneficiaryName}님께 도착한 영상 편지입니다` : '도착한 영상 편지입니다'}
      </p>
      <p className="will-watch__verify-desc">
        소중한 영상을 안전하게 보내드리기 위해<br />
        본인 확인이 한 번 필요합니다.
      </p>
      <form onSubmit={handleSubmit} className="will-watch__verify-form">
        <label htmlFor="phoneLast4" className="will-watch__verify-label">
          휴대폰 번호 뒤 4자리를 입력해 주세요
        </label>
        <input
          id="phoneLast4"
          className="will-watch__verify-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={4}
          value={phoneLast4}
          onChange={handleChange}
          placeholder="0000"
          aria-describedby={verifyError ? 'verify-error' : undefined}
        />
        {verifyError && (
          <p id="verify-error" role="alert" className="will-watch__verify-error">
            <AlertCircle size={16} aria-hidden="true" />
            {verifyError}
          </p>
        )}
        <button
          type="submit"
          className="will-watch__verify-button"
          disabled={phoneLast4.length !== 4 || isVerifying}
        >
          {isVerifying ? '확인 중...' : '확인'}
        </button>
      </form>
      <p className="will-watch__verify-hint">
        등록된 번호를 모르시나요? 가족 대표자에게 문의해 주세요.
      </p>
    </div>
  )
}

/* 잠금 화면 - 5회 오입력 시 진입. 자책하지 않도록, 다음 행동만 명확히 안내한다. */
function LockedStep({ verifyError }) {
  return (
    <div className="will-watch__error" role="alert">
      <Lock size={48} aria-hidden="true" />
      <p className="will-watch__error-title">잠시 확인이 필요합니다</p>
      <p className="will-watch__error-desc">
        {verifyError ?? '본인 확인 시도 횟수를 초과했습니다.'}<br />
        아래 고객센터로 연락 주시면 바로 도와드리겠습니다.
      </p>
    </div>
  )
}

/* 준비 화면 - 자동 재생하지 않는다(SPEC-05 2절). 감정적 충격을 배려해 사용자가
   직접 눌렀을 때만 영상이 나타난다. */
function PrepareStep({ willTitle, onStart }) {
  return (
    <div className="will-watch__prepare">
      <Heart size={40} aria-hidden="true" />
      <p className="will-watch__greeting">본인 확인이 완료되었습니다</p>
      {willTitle && <h1 className="will-watch__title">{willTitle}</h1>}
      <p className="will-watch__prepare-desc">
        마음의 준비가 되시면 아래 버튼을 눌러주세요.
      </p>
      <button type="button" className="will-watch__prepare-button" onClick={onStart}>
        영상 열어보기
      </button>
    </div>
  )
}

export default function WillWatchPage() {
  const {
    phase,
    beneficiaryName,
    willTitle,
    willData,
    fetchError,
    verifyError,
    isVerifying,
    submitVerification,
    startPlayback,
  } = useWillWatch()

  if (phase === PHASE.LOADING) {
    return (
      <div className="will-watch-page">
        <div className="will-watch__loading" aria-live="polite" aria-label="불러오는 중">
          <span className="will-watch__spinner" aria-hidden="true" />
          <p>불러오는 중입니다...</p>
        </div>
      </div>
    )
  }

  if (phase === PHASE.ERROR) {
    return (
      <div className="will-watch-page">
        <div className="will-watch__error" role="alert">
          <AlertCircle size={48} aria-hidden="true" />
          <p className="will-watch__error-title">영상을 열 수 없습니다</p>
          <p className="will-watch__error-desc">{fetchError}</p>
        </div>
      </div>
    )
  }

  if (phase === PHASE.LOCKED) {
    return (
      <div className="will-watch-page">
        <LockedStep verifyError={verifyError} />
      </div>
    )
  }

  if (phase === PHASE.VERIFY) {
    return (
      <div className="will-watch-page">
        <VerifyStep
          beneficiaryName={beneficiaryName}
          verifyError={verifyError}
          isVerifying={isVerifying}
          onSubmit={submitVerification}
        />
      </div>
    )
  }

  if (phase === PHASE.PREPARE) {
    return (
      <div className="will-watch-page">
        <PrepareStep willTitle={willTitle} onStart={startPlayback} />
      </div>
    )
  }

  if (!willData) return null

  return (
    <div className="will-watch-page">
      <div className="will-watch__content">
        {/* 감성 헤더 */}
        <div className="will-watch__header">
          <Heart size={32} aria-hidden="true" />
          <p className="will-watch__greeting">소중한 분의 마지막 메시지입니다</p>
          {willData.will?.title && (
            <h1 className="will-watch__title">{willData.will.title}</h1>
          )}
        </div>

        {/* 비디오 */}
        <div className="will-watch__video-wrap">
          <video
            className="will-watch__video"
            controls
            src={willData.videoUrl}
            aria-label="유언 영상"
            preload="metadata"
          >
            이 브라우저에서는 영상 재생이 지원되지 않습니다.
          </video>
        </div>

        {/* 링크 유효기간 안내 */}
        <div className="will-watch__expire-notice">
          <Clock size={16} aria-hidden="true" />
          <span>
            이 링크는 일정 기간 후 만료될 수 있습니다.
            영상을 소중히 간직하시기 바랍니다.
          </span>
        </div>
      </div>
    </div>
  )
}
