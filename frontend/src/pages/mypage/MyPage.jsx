import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  User,
  ShoppingBag,
  FileText,
  CreditCard,
  Bell,
  ChevronRight,
  Edit2,
} from 'lucide-react'
import { useMy } from './useMy.js'
import { ROUTES } from '../../constants/routes.js'
import './MyPage.css'

const ORDER_STATUS_LABEL = {
  pending: '대기',
  processing: '처리 중',
  completed: '완료',
  failed: '실패',
}

const ORDER_STATUS_COLOR = {
  pending: 'var(--color-text-muted)',
  processing: 'var(--color-gold)',
  completed: 'var(--color-success)',
  failed: 'var(--color-error)',
}

const WILL_STATUS_LABEL = {
  draft: '초안',
  processing: '생성 중',
  completed: '완료',
  failed: '실패',
}

const TABS = [
  { key: 'orders', label: '주문내역', icon: ShoppingBag },
  { key: 'wills', label: '유언장', icon: FileText },
  { key: 'subscription', label: '구독', icon: CreditCard },
  { key: 'notifications', label: '알림설정', icon: Bell },
]

function Toggle({ checked, onChange, id, label }) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        cursor: 'pointer',
        minHeight: 'var(--size-button-h)',
      }}
    >
      <span style={{ flex: 1, fontSize: 'var(--fs-body)', color: 'var(--color-text-primary)' }}>
        {label}
      </span>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-checked={checked}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 28,
            borderRadius: 'var(--radius-pill)',
            background: checked ? 'var(--color-warm-accent)' : 'var(--color-border)',
            position: 'relative',
            transition: 'background var(--transition-base)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 3,
              left: checked ? 23 : 3,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--color-surface)',
              transition: 'left var(--transition-base)',
            }}
          />
        </div>
      </div>
    </label>
  )
}

function OrdersTab({ orders }) {
  if (orders.length === 0) {
    return <p className="my-tab-empty">주문 내역이 없습니다.</p>
  }
  return (
    <ul className="my-list" aria-label="주문 목록">
      {orders.map((order) => (
        <li key={order.orderId} className="my-list-item">
          <div className="my-list-item__info">
            <span className="my-list-item__title">
              {order.photoType === 'funeral' ? '장례 사진' : order.photoType === 'id' ? '증명 사진' : '취업 사진'}
            </span>
            <span className="my-list-item__date">
              {new Date(order.createdAt).toLocaleDateString('ko-KR')}
            </span>
          </div>
          <span
            className="my-list-item__badge"
            style={{ color: ORDER_STATUS_COLOR[order.status] || 'var(--color-text-muted)' }}
          >
            {ORDER_STATUS_LABEL[order.status] || order.status}
          </span>
        </li>
      ))}
    </ul>
  )
}

function WillsTab({ wills }) {
  if (wills.length === 0) {
    return <p className="my-tab-empty">유언장이 없습니다.</p>
  }
  return (
    <ul className="my-list" aria-label="유언장 목록">
      {wills.map((will) => (
        <li key={will.willId} className="my-list-item">
          <div className="my-list-item__info">
            <span className="my-list-item__title">
              {will.title || `유언장 ${will.willId.slice(0, 8)}`}
            </span>
            <span className="my-list-item__date">
              {new Date(will.createdAt).toLocaleDateString('ko-KR')}
            </span>
          </div>
          <span
            className="my-list-item__badge"
            style={{ color: ORDER_STATUS_COLOR[will.status] || 'var(--color-text-muted)' }}
          >
            {WILL_STATUS_LABEL[will.status] || will.status}
          </span>
        </li>
      ))}
    </ul>
  )
}

function SubscriptionTab() {
  const navigate = useNavigate()
  return (
    <div className="my-tab-action">
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
        반려동물 아카이브 구독을 관리합니다.
      </p>
      <button
        onClick={() => navigate(ROUTES.PET_SUBSCRIPTION)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          background: 'var(--color-primary)',
          color: 'var(--color-surface)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          padding: '0 var(--spacing-xl)',
          height: 'var(--size-button-h)',
          fontSize: 'var(--fs-button)',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        구독 관리
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

function NotificationsTab({ settings, settingsError, onToggle, isUpdating }) {
  if (settingsError) {
    return <p className="my-error" role="alert">{settingsError}</p>
  }

  if (!settings) {
    return <p className="my-tab-empty" role="status">알림 설정을 불러오는 중...</p>
  }

  const NOTIFICATION_KEYS = [
    { key: 'emailMarketing', label: '이메일 마케팅 수신' },
    { key: 'pushOrder', label: '주문 처리 완료 알림' },
    { key: 'pushWill', label: '유언장 생성 완료 알림' },
    { key: 'pushPromotion', label: '프로모션 알림' },
  ]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-sm)',
        opacity: isUpdating ? 0.7 : 1,
        transition: 'opacity 0.2s',
      }}
      aria-busy={isUpdating}
    >
      {NOTIFICATION_KEYS.map(({ key, label }) => (
        <Toggle
          key={key}
          id={`notif-${key}`}
          label={label}
          checked={settings[key] ?? false}
          onChange={(v) => onToggle(key, v)}
        />
      ))}
    </div>
  )
}

export default function MyPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('orders')
  const {
    user,
    photoOrders,
    wills,
    notificationSettings,
    isLoading,
    error,
    settingsError,
    isSettingsUpdating,
    fetchNotificationSettings,
    handleToggleNotification,
  } = useMy()

  useEffect(() => {
    if (activeTab === 'notifications' && !notificationSettings) {
      fetchNotificationSettings()
    }
  }, [activeTab, notificationSettings, fetchNotificationSettings])

  if (isLoading) {
    return (
      <main className="my-page">
        <p className="my-tab-empty" role="status">불러오는 중...</p>
      </main>
    )
  }

  return (
    <main className="my-page">
      {error && (
        <p role="alert" className="my-error">{error}</p>
      )}

      {/* 프로필 카드 */}
      <section className="my-profile" aria-label="내 프로필">
        <div className="my-profile__avatar">
          <User size={36} color="var(--color-primary)" aria-hidden="true" />
        </div>
        <div className="my-profile__info">
          <p className="my-profile__name">{user?.nickname || user?.email || '사용자'}</p>
          <p className="my-profile__email">{user?.email}</p>
        </div>
        <button
          onClick={() => navigate('/my/edit')}
          className="my-profile__edit"
          aria-label="프로필 수정"
        >
          <Edit2 size={18} aria-hidden="true" />
          수정
        </button>
      </section>

      {/* 탭 */}
      <nav className="my-tabs" role="tablist" aria-label="마이페이지 탭">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            aria-controls={`tab-panel-${key}`}
            onClick={() => setActiveTab(key)}
            className={`my-tab-btn${activeTab === key ? ' my-tab-btn--active' : ''}`}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      {/* 탭 패널 */}
      <section
        id={`tab-panel-${activeTab}`}
        role="tabpanel"
        aria-label={TABS.find((t) => t.key === activeTab)?.label}
        className="my-tab-panel"
      >
        {activeTab === 'orders' && <OrdersTab orders={photoOrders} />}
        {activeTab === 'wills' && <WillsTab wills={wills} />}
        {activeTab === 'subscription' && <SubscriptionTab />}
        {activeTab === 'notifications' && (
          <NotificationsTab
            settings={notificationSettings}
            settingsError={settingsError}
            onToggle={handleToggleNotification}
            isUpdating={isSettingsUpdating}
          />
        )}
      </section>
    </main>
  )
}
