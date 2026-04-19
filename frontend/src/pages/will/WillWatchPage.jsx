import { useWillWatch } from './useWillWatch.js'
import { Heart, AlertCircle, Clock } from 'lucide-react'
import './WillWatchPage.css'

export default function WillWatchPage() {
  const { willData, isLoading, fetchError } = useWillWatch()

  if (isLoading) {
    return (
      <div className="will-watch-page">
        <div className="will-watch__loading" aria-live="polite" aria-label="영상 불러오는 중">
          <span className="will-watch__spinner" aria-hidden="true" />
          <p>영상을 불러오는 중입니다...</p>
        </div>
      </div>
    )
  }

  if (fetchError) {
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

  if (!willData) return null

  return (
    <div className="will-watch-page">
      <div className="will-watch__content">
        {/* 감성 헤더 */}
        <div className="will-watch__header">
          <Heart size={32} aria-hidden="true" />
          <p className="will-watch__greeting">소중한 분의 마지막 메시지입니다</p>
          {willData.title && (
            <h1 className="will-watch__title">{willData.title}</h1>
          )}
        </div>

        {/* 비디오 */}
        <div className="will-watch__video-wrap">
          <video
            className="will-watch__video"
            controls
            src={willData.videoUrl}
            poster={willData.thumbnailUrl}
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
