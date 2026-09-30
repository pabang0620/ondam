import { Link } from 'react-router-dom'
import { AlertCircle, Clock3, Hourglass, Video } from 'lucide-react'
import { useWillProcessing } from './useWillProcessing.js'
import { ROUTES } from '../../constants/routes.js'
import './WillProcessingPage.css'

// 서버 jobStatus: queued(대기) → running(생성 중) → completed
const STAGES = [
  { key: 'queued', icon: Hourglass, label: '준비 중' },
  { key: 'running', icon: Video, label: '영상 만드는 중' },
]

function getStageIndex(jobStatus) {
  if (jobStatus === 'running' || jobStatus === 'completed') return 1
  return 0
}

export default function WillProcessingPage() {
  const { jobStatus, progress, pollError, checkError, retryCheck } = useWillProcessing()
  const activeStage = getStageIndex(jobStatus)

  // FIX: 결함3 - pollError(생성 실패)면 폴링은 이미 멈춘 상태다. 처리 중 안내를
  // 남겨두면 멈췄는데도 계속 처리 중인 것처럼 보이므로 실패 화면만 보여준다.
  if (pollError) {
    return (
      <div className="will-proc-page">
        <div className="will-proc__content">
          <div className="will-proc__spinner-wrap" aria-hidden="true">
            <AlertCircle size={48} color="var(--color-error)" />
          </div>

          <h1 className="will-proc__title">영상 편지를 만들지 못했습니다</h1>

          <p className="will-proc__error" role="alert">{pollError}</p>
        </div>
      </div>
    )
  }

  // 상태 조회가 연속 실패했거나 알 수 없는 상태 - 생성 실패와 구분해 안내
  if (checkError) {
    return (
      <div className="will-proc-page">
        <div className="will-proc__content">
          <div className="will-proc__spinner-wrap" aria-hidden="true">
            <Clock3 size={48} color="var(--color-warm-accent)" />
          </div>

          <h1 className="will-proc__title">상태 확인이 잠시 안 됩니다</h1>

          <p className="will-proc__note" role="status">{checkError}</p>

          <div className="will-proc__actions">
            <button type="button" className="will-proc__retry" onClick={retryCheck}>
              다시 확인
            </button>
            <Link to={ROUTES.WILL_VAULT} className="will-proc__vault-link">
              보관함으로 가기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="will-proc-page">
      <div className="will-proc__content">
        {/* 스피너 */}
        <div className="will-proc__spinner-wrap" aria-hidden="true">
          <div className="will-proc__spinner" />
        </div>

        <h1 className="will-proc__title">AI가 영상을 생성하고 있습니다</h1>
        <p className="will-proc__sub">예상 소요 시간: 30분 ~ 1시간</p>

        {/* 진행 단계 */}
        <ol className="will-proc__stages" aria-label="처리 단계">
          {STAGES.map(({ key, icon: Icon, label }, idx) => (
            <li
              key={key}
              className={`will-proc__stage ${idx === activeStage ? 'is-active' : ''} ${idx < activeStage ? 'is-done' : ''}`}
              aria-current={idx === activeStage ? 'step' : undefined}
            >
              <div className="will-proc__stage-icon">
                <Icon size={20} aria-hidden="true" />
              </div>
              <span className="will-proc__stage-label">{label}</span>
            </li>
          ))}
        </ol>

        {/* 진행 바 */}
        {progress > 0 && (
          <div className="will-proc__progress-wrap">
            <div
              className="will-proc__progress-bar"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${progress}% 진행됨`}
              aria-label="처리 진행률"
            >
              <div className="will-proc__progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="will-proc__progress-pct">{progress}%</span>
          </div>
        )}

        <p className="will-proc__note">
          완료되면 자동으로 보관함으로 이동합니다.
          <br />
          이 페이지를 닫아도 처리는 계속됩니다.
        </p>
      </div>
    </div>
  )
}
