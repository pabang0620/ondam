import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle, PartyPopper, Copy, MessageSquareText, Share2, Check } from 'lucide-react'
import { Button } from '../../components/common/Button.jsx'
import { confirmPayment } from './giftApi.js'

// PhotoPaymentSuccessPage.jsx와 동일한 왕복 확정 패턴(G3) - URL 쿼리(paymentKey 등)를
// 받았다는 사실 자체를 성공으로 취급하지 않고, 반드시 서버 confirm 응답으로만 판정한다.
function CenterMessage({ children }) {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '64px var(--spacing-md) 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--spacing-lg)',
        textAlign: 'center',
      }}
    >
      {children}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}

export default function GiftPaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState('processing') // processing | share | uncertain | no-token | error
  const [message, setMessage] = useState(null)
  const [copied, setCopied] = useState(false)
  const processed = useRef(false)

  const performToken = sessionStorage.getItem('pendingGiftPerformToken')
  const link = performToken ? `${window.location.origin}/gift/perform/${performToken}` : null

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const paymentKey = searchParams.get('paymentKey')
    const tossOrderId = searchParams.get('orderId')
    const amount = searchParams.get('amount')

    if (!paymentKey || !tossOrderId || !amount) {
      setState('error')
      setMessage('결제 정보를 확인할 수 없습니다. 내 선물 목록에서 결제 상태를 확인해 주세요.')
      return
    }

    confirmPayment({ paymentKey, orderId: tossOrderId, amount: Number(amount) })
      .then(() => {
        sessionStorage.removeItem('pendingGiftId')
        if (!performToken) {
          setState('no-token')
          return
        }
        setState('share')
      })
      .catch((err) => {
        const httpStatus = err?.response?.status
        const isUncertain = httpStatus === 502 || httpStatus === 409 || err?.code === 'ECONNABORTED' || !err?.response
        if (isUncertain) {
          setState('uncertain')
        } else {
          setState('error')
          setMessage(err?.response?.data?.message ?? '결제 승인에 실패했습니다.')
        }
      })
  }, [searchParams, performToken])

  const handleCopy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setMessage('복사에 실패했습니다. 링크를 길게 눌러 직접 복사해 주세요.')
    }
  }

  const handleShare = async () => {
    if (!link) return
    if (navigator.share) {
      try {
        await navigator.share({ title: '온담 선물이 도착했어요', text: '소중한 분께 온담 선물을 보내드렸어요.', url: link })
      } catch {
        // 사용자가 공유를 취소한 경우 - 에러로 취급하지 않는다
      }
    } else {
      handleCopy()
    }
  }

  if (state === 'processing') {
    return (
      <CenterMessage>
        <Loader2 size={40} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" />
        <p role="status" aria-live="polite" style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>
          결제를 확인하고 있어요. 잠시만 기다려 주세요...
        </p>
      </CenterMessage>
    )
  }

  if (state === 'share') {
    return (
      <CenterMessage>
        <PartyPopper size={40} color="var(--color-primary)" aria-hidden="true" />
        <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          결제가 완료됐어요
        </p>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          아래 링크를 받는 분께 전달해 주세요. 링크를 열고 휴대폰 뒤 4자리를 확인하면
          바로 시작하실 수 있어요.
        </p>

        <div
          style={{
            width: '100%',
            padding: 'var(--spacing-md)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-surface)',
            fontSize: 'var(--fs-caption)',
            wordBreak: 'break-all',
            color: 'var(--color-text-secondary)',
          }}
        >
          {link}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', width: '100%' }}>
          <Button onClick={handleShare} fullWidth>
            <Share2 size={18} /> 카카오톡/문자로 보내기
          </Button>
          <Button variant="secondary" onClick={handleCopy} fullWidth>
            {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? '복사됐어요' : '링크 복사'}
          </Button>
          {link && (
            <a
              href={`sms:?body=${encodeURIComponent(`온담에서 선물이 도착했어요. ${link}`)}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 'var(--min-touch-target)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-strong)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--fs-button)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <MessageSquareText size={18} /> 문자 앱으로 보내기
            </a>
          )}
        </div>

        <div
          style={{
            width: '100%',
            marginTop: 'var(--spacing-md)',
            padding: 'var(--spacing-md)',
            background: 'var(--color-surface-warm)',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'left',
          }}
        >
          <p style={{ fontWeight: 600, fontSize: 'var(--fs-body)', marginBottom: 6, color: 'var(--color-text-primary)' }}>
            부모님이 하실 일
          </p>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
            링크를 열고 휴대폰 뒤 4자리로 본인 확인 → 계정을 만들거나 로그인 → 사진을
            올리면 끝이에요. 전화로 이 순서를 미리 알려 드리면 더 편하게 하실 수 있어요.
          </p>
        </div>

        <Button variant="secondary" onClick={() => navigate('/gift/mine')} fullWidth>
          내가 보낸 선물 보기
        </Button>
      </CenterMessage>
    )
  }

  if (state === 'uncertain') {
    return (
      <CenterMessage>
        <AlertCircle size={40} color="var(--color-accent-brand)" aria-hidden="true" />
        <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--color-text-primary)' }}>결제 결과를 확인하고 있어요</p>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          네트워크가 불안정해 확인이 지연되고 있어요. 잠시 후 내 선물 목록에서 다시
          확인해 주세요. 지금 다시 결제하면 이중으로 청구될 수 있어요.
        </p>
        <Button onClick={() => navigate('/gift/mine')} fullWidth>내 선물 목록으로 이동</Button>
      </CenterMessage>
    )
  }

  if (state === 'no-token') {
    return (
      <CenterMessage>
        <AlertCircle size={40} color="var(--color-accent-brand)" aria-hidden="true" />
        <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--color-text-primary)' }}>결제는 완료됐어요</p>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          다만 이 화면에서 링크를 자동으로 표시하지 못했습니다. 내 선물 목록에서
          "다시 보내기"를 눌러 링크를 받아 주세요.
        </p>
        <Button onClick={() => navigate('/gift/mine')} fullWidth>내 선물 목록으로 이동</Button>
      </CenterMessage>
    )
  }

  return (
    <CenterMessage>
      <AlertCircle size={40} color="var(--color-error)" aria-hidden="true" />
      <p role="alert" style={{ fontSize: 'var(--fs-body)', color: 'var(--color-error)', fontWeight: 700 }}>{message}</p>
      <Button onClick={() => navigate('/gift/new')} fullWidth>다시 시도하기</Button>
    </CenterMessage>
  )
}
