import './PetDashboard.css'

// 결제 복귀 결과 알림. 메시지는 텍스트로만 렌더링한다.
export default function PetBillingNotice({ notice, onDismiss }) {
  if (!notice) return null

  if (notice.type === 'success') {
    return (
      <p
        role="status"
        aria-live="polite"
        className="pet-sub-summary__msg pet-sub-summary__msg--success"
      >
        {notice.message}
      </p>
    )
  }

  return (
    <div role="alert" className="pet-sub-summary__msg pet-sub-summary__msg--error pet-billing-notice">
      <span>{notice.message}</span>
      <button type="button" className="pet-billing-notice__close" onClick={onDismiss}>
        닫기
      </button>
    </div>
  )
}
