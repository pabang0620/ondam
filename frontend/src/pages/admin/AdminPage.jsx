import { Users, Image, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import { useAdmin } from './useAdmin.js'
import './admin.css'

const STAT_CONFIG = [
  {
    key: 'totalUsers',
    label: '전체 회원',
    icon: Users,
    color: 'var(--color-primary)',
    bg: 'var(--color-surface-warm)',
  },
  {
    key: 'processingPhotos',
    label: '처리 중인 사진',
    icon: Image,
    color: 'var(--color-warm-accent)',
    bg: '#fef9ee',
  },
  {
    key: 'pendingReleases',
    label: '사후공개 대기',
    icon: Clock,
    color: '#3182ce',
    bg: '#ebf8ff',
  },
  {
    key: 'failedJobs',
    label: '실패한 작업',
    icon: AlertTriangle,
    color: 'var(--color-error)',
    bg: 'var(--color-error-light)',
  },
]

/* 통계 카드 — bg surface, border 1px, 큰 숫자 serif, 라벨 caption muted */
function StatCard({ config, value }) {
  const { label, icon: Icon, color, bg } = config
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: '24px',
        display: 'flex',
        gap: 'var(--spacing-md)',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 'var(--radius-sm)',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={24} color={color} aria-hidden="true" />
      </div>
      <div>
        <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)', marginBottom: 2 }}>
          {label}
        </p>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-h1)', fontWeight: 700, color: 'var(--color-primary)' }}>
          {value ?? '-'}
        </p>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { stats, isLoading, error, refetch } = useAdmin()

  return (
    <div className="admin-page">
      {/* 헤더 */}
      <div className="admin-header-row">
        <div>
          <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: 'var(--ls-heading-ko)' }}>대시보드</h1>
          <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)', marginTop: 4 }}>
            서비스 현황을 한눈에 확인합니다.
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
            opacity: isLoading ? 0.7 : 1,
          }}
          aria-label="새로고침"
        >
          <RefreshCw size={16} aria-hidden="true" />
          새로고침
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <p
          role="alert"
          style={{
            color: 'var(--color-error)',
            fontSize: 'var(--fs-body)',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          {error}
        </p>
      )}

      {/* 통계 카드 그리드 */}
      <div
        className="admin-stats-grid"
        aria-busy={isLoading}
      >
        {STAT_CONFIG.map((config) => (
          <StatCard
            key={config.key}
            config={config}
            value={isLoading ? '...' : stats?.[config.key]}
          />
        ))}
      </div>
    </div>
  )
}
