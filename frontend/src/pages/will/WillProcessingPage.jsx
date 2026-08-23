import { AlertCircle, Mic, Video, Lock } from 'lucide-react'
import { useWillProcessing } from './useWillProcessing.js'
import './WillProcessingPage.css'

const STAGES = [
  { key: 'voice', icon: Mic, label: '음성 복제 중' },
  { key: 'video', icon: Video, label: '영상 생성 중' },
  { key: 'encrypt', icon: Lock, label: '암호화 보관 중' },
]

function getStageIndex(jobStatus) {
  if (jobStatus === 'voice_cloning') return 0
  if (jobStatus === 'video_generating') return 1
  if (jobStatus === 'encrypting' || jobStatus === 'completed') return 2
  return 0
}

export default function WillProcessingPage() {
  const { jobStatus, progress, pollError } = useWillProcessing()
  const activeStage = getStageIndex(jobStatus)

  // FIX: 결함3 - pollError가 있으면(생성 실패 또는 상태 확인 실패) 폴링은 이미
  // 멈춘 상태다(useWillProcessing.js). 그런데도 스피너와 "완료되면 자동으로
  // 보관함으로 이동합니다 / 페이지를 닫아도 처리는 계속됩니다" 안내가 그대로
  // 남아있으면, 실제로는 멈췄는데 여전히 처리 중인 것처럼 보이는 혼란을 준다.
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
              aria-label={`처리 진행률 ${progress}%`}
            >
              <div className="will-proc__progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="will-proc__progress-pct">{progress}%</span>
          </div>
        )}

        <p className="will-proc__note" aria-live="polite">
          완료되면 자동으로 보관함으로 이동합니다.
          <br />
          이 페이지를 닫아도 처리는 계속됩니다.
        </p>
      </div>
    </div>
  )
}
