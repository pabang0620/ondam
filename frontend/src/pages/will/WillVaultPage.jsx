import { useNavigate } from 'react-router-dom'
import { useWillVault } from './useWillVault.js'
import { Plus, Video, Clock, CheckCircle, Eye, AlertCircle } from 'lucide-react'
import './WillVaultPage.css'

const STATUS_MAP = {
  draft: { label: '초안', icon: Clock, className: 'status-draft' },
  active: { label: '보관중', icon: CheckCircle, className: 'status-active' },
  released: { label: '공개됨', icon: Eye, className: 'status-released' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_MAP[status] || STATUS_MAP.draft
  const Icon = cfg.icon
  return (
    <span className={`will-vault__badge ${cfg.className}`}>
      <Icon size={12} aria-hidden="true" />
      {cfg.label}
    </span>
  )
}

export default function WillVaultPage() {
  const navigate = useNavigate()
  const { wills, isLoading, fetchError, refetch } = useWillVault()

  return (
    <div className="will-vault-page">
      <div className="will-vault__header">
        <h1 className="will-vault__title">내 유언장 보관함</h1>
        <button
          type="button"
          className="will-vault__new-btn"
          onClick={() => navigate('/will/consent')}
          aria-label="새 유언장 만들기"
        >
          <Plus size={20} aria-hidden="true" />
          새 유언장
        </button>
      </div>

      <div className="will-vault__content">
        {isLoading && (
          <div className="will-vault__loading" role="status" aria-live="polite" aria-label="불러오는 중">
            <span className="will-vault__spinner" aria-hidden="true" />
            목록을 불러오는 중입니다...
          </div>
        )}

        {fetchError && (
          <div className="will-vault__error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            {fetchError}
            <button type="button" className="will-vault__retry" onClick={refetch}>
              다시 시도
            </button>
          </div>
        )}

        {!isLoading && !fetchError && wills.length === 0 && (
          <div className="will-vault__empty">
            <Video size={48} aria-hidden="true" />
            <p className="will-vault__empty-title">아직 유언장이 없습니다</p>
            <p className="will-vault__empty-sub">지금 바로 AI 유언장을 만들어 소중한 마음을 전하세요.</p>
            <button
              type="button"
              className="will-vault__empty-btn"
              onClick={() => navigate('/will/consent')}
            >
              <Plus size={20} aria-hidden="true" />
              첫 유언장 만들기
            </button>
          </div>
        )}

        {wills.length > 0 && (
          <ul className="will-vault__list" aria-label="유언장 목록">
            {wills.map((w) => (
              <li key={w.id || w.willId} className="will-vault__card">
                <div className="will-vault__card-icon" aria-hidden="true">
                  <Video size={24} />
                </div>
                <div className="will-vault__card-body">
                  <div className="will-vault__card-top">
                    <span className="will-vault__card-title">{w.title || '제목 없음'}</span>
                    <StatusBadge status={w.status} />
                  </div>
                  <span className="will-vault__card-date">
                    {w.createdAt
                      ? new Date(w.createdAt).toLocaleDateString('ko-KR')
                      : '날짜 없음'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* 이벤트 영상 추가 버튼 */}
        {!isLoading && wills.length > 0 && (
          <button
            type="button"
            className="will-vault__event-btn"
            onClick={() => navigate('/will/event')}
          >
            <Plus size={18} aria-hidden="true" />
            이벤트 추가 영상 만들기 (19,900원)
          </button>
        )}
      </div>
    </div>
  )
}
