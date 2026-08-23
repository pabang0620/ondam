import { useState } from 'react'
import { Heart, AlertCircle, Clock, Lock, ShieldCheck, Download, Mail } from 'lucide-react'
import { useWillWatch, PHASE } from './useWillWatch.js'
import LegalNotice from '../../components/common/LegalNotice.jsx'
import './WillWatchPage.css'

// FIX: 결함2 - 잠금/만료 화면이 "아래 고객센터로 연락 주시면"이라고 안내하지만
// 실제로 연락처를 렌더링하지 않아 유가족이 안내를 따를 수 없었다. Footer.jsx와
// 동일한 패턴(VITE_CONTACT_PHONE이 있으면 실제 번호를, 없으면 그 문구 자체를
// 노출하지 않는다)을 재사용한다. 번호를 창작하지 않는다.
const CONTACT_PHONE = import.meta.env.VITE_CONTACT_PHONE

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
        {verifyError ?? '본인 확인 시도 횟수를 초과했습니다.'}
      </p>
      {CONTACT_PHONE ? (
        <p className="will-watch__error-desc">
          고객센터(<a href={`tel:${CONTACT_PHONE}`} className="will-watch__contact-link">{CONTACT_PHONE}</a>)로
          연락 주시면 바로 도와드리겠습니다.
        </p>
      ) : (
        <p className="will-watch__error-desc">
          고객센터 연락처는 준비 중입니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </div>
  )
}

/* 만료 화면 - SPEC-05 3절. 열람을 강요하지 않는 톤으로, 다음 행동(연장 요청)만
   명확히 안내한다. */
function ExpiredStep({ isExtending, extendError, onExtend }) {
  return (
    <div className="will-watch__error" role="alert">
      <Clock size={48} aria-hidden="true" />
      <p className="will-watch__error-title">기간이 지났어요</p>
      <p className="will-watch__error-desc">
        열람 기한이 지나 이 링크는 더 이상 사용할 수 없어요.<br />
        아래 버튼을 눌러주시면 새 링크를 바로 보내드려요.
      </p>
      {extendError && (
        <p id="extend-error" role="alert" className="will-watch__verify-error">
          <AlertCircle size={16} aria-hidden="true" />
          {extendError}
        </p>
      )}
      <button
        type="button"
        className="will-watch__prepare-button"
        onClick={onExtend}
        disabled={isExtending}
        aria-busy={isExtending}
      >
        {isExtending ? '요청 중...' : '연장 요청하기'}
      </button>
    </div>
  )
}

/* 연장 요청 완료 화면 - [보안 수정 - D1] 새 링크는 화면에 직접 표시되지 않고
   등록된 연락처(이메일/문자)로만 전달된다. 사용자가 다음에 뭘 하면 되는지만
   명확히 안내한다. */
function ExtensionSentStep() {
  return (
    <div className="will-watch__error" role="status">
      <Mail size={48} aria-hidden="true" />
      <p className="will-watch__error-title">새 링크를 보내드렸어요</p>
      <p className="will-watch__error-desc">
        등록하신 연락처로 새로운 열람 링크를 보내드렸어요.<br />
        문자나 이메일을 확인해서 다시 접속해 주세요.
      </p>
      {CONTACT_PHONE && (
        <p className="will-watch__error-desc">
          잠시 후에도 도착하지 않으면 고객센터({CONTACT_PHONE})로 문의해 주세요.
        </p>
      )}
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
      {/* 법적 유언 효력 없음 고지 - DEV-05. 오인 가능성이 가장 큰 접점(유족 열람)이므로
          영상을 열기 전에 먼저 안내한다 */}
      <LegalNotice theme="dark" className="will-watch__legal-notice" />
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
    isExtending,
    extendError,
    submitVerification,
    startPlayback,
    requestExtension,
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

  if (phase === PHASE.EXPIRED) {
    return (
      <div className="will-watch-page">
        <ExpiredStep isExtending={isExtending} extendError={extendError} onExtend={requestExtension} />
      </div>
    )
  }

  if (phase === PHASE.EXTENSION_SENT) {
    return (
      <div className="will-watch-page">
        <ExtensionSentStep />
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
            aria-label="영상 편지"
            preload="metadata"
          >
            이 브라우저에서는 영상 재생이 지원되지 않습니다.
          </video>
        </div>

        {/* 영상 저장(다운로드) - SPEC-05 2절 4번. 링크가 만료돼도 유족이 영상을
            잃지 않도록 원본을 그대로 내려받게 한다(워터마크 없음). */}
        {willData.downloadUrl && (
          <div className="will-watch__download">
            <p className="will-watch__download-desc">
              이 영상은 소중한 분이 남긴, 우리가 아닌 가족 여러분의 것입니다.<br />
              링크가 만료되기 전에 휴대폰이나 컴퓨터에 저장해 두실 수 있어요.
            </p>
            <a
              href={willData.downloadUrl}
              download
              className="will-watch__prepare-button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-xs)',
                textDecoration: 'none',
              }}
            >
              <Download size={20} aria-hidden="true" />
              영상 저장하기
            </a>
          </div>
        )}

        {/* 링크 유효기간 안내 */}
        <div className="will-watch__expire-notice">
          <Clock size={16} aria-hidden="true" />
          <span>
            이 링크는 일정 기간 후 만료될 수 있습니다.
            영상을 소중히 간직하시기 바랍니다.
          </span>
        </div>

        {/* 법적 유언 효력 없음 고지 - DEV-05. 영상을 실제로 손에 넣은 뒤에도
            다시 한 번 눈에 띄게 안내한다 */}
        <LegalNotice theme="dark" className="will-watch__legal-notice" />
      </div>
    </div>
  )
}
