import { useState } from 'react'
import { CheckCircle, XCircle, ExternalLink, RefreshCw } from 'lucide-react'
import { useAdminRelease } from './useAdminRelease.js'
import { useAdminAuthStore } from '../../config/adminApiClient.js'
import './admin.css'

// SPEC-06 1절 매트릭스: 승인/반려는 super_admin, content_moderator(reviewer)만 O.
// 진짜 차단은 서버 requireAdminRole('super','reviewer')가 담당하고, 이건 보조 UI 가드
// (payment_specialist가 직접 URL로 진입해도 액션 버튼 자체를 노출하지 않는다).
const CAN_REVIEW_RELEASES = ['super', 'reviewer']

const STATUS_LABEL = {
  pending: '대기',
  approved: '승인',
  rejected: '거절',
}

const STATUS_COLOR = {
  pending: 'var(--color-warm-accent)',
  approved: 'var(--color-success)',
  rejected: 'var(--color-error)',
}

/* 거절 모달 — backdrop rgba(42,40,38,0.45), 콘텐츠 bg=surface */
function RejectModal({ releaseId, onConfirm, onClose }) {
  const [reason, setReason] = useState('')

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(42, 40, 38, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 'var(--spacing-md)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--spacing-xl)',
          maxWidth: 400,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-md)',
        }}
      >
        <h2 id="reject-modal-title" style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>
          거절 사유 입력
        </h2>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="거절 사유를 입력해 주세요."
          rows={4}
          style={{
            border: '1.5px solid var(--color-border-strong)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--spacing-md)',
            fontSize: 'var(--fs-body)',
            resize: 'vertical',
            minHeight: 100,
            outline: 'none',
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
          }}
          aria-label="거절 사유"
        />
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              color: 'var(--color-text-secondary)',
              border: '1.5px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-sm)',
              minHeight: 'var(--size-button-h)',
              padding: '0 var(--spacing-lg)',
              fontSize: 'var(--fs-button)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={() => { if (reason.trim()) onConfirm(releaseId, reason) }}
            disabled={!reason.trim()}
            style={{
              background: !reason.trim() ? 'var(--color-text-muted)' : 'var(--color-error)',
              color: 'var(--color-surface)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              minHeight: 'var(--size-button-h)',
              padding: '0 var(--spacing-lg)',
              fontSize: 'var(--fs-button)',
              fontWeight: 700,
              cursor: !reason.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            거절 확정
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminReleasePage() {
  const {
    releases,
    isLoading,
    error,
    processingId,
    actionError,
    documentLoadingId,
    handleApprove,
    handleReject,
    handleViewDocument,
    refetch,
  } = useAdminRelease()

  const [rejectTarget, setRejectTarget] = useState(null)
  const adminRole = useAdminAuthStore((s) => s.adminUser?.adminRole)
  const canReview = CAN_REVIEW_RELEASES.includes(adminRole)

  const onRejectConfirm = async (id, reason) => {
    setRejectTarget(null)
    await handleReject(id, reason)
  }

  /* 표 스타일 — header bg=surface-warm, row 구분 1px var(--color-border) */
  const thStyle = {
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: 700,
    color: 'var(--color-primary)',
    borderBottom: '2px solid var(--color-border-strong)',
    whiteSpace: 'nowrap',
    fontSize: 'var(--fs-body)',
  }

  return (
    <div className="admin-page">
      {/* 헤더 */}
      <div className="admin-header-row">
        <div>
          <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: 'var(--ls-heading-ko)' }}>
            사후공개 검토
          </h1>
          <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)', marginTop: 4 }}>
            유언장 사후공개 요청을 검토하고 승인 또는 거절합니다.
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={isLoading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            background: 'var(--color-surface-warm)',
            color: 'var(--color-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-pill)',
            padding: '0 var(--spacing-md)',
            minHeight: 'var(--min-touch-target)',
            fontSize: 'var(--fs-caption)',
            fontWeight: 600,
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          새로고침
        </button>
      </div>

      {error && (
        <p role="alert" style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-md)', fontSize: 'var(--fs-body)' }}>
          {error}
        </p>
      )}

      {actionError && (
        <p role="alert" style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-md)', fontSize: 'var(--fs-body)' }}>
          {actionError}
        </p>
      )}

      {/* 테이블 */}
      <div className="admin-table-wrapper">
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--fs-body)',
            background: 'var(--color-surface)',
          }}
          aria-label="사후공개 대기 목록"
        >
          <thead>
            <tr style={{ background: 'var(--color-surface-warm)' }}>
              {['유언장 ID', '요청자', '요청일', '사망증명서', '상태', '액션'].map((th) => (
                <th key={th} scope="col" style={thStyle}>{th}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} style={{ padding: 'var(--spacing-2xl)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--fs-body)' }}>
                  불러오는 중...
                </td>
              </tr>
            )}
            {!isLoading && releases.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 'var(--spacing-2xl)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--fs-body)' }}>
                  대기 중인 요청이 없습니다.
                </td>
              </tr>
            )}
            {!isLoading && releases.map((release) => {
              const isPending = release.status === 'pending'
              const isProcessing = processingId === release.releaseId

              return (
                <tr
                  key={release.releaseId}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    opacity: isProcessing ? 0.7 : 1,
                  }}
                >
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}>
                    {release.willId?.slice(0, 12)}...
                  </td>
                  {/* FIX D7 - 요청자(수신인) 정보. 이 값이 채워져야 관리자가 "누가
                      요청했는지" 알고 사망증명서를 대조해 승인 판단을 내릴 수 있다.
                      비회원 유가족이 대부분이라 이름/연락처/관계는 will_beneficiaries
                      기준(회원가입 이메일이 아님)이다. */}
                  <td style={{ padding: '12px 16px', fontSize: 'var(--fs-caption)', color: 'var(--color-text-secondary)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                      {release.requesterName ?? '알 수 없음'}
                      {release.requesterRelationship ? ` (${release.requesterRelationship})` : ''}
                    </div>
                    <div style={{ color: 'var(--color-text-muted)' }}>
                      {release.requesterEmail ?? '-'}
                      {release.requesterPhone ? ` · ${release.requesterPhone}` : ''}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: 'var(--fs-caption)', color: 'var(--color-text-secondary)' }}>
                    {new Date(release.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td style={{ padding: 'var(--spacing-md)' }}>
                    {/* [보안 수정] 목록에는 URL을 내려주지 않는다 - 클릭 시점에
                        presigned URL을 새로 발급받아 새 탭으로 연다 (짧은 만료,
                        열람 자체가 서버에서 audit_logs에 기록됨) */}
                    <button
                      type="button"
                      onClick={() => handleViewDocument(release.releaseId)}
                      disabled={documentLoadingId === release.releaseId}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: 'var(--color-primary)',
                        fontWeight: 600,
                        fontSize: 'var(--fs-caption)',
                        minHeight: 'var(--min-touch-target)',
                        cursor: documentLoadingId === release.releaseId ? 'not-allowed' : 'pointer',
                        opacity: documentLoadingId === release.releaseId ? 0.6 : 1,
                      }}
                    >
                      {documentLoadingId === release.releaseId ? '불러오는 중...' : '보기'}
                      <ExternalLink size={14} aria-hidden="true" />
                    </button>
                  </td>
                  <td style={{ padding: 'var(--spacing-md)' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 'var(--radius-pill)',
                        background: `${STATUS_COLOR[release.status]}20`,
                        color: STATUS_COLOR[release.status] || 'var(--color-text-muted)',
                        fontWeight: 700,
                        fontSize: 'var(--fs-caption)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {STATUS_LABEL[release.status] || release.status}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--spacing-md)' }}>
                    {isPending && !canReview && (
                      <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}>
                        승인 권한 없음
                      </span>
                    )}
                    {isPending && canReview && (
                      <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                        {/* 승인 버튼 — success 색 */}
                        <button
                          onClick={() => handleApprove(release.releaseId)}
                          disabled={!!processingId}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'var(--color-success)',
                            color: 'var(--color-surface)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 var(--spacing-md)',
                            minHeight: 'var(--min-touch-target)',
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 700,
                            cursor: processingId ? 'not-allowed' : 'pointer',
                            opacity: processingId ? 0.7 : 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <CheckCircle size={14} aria-hidden="true" />
                          승인
                        </button>
                        {/* 거절 버튼 — danger #B85C50 */}
                        <button
                          onClick={() => setRejectTarget(release.releaseId)}
                          disabled={!!processingId}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'var(--color-error)',
                            color: 'var(--color-surface)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 var(--spacing-md)',
                            minHeight: 'var(--min-touch-target)',
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 700,
                            cursor: processingId ? 'not-allowed' : 'pointer',
                            opacity: processingId ? 0.7 : 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <XCircle size={14} aria-hidden="true" />
                          거절
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 거절 모달 */}
      {rejectTarget && (
        <RejectModal
          releaseId={rejectTarget}
          onConfirm={onRejectConfirm}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  )
}
