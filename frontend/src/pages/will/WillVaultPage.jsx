import { useNavigate } from 'react-router-dom'
import { useWillVault } from './useWillVault.js'
import { Plus, Video, Clock, CheckCircle, Eye, AlertCircle } from 'lucide-react'
import './WillVaultPage.css'

// FIX: wills.status 실제 enum(WILL_STATUS, shared/constants/enums.js)은
// draft/paid/active/released/revoked다. paid/revoked가 없어 결제 완료·취소 상태가
// 전부 "초안"으로 잘못 표시되고 있었다.
const STATUS_MAP = {
  draft: { label: '초안', icon: Clock, className: 'status-draft' },
  paid: { label: '결제 완료', icon: Clock, className: 'status-draft' },
  active: { label: '보관중', icon: CheckCircle, className: 'status-active' },
  released: { label: '공개됨', icon: Eye, className: 'status-released' },
  revoked: { label: '취소됨', icon: AlertCircle, className: 'status-draft' },
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
        <h1 className="will-vault__title">내 영상 편지 보관함</h1>
        <button
          type="button"
          className="will-vault__new-btn"
          onClick={() => navigate('/will/consent')}
          aria-label="새 영상 편지 만들기"
        >
          <Plus size={20} aria-hidden="true" />
          새 영상 편지
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
            {/* FIX: 결함4 - fetchWills가 signal 파라미터를 받게 되면서 onClick={refetch}
                직결 시 클릭 이벤트 객체가 signal 자리로 전달돼 요청이 깨진다. */}
            <button type="button" className="will-vault__retry" onClick={() => refetch()}>
              다시 시도
            </button>
          </div>
        )}

        {!isLoading && !fetchError && wills.length === 0 && (
          <div className="will-vault__empty">
            <Video size={48} aria-hidden="true" />
            <p className="will-vault__empty-title">아직 영상 편지가 없습니다</p>
            <p className="will-vault__empty-sub">지금 바로 AI 영상 편지를 만들어 소중한 마음을 전하세요.</p>
            <button
              type="button"
              className="will-vault__empty-btn"
              onClick={() => navigate('/will/consent')}
            >
              <Plus size={20} aria-hidden="true" />
              첫 영상 편지 만들기
            </button>
          </div>
        )}

        {wills.length > 0 && (
          <ul className="will-vault__list" aria-label="영상 편지 목록">
            {/* FIX: 백엔드(GET /api/will/wills)는 snake_case(will_id/created_at)로
                응답한다 - w.id/w.willId/w.createdAt은 응답에 없는 필드라 항상
                undefined였다(key=undefined, 항상 "날짜 없음"). */}
            {wills.map((w, index) => (
              <li key={w.will_id ?? index} className="will-vault__card">
                <div className="will-vault__card-icon" aria-hidden="true">
                  <Video size={24} />
                </div>
                <div className="will-vault__card-body">
                  <div className="will-vault__card-top">
                    <span className="will-vault__card-title">{w.title || '제목 없음'}</span>
                    <StatusBadge status={w.status} />
                  </div>
                  <span className="will-vault__card-date">
                    {w.created_at && !Number.isNaN(new Date(w.created_at).getTime())
                      ? new Date(w.created_at).toLocaleDateString('ko-KR')
                      : '날짜 없음'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* 2026-08-22 판매 보류 결정(결정2)으로 이벤트 영상 진입 버튼 제외.
            /will/event 라우트 자체가 App.jsx에서 비활성화되어 있어 버튼을 남겨두면
            눌러도 404로 가는 죽은 링크가 된다. 되살리려면 App.jsx 라우트 복구와
            함께 이 버튼도 복구한다. */}
      </div>
    </div>
  )
}
