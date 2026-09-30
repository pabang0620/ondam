import { Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/common/Button.jsx'
import usePhotoProcessing from './usePhotoProcessing.js'
import { ROUTES } from '../../constants/routes.js'

// FIX: 결함3 - 이 라벨은 photo_orders.status(PHOTO_ORDER_STATUS: pending_payment/
// paid/processing/completed/failed/refunded)를 키로 쓰는데, 예전 키(queued/running)는
// ai_jobs.job_status(AI_JOB_STATUS) 값이라 실제 status와 절대 일치하지 않아 항상
// 기본 문구로만 떨어지던 죽은 매핑이었다. 실제 enum 값으로 맞춘다
// (mypage/MyPage.jsx의 ORDER_STATUS_LABEL과 동일한 근거로 이미 한 번 수정된 적 있는
// enum이다 - shared/constants/enums.js 참고).
const STATUS_LABELS = {
  pending_payment: '결제 대기 중...',
  paid: '처리 준비 중...',
  processing: 'AI가 사진을 처리하고 있습니다...',
  completed: '처리 완료!',
  failed: '처리 실패',
}

function PhotoProcessingPage() {
  const navigate = useNavigate()
  const {
    orderId,
    status,
    progress,
    error,
    canRetry,
    retry,
    isPaymentIncomplete,
    isRefunded,
  } = usePhotoProcessing()

  // 결함3: 환불된 경우는 "오류"가 아니라 "처리하지 못해 결제를 취소했다"는 정보다.
  // error 브랜치와 분리해 톤·아이콘·다음 행동을 다르게 안내한다.
  if (isRefunded) {
    return (
      <main
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: 'var(--spacing-xl) var(--spacing-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-lg)',
          textAlign: 'center',
        }}
      >
        <RotateCcw size={56} color="var(--color-warm-accent)" aria-hidden="true" />
        <p
          role="alert"
          style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}
        >
          결제가 취소되었습니다
        </p>
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          죄송합니다. 사진을 처리하지 못해 결제하신 금액을 전액 환불해 드렸습니다.
          카드사에 따라 환불 반영까지 며칠 걸릴 수 있습니다. 다시 시도해 보시겠어요?
        </p>
        {/* FE-PP-15: 주문 내역은 마이페이지에 있다 */}
        <Button onClick={() => navigate(ROUTES.MY)} fullWidth>주문 내역으로 이동</Button>
      </main>
    )
  }

  // FE-PP-6: 결제가 확정되지 않은 채 오래 기다린 경우 - 오류가 아니라 안내
  if (isPaymentIncomplete) {
    return (
      <main
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: 'var(--spacing-xl) var(--spacing-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-lg)',
          textAlign: 'center',
        }}
      >
        <AlertCircle size={56} color="var(--color-warm-accent)" aria-hidden="true" />
        <p
          role="alert"
          style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}
        >
          결제가 아직 완료되지 않았어요
        </p>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          결제가 확인되지 않아 사진 처리를 시작하지 못했습니다.
          결제를 마치셨다면 "다시 확인"을 눌러 주시고, 아니라면 결제 화면에서 다시 결제해 주세요.
        </p>
        <Button onClick={retry} fullWidth>다시 확인</Button>
        <Button variant="secondary" onClick={() => navigate(`/photo/payment?orderId=${orderId}`)} fullWidth>
          결제 화면으로
        </Button>
      </main>
    )
  }

  if (error) {
    return (
      <main
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: 'var(--spacing-xl) var(--spacing-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-lg)',
          textAlign: 'center',
        }}
      >
        <AlertCircle size={56} color="var(--color-error)" aria-hidden="true" />
        <p
          role="alert"
          style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-error)' }}
        >
          오류 발생
        </p>
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
          {error}
        </p>
        {canRetry && <Button onClick={retry} fullWidth>다시 확인</Button>}
        <Button variant="secondary" onClick={() => navigate(ROUTES.MY)} fullWidth>마이페이지로</Button>
      </main>
    )
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '32px var(--spacing-md) 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--spacing-xl)',
        textAlign: 'center',
        background: 'var(--color-bg)',
      }}
    >
      {/* 스피너 */}
      <div
        aria-live="polite"
        aria-busy={status !== 'completed' && status !== 'failed'}
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          background: 'var(--color-bg-alt)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader2
          size={48}
          color="var(--color-photo)"
          style={{ animation: 'spin 1.2s linear infinite' }}
          aria-hidden="true"
        />
      </div>

      {/* 상태 텍스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--color-photo)', letterSpacing: 'var(--ls-heading-ko)' }}>
          {STATUS_LABELS[status] ?? 'AI가 사진을 처리하고 있습니다...'}
        </p>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          잠시 기다려 주세요. 완료되면 자동으로 결과 화면으로 이동합니다.
        </p>
      </div>

      {/* 진행 바 */}
      <div style={{ width: '100%', maxWidth: 360, padding: '0 var(--spacing-md)', boxSizing: 'border-box' }}>
        <div
          style={{
            height: 10,
            background: 'var(--color-bg-alt)',
            borderRadius: 'var(--radius-pill)',
            overflow: 'hidden',
          }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="처리 진행률"
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--color-warm-accent)',
              borderRadius: 'var(--radius-pill)',
              transition: 'width 0.5s ease',
            }}
          />
        </div>
        <p
          style={{
            marginTop: 'var(--spacing-sm)',
            fontSize: 'var(--fs-body-lg)',
            fontWeight: 700,
            color: 'var(--color-warm-accent)',
          }}
        >
          {progress}%
        </p>
      </div>

      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>
        평균 처리 시간은 1~3분입니다.
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}

export default PhotoProcessingPage
