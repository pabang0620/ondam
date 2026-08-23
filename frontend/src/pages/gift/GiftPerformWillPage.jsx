import { useRef } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Mic, Camera, ShieldCheck } from 'lucide-react'
import { Button } from '../../components/common/Button.jsx'
import LegalNotice from '../../components/common/LegalNotice.jsx'
import useGiftPerformWill from './useGiftPerformWill.js'

const inputStyle = {
  height: 'var(--size-input-h)',
  minHeight: 'var(--min-touch-target)',
  padding: '0 16px',
  fontSize: 'var(--fs-body)',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  background: 'var(--color-surface)',
  width: '100%',
}

const Screen = ({ children }) => (
  <main style={{ maxWidth: 480, margin: '0 auto', padding: '32px var(--spacing-md) 48px', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
    {children}
  </main>
)

function GiftPerformWillPage() {
  const {
    STEP, step, error, busy, title, setTitle, contentText, setContentText, beneficiary, setBeneficiary,
    submitConsent, uploadProfilePhoto, uploadVoice, submitMessage, submitBeneficiary,
  } = useGiftPerformWill()

  const photoInputRef = useRef(null)
  const audioInputRef = useRef(null)

  const ErrorBox = () => error && (
    <p role="alert" style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 6 }}>
      <AlertCircle size={16} /> {error}
    </p>
  )

  if (step === STEP.CONSENT) {
    return (
      <Screen>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
          <ShieldCheck size={40} color="var(--color-primary)" />
          <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700 }}>목소리 사용 동의</p>
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)', textAlign: 'left' }}>
            녹음하신 목소리는 AI가 영상 편지를 만드는 데만 사용돼요. 이 동의는 반드시
            본인이 직접 눌러주셔야 해요.
          </p>
          {/* 법적 유언 효력 없음 고지 - DEV-05. 선물 주문(수행자)은 WillConsentPage를
              거치지 않고 이 화면이 유일한 동의 접점이라 여기에도 넣는다 */}
          <div style={{ width: '100%' }}>
            <LegalNotice theme="light" />
          </div>
          <ErrorBox />
          <Button onClick={submitConsent} isLoading={busy} fullWidth>동의하고 시작하기</Button>
        </div>
      </Screen>
    )
  }

  if (step === STEP.PHOTO) {
    return (
      <Screen>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
          <Camera size={40} color="var(--color-primary)" />
          <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700 }}>사진을 올려주세요</p>
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
            영상에 쓰일 얼굴 사진 한 장을 선택해 주세요.
          </p>
          <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProfilePhoto(f) }} />
          <ErrorBox />
          <Button onClick={() => photoInputRef.current?.click()} isLoading={busy} fullWidth>사진 선택하기</Button>
        </div>
      </Screen>
    )
  }

  if (step === STEP.VOICE) {
    return (
      <Screen>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
          <Mic size={40} color="var(--color-primary)" />
          <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700 }}>목소리를 들려주세요</p>
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
            휴대폰 녹음 앱으로 30초 정도 편하게 이야기를 녹음한 뒤, 그 파일을 올려주세요.
          </p>
          <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/wav,audio/webm" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVoice(f) }} />
          {busy ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} color="var(--color-primary)" />
              <span style={{ color: 'var(--color-text-secondary)' }}>목소리를 처리하고 있어요...</span>
            </div>
          ) : (
            <>
              <ErrorBox />
              <Button onClick={() => audioInputRef.current?.click()} fullWidth>녹음 파일 올리기</Button>
            </>
          )}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </Screen>
    )
  }

  if (step === STEP.MESSAGE) {
    return (
      <Screen>
        <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, textAlign: 'center' }}>전하고 싶은 말을 적어주세요</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="title" style={{ fontWeight: 600 }}>제목</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="예: 사랑하는 우리 가족에게" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="contentText" style={{ fontWeight: 600 }}>편지 내용</label>
          <textarea
            id="contentText"
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            rows={8}
            style={{ ...inputStyle, height: 'auto', padding: 16, lineHeight: 'var(--lh-relaxed)' }}
            placeholder="영상에서 읽어드릴 내용을 자유롭게 적어주세요"
          />
        </div>
        <ErrorBox />
        <Button onClick={submitMessage} disabled={!title.trim() || !contentText.trim()} fullWidth>다음</Button>
      </Screen>
    )
  }

  if (step === STEP.BENEFICIARY) {
    const update = (field) => (e) => setBeneficiary((b) => ({ ...b, [field]: e.target.value }))
    return (
      <Screen>
        <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, textAlign: 'center' }}>누구에게 보낼까요?</p>
        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
          영상을 전달받을 분의 정보를 입력해 주세요.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="bName" style={{ fontWeight: 600 }}>이름</label>
          <input id="bName" value={beneficiary.name} onChange={update('name')} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="bRelationship" style={{ fontWeight: 600 }}>관계</label>
          <input id="bRelationship" value={beneficiary.relationship} onChange={update('relationship')} style={inputStyle} placeholder="예: 딸, 아들, 배우자" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="bEmail" style={{ fontWeight: 600 }}>이메일</label>
          <input id="bEmail" type="email" value={beneficiary.email} onChange={update('email')} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="bPhone" style={{ fontWeight: 600 }}>휴대폰 번호 (선택)</label>
          <input id="bPhone" value={beneficiary.phone} onChange={update('phone')} style={inputStyle} />
        </div>
        <ErrorBox />
        <Button
          onClick={submitBeneficiary}
          isLoading={busy}
          disabled={!beneficiary.name.trim() || !beneficiary.email.trim() || !beneficiary.relationship.trim()}
          fullWidth
        >
          영상 만들기 시작
        </Button>
      </Screen>
    )
  }

  if (step === STEP.GENERATING) {
    return (
      <Screen>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
          <Loader2 size={40} style={{ animation: 'spin 1s linear infinite' }} color="var(--color-primary)" />
          <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700 }}>영상을 만들고 있어요</p>
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
            시간이 조금 걸려요. 이 화면을 닫아도 계속 진행돼요.
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </Screen>
    )
  }

  if (step === STEP.DONE) {
    return (
      <Screen>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
          <CheckCircle2 size={44} color="var(--color-primary)" />
          <p style={{ fontSize: 'var(--fs-h2)', fontWeight: 800 }}>영상 편지가 완성됐어요!</p>
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
            수고하셨어요. 마이페이지에서 언제든 다시 보실 수 있어요.
          </p>
          <Button onClick={() => { window.location.href = '/my' }} fullWidth>마이페이지로 이동</Button>
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      <div role="alert" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-md)' }}>
        <AlertCircle size={44} color="var(--color-error)" />
        <p style={{ fontWeight: 700 }}>문제가 발생했어요</p>
        <p style={{ color: 'var(--color-text-secondary)' }}>{error ?? '잠시 후 다시 시도해 주세요.'}</p>
      </div>
    </Screen>
  )
}

export default GiftPerformWillPage
