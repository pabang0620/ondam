import { Users, Image, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import { useAdmin } from './useAdmin.js'

const STAT_CONFIG = [
  {
    key: 'totalUsers',
    label: '전체 회원',
    icon: Users,
    color: 'var(--color-primary)',
    bg: 'var(--color-accent)',
  },
  {
    key: 'processingPhotos',
    label: '처리 중인 사진',
    icon: Image,
    color: 'var(--color-gold)',
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
    bg: '#fff5f5',
  },
]

function StatCard({ config, value }) {
  const { label, icon: Icon, color, bg } = config
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-lg)',
        display: 'flex',
        gap: 'var(--spacing-md)',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 'var(--radius-md)',
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
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 2 }}>
          {label}
        </p>
        <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
          {value ?? '—'}
        </p>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { stats, isLoading, error, refetch } = useAdmin()

  return (
    <div style={{ padding: 'var(--spacing-xl)' }}>
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-xl)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800 }}>대시보드</h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
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
            background: 'var(--color-accent)',
            color: 'var(--color-primary-dark)',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            padding: '0 var(--spacing-md)',
            minHeight: 'var(--min-touch-target)',
            fontSize: 'var(--font-size-sm)',
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
            fontSize: 'var(--font-size-base)',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          {error}
        </p>
      )}

      {/* 통계 카드 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--spacing-md)',
        }}
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
