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

// FIX: photo_orders.status 실제 enum(PHOTO_ORDER_STATUS, shared/constants/enums.js)은
// pending_payment/paid/processing/completed/failed/refunded다. 'pending'은 존재하지
// 않는 값이라 신규 주문(항상 pending_payment로 생성됨)이 라벨 없이 원문 그대로 노출되고
// 있었다.
const ORDER_STATUS_LABEL = {
  pending_payment: '결제 대기',
  paid: '결제 완료',
  processing: '처리 중',
  completed: '완료',
  failed: '실패',
  refunded: '환불됨',
}

const ORDER_STATUS_COLOR = {
  pending_payment: 'var(--color-text-muted)',
  paid: 'var(--color-text-muted)',
  processing: 'var(--color-gold)',
  completed: 'var(--color-success)',
  failed: 'var(--color-error)',
  refunded: 'var(--color-text-muted)',
}

// FIX: wills.status 실제 enum(WILL_STATUS, shared/constants/enums.js)은
// draft/paid/active/released/revoked다. processing/completed/failed는 실제로 나오지
// 않는 값이라 대부분의 유언장이 라벨 없이 원문 그대로 노출되고 있었다.
const WILL_STATUS_LABEL = {
  draft: '초안',
  paid: '결제 완료',
  active: '영상 생성 중',
  released: '공개됨',
  revoked: '취소됨',
}

const WILL_STATUS_COLOR = {
  draft: 'var(--color-text-muted)',
  paid: 'var(--color-text-muted)',
  active: 'var(--color-gold)',
  released: 'var(--color-success)',
  revoked: 'var(--color-error)',
}

// FIX: created_at/updated_at 등 필드가 비어있거나 파싱 불가능한 값이어도 "Invalid Date"를
// 노출하지 않는다.
function formatDate(value) {
  if (!value) return '날짜 없음'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '날짜 없음'
  return date.toLocaleDateString('ko-KR')
}

const TABS = [
  { key: 'orders', label: '주문내역', icon: ShoppingBag },
  { key: 'wills', label: '영상 편지', icon: FileText },
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
            background: checked ? 'var(--color-accent-brand)' : 'var(--color-border)',
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
      {orders.map((order, index) => (
        // FIX: 백엔드(GET /api/photo/orders)는 snake_case(order_id/photo_type/created_at)로
        // 응답한다 - camelCase로 읽으면 항상 undefined였다(key=undefined, "취업 사진"
        // 고정 노출, "Invalid Date").
        <li key={order.order_id ?? index} className="my-list-item">
          <div className="my-list-item__info">
            <span className="my-list-item__title">
              {order.photo_type === 'funeral' ? '장례 사진' : order.photo_type === 'id' ? '증명 사진' : '취업 사진'}
            </span>
            <span className="my-list-item__date">
              {formatDate(order.created_at)}
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
    return <p className="my-tab-empty">영상 편지가 없습니다.</p>
  }
  return (
    <ul className="my-list" aria-label="영상 편지 목록">
      {wills.map((will, index) => (
        // FIX: 백엔드(GET /api/will/wills)는 snake_case(will_id/created_at)로 응답한다 -
        // camelCase로 읽으면 항상 undefined였고, title이 빈 경우
        // `will.willId.slice(0,8)`이 undefined.slice(...)로 TypeError를 던져 마이페이지
        // 전체가 크래시했다. will_id가 없는 이상 상태여도 페이지가 죽지 않도록 방어한다.
        <li key={will.will_id ?? index} className="my-list-item">
          <div className="my-list-item__info">
            <span className="my-list-item__title">
              {will.title || (will.will_id ? `영상 편지 ${will.will_id.slice(0, 8)}` : '영상 편지')}
            </span>
            <span className="my-list-item__date">
              {formatDate(will.created_at)}
            </span>
          </div>
          <span
            className="my-list-item__badge"
            style={{ color: WILL_STATUS_COLOR[will.status] || 'var(--color-text-muted)' }}
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
        반려동물 화면에서 구독을 확인하고 해지할 수 있어요.
      </p>
      <button
        onClick={() => navigate(ROUTES.PET)}
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
        구독 확인하기
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

  // FIX: 백엔드(GET/PUT /api/notifications/settings, notificationService.toSettingsDto)의
  // 실제 필드는 pushEnabled/emailEnabled/smsEnabled/notify*이다. 여기 있던
  // emailMarketing/pushOrder/pushWill/pushPromotion은 응답 어디에도 없는 필드명이라
  // 토글은 항상 꺼진 상태로 보였고, PUT은 zod 스키마(updateSettingsSchema)가 알 수 없는
  // 키를 걷어낸 뒤 "변경할 설정 항목이 없습니다" 400으로 매번 실패해 저장이 조용히
  // 되돌아갔다(handleToggleNotification의 catch가 이전 값으로 복원).
  const NOTIFICATION_KEYS = [
    { key: 'pushEnabled', label: '푸시 알림 받기' },
    { key: 'emailEnabled', label: '이메일 알림 받기' },
    { key: 'smsEnabled', label: 'SMS 알림 받기' },
    { key: 'notifyPhotoComplete', label: '사진 처리 완료 알림' },
    { key: 'notifyWillEvents', label: '영상 편지 알림' },
    { key: 'notifyPayment', label: '결제 알림' },
    { key: 'notifySubscription', label: '구독 알림' },
    { key: 'notifyPetMemorial', label: '반려동물 추모 알림' },
    { key: 'notifyAdminNotice', label: '공지사항 알림' },
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
