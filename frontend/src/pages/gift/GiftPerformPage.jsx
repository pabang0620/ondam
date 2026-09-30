import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, AlertCircle, Lock, ShieldCheck, Gift, LogIn, UserPlus, Info } from 'lucide-react'
import { Button } from '../../components/common/Button.jsx'
import { ROUTES } from '../../constants/routes.js'
import { SIGNUP_CONSENT_ITEMS } from '../../components/consent/consentItems.js'
import useGiftPerform, { PHASE } from './useGiftPerform.js'

// FIX: 결함2 - WillWatchPage.jsx와 동일한 문제. Footer.jsx와 같은 패턴(VITE_CONTACT_PHONE이
// 있으면 실제 번호를, 없으면 그 문구 자체를 노출하지 않는다)을 재사용한다.
const CONTACT_PHONE = import.meta.env.VITE_CONTACT_PHONE

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

// Button.jsx의 primary/secondary와 같은 모양의 링크(라우터 이동이라 <a>가 맞다)
const linkButtonStyle = (variant) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: 'var(--size-button-h)',
  borderRadius: 'var(--radius-pill)',
  fontSize: 'var(--fs-button)',
  fontWeight: 700,
  textDecoration: 'none',
  ...(variant === 'primary'
    ? { background: 'var(--color-primary)', color: 'var(--color-text-on-dark)' }
    : { background: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)' }),
})

/* 본인확인 - WillWatchPage.jsx와 동일한 UX 원칙(48px 터치, 16px+ 폰트) */
function VerifyStep({ verifyError, isVerifying, onSubmit }) {
  const [phoneLast4, setPhoneLast4] = useState('')
  const handleChange = (e) => setPhoneLast4(e.target.value.replace(/\D/g, '').slice(0, 4))
  const handleSubmit = (e) => {
    e.preventDefault()
    if (phoneLast4.length !== 4 || isVerifying) return
    onSubmit(phoneLast4)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-lg)', textAlign: 'center' }}>
      <ShieldCheck size={40} color="var(--color-primary)" aria-hidden="true" />
      <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--color-text-primary)' }}>선물이 도착했어요</p>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
        본인 확인을 위해 휴대폰 번호 뒤 4자리를 입력해 주세요.
      </p>
      <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <label htmlFor="phoneLast4" style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          휴대폰 번호 뒤 4자리
        </label>
        <input
          id="phoneLast4"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={4}
          value={phoneLast4}
          onChange={handleChange}
          placeholder="0000"
          style={{ ...inputStyle, textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
        />
        {verifyError && (
          <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <AlertCircle size={16} /> {verifyError}
          </p>
        )}
        <Button type="submit" isLoading={isVerifying} disabled={phoneLast4.length !== 4} fullWidth>
          확인
        </Button>
      </form>
    </div>
  )
}

function LockedStep({ verifyError }) {
  return (
    <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-md)', textAlign: 'center' }}>
      <Lock size={48} color="var(--color-warm-accent)" aria-hidden="true" />
      <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--color-text-primary)' }}>잠시 확인이 필요합니다</p>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
        {verifyError ?? '본인 확인 시도 횟수를 초과했습니다.'}
      </p>
      {CONTACT_PHONE ? (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          고객센터(
          <a href={`tel:${CONTACT_PHONE}`} style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'underline' }}>
            {CONTACT_PHONE}
          </a>
          )로 연락 주시면 바로 도와드리겠습니다.
        </p>
      ) : (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          고객센터 연락처는 준비 중입니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </div>
  )
}

// FE-GMA-8: 거절 실패 안내 + 처리 중 잠금을 Intro/Account 단계가 공유한다.
function DeclineButton({ onDecline, isDeclining, declineError, disabled = false }) {
  return (
    <>
      {declineError && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <AlertCircle size={16} aria-hidden="true" /> {declineError}
        </p>
      )}
      <button
        type="button"
        onClick={onDecline}
        disabled={isDeclining || disabled}
        aria-busy={isDeclining}
        style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 'var(--fs-body)', textDecoration: 'underline', cursor: isDeclining || disabled ? 'not-allowed' : 'pointer', minHeight: 'var(--min-touch-target)' }}
      >
        {isDeclining ? '거절 처리 중...' : '정중히 거절하기'}
      </button>
    </>
  )
}

function IntroStep({ info, onNext, onDecline, isDeclining, declineError }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-lg)', textAlign: 'center' }}>
      <Gift size={44} color="var(--color-primary)" aria-hidden="true" />
      <p style={{ fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: 'var(--ls-heading-ko)' }}>
        {info?.giverNickname ? `${info.giverNickname}님이 선물을 보냈어요` : '선물이 도착했어요'}
      </p>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
        {info?.productType === 'will'
          ? '사진과 목소리로 소중한 분께 남기는 영상 편지예요. 준비되시면 시작해 주세요.'
          : '오래된 사진을 새롭게 되살려 드릴게요. 준비되시면 시작해 주세요.'}
      </p>
      <Button onClick={onNext} disabled={isDeclining} fullWidth>시작하기</Button>
      <DeclineButton onDecline={onDecline} isDeclining={isDeclining} declineError={declineError} />
    </div>
  )
}

// FIX: 결함B - [{type:'privacy'}]만 보내 회원가입 필수 약관(terms) 동의를 우회하던
// 부분을 일반 회원가입(useJoin.js)과 동등한 SIGNUP_CONSENT_ITEMS(terms 필수/privacy
// 필수/marketing 선택)로 맞춘다. 문구는 useJoin.js 원문을 그대로 옮긴 것으로 새로
// 만들지 않았다.
const initialSignupConsents = SIGNUP_CONSENT_ITEMS.reduce(
  (acc, item) => ({ ...acc, [item.type]: false }),
  {},
)

// 2026-08-23: 로그인(mode==='login') 모드는 기본적으로 동의 체크박스를 보여주지
// 않는다 - 대다수 로그인 사용자는 이미 동의를 마친 계정이라 불필요한 체크박스를
// 매번 보여주면 어르신 사용자에게 마찰만 늘린다. 서버가 "이 계정에 빠진 필수 동의가
// 있다"(400, needsAccountConsent)고 응답했을 때만 로그인 폼 안에 같은 체크박스를
// 인라인으로 펼쳐 보여주고, 입력해 둔 이메일·비밀번호는 그대로 유지한 채 재제출하게
// 한다(전체 화면 전환·재입력 없음). 반대로 항상 먼저 보여주는 방식(안내 문서의 (b)
// 안)은 이미 동의한 다수에게도 매번 체크를 요구해 더 큰 마찰이 된다 - 완료 보고에
// 근거 상술.
function AccountStep({ accountError, needsAccountConsent, isLinking, onSubmit, onDecline, isDeclining, declineError }) {
  const [mode, setMode] = useState('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [consents, setConsents] = useState(initialSignupConsents)

  const requiredItems = SIGNUP_CONSENT_ITEMS.filter((item) => item.required)
  const allRequiredAgreed = requiredItems.every((item) => consents[item.type])
  const showLoginConsent = mode === 'login' && needsAccountConsent

  const canSubmit =
    email.trim() &&
    password.length >= (mode === 'signup' ? 8 : 1) &&
    (mode === 'login'
      ? (!showLoginConsent || allRequiredAgreed)
      : (nickname.trim() && allRequiredAgreed)) &&
    !isLinking

  const handleConsentChange = (type) => {
    setConsents((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({
      mode,
      email: email.trim(),
      password,
      nickname: nickname.trim() || undefined,
      consents: mode === 'signup'
        ? SIGNUP_CONSENT_ITEMS.map((item) => ({ type: item.type, isAgreed: consents[item.type] }))
        : showLoginConsent
          ? requiredItems.map((item) => ({ type: item.type, isAgreed: consents[item.type] }))
          : undefined,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--color-text-primary)' }}>계정을 만들어 주세요</p>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', marginTop: 6 }}>
          만든 사진·영상은 온담에서 언제든 다시 볼 수 있어요.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => setMode('signup')}
          aria-pressed={mode === 'signup'}
          style={{
            flex: 1, minHeight: 'var(--min-touch-target)', borderRadius: 'var(--radius-pill)',
            border: `2px solid ${mode === 'signup' ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: mode === 'signup' ? 'var(--color-surface-warm)' : 'transparent',
            fontWeight: 700, fontSize: 'var(--fs-body)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <UserPlus size={18} /> 처음이에요
        </button>
        <button
          type="button"
          onClick={() => setMode('login')}
          aria-pressed={mode === 'login'}
          style={{
            flex: 1, minHeight: 'var(--min-touch-target)', borderRadius: 'var(--radius-pill)',
            border: `2px solid ${mode === 'login' ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: mode === 'login' ? 'var(--color-surface-warm)' : 'transparent',
            fontWeight: 700, fontSize: 'var(--fs-body)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <LogIn size={18} /> 이미 계정이 있어요
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="email" style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>이메일</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} autoComplete="email" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="password" style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>비밀번호</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder={mode === 'signup' ? '8자 이상' : undefined}
          />
        </div>
        {mode === 'signup' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="nickname" style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>이름(닉네임)</label>
              <input id="nickname" type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SIGNUP_CONSENT_ITEMS.map((item) => (
                <label
                  key={item.type}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--fs-body)', color: 'var(--color-text-primary)', minHeight: 'var(--min-touch-target)' }}
                >
                  <input
                    type="checkbox"
                    checked={consents[item.type]}
                    onChange={() => handleConsentChange(item.type)}
                    aria-required={item.required}
                    style={{ width: 22, height: 22, flexShrink: 0 }}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </>
        )}
        {showLoginConsent && (
          <div
            role="alert"
            style={{
              display: 'flex', flexDirection: 'column', gap: 10,
              padding: 'var(--spacing-md)', borderRadius: 10,
              background: 'var(--color-surface-warm)', border: '1px solid var(--color-border)',
            }}
          >
            <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              계속하려면 아래 약관에 동의해 주세요.
            </p>
            {requiredItems.map((item) => (
              <label
                key={item.type}
                style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--fs-body)', color: 'var(--color-text-primary)', minHeight: 'var(--min-touch-target)' }}
              >
                <input
                  type="checkbox"
                  checked={consents[item.type]}
                  onChange={() => handleConsentChange(item.type)}
                  aria-required="true"
                  style={{ width: 22, height: 22, flexShrink: 0 }}
                />
                {item.label}
              </label>
            ))}
          </div>
        )}
        {accountError && (
          <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)' }}>{accountError}</p>
        )}
        <Button type="submit" isLoading={isLinking} disabled={!canSubmit || isDeclining} fullWidth>
          {mode === 'signup' ? '계정 만들고 시작하기' : '로그인하고 시작하기'}
        </Button>
      </form>

      <DeclineButton onDecline={onDecline} isDeclining={isDeclining} disabled={isLinking} declineError={declineError} />
    </div>
  )
}

function DeclinedStep({ declineResult }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-md)', textAlign: 'center' }}>
      <Heart size={40} color="var(--color-text-muted)" aria-hidden="true" />
      <p style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--color-text-primary)' }}>거절 처리가 완료됐어요</p>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
        괜찮아요. 보내주신 분께는 정중히 안내해 드렸고,
        {declineResult?.refunded ? ' 결제 금액도 전액 환불됐어요.' : ' 환불은 곧 처리될 예정이에요.'}
      </p>
    </div>
  )
}

export default function GiftPerformPage() {
  const {
    phase, info, fetchError, fetchStatus, verifyError, isVerifying, accountError, needsAccountConsent, isLinking,
    declineResult, declineError, isDeclining,
    submitVerification, goToAccount, submitAccount, submitDecline,
  } = useGiftPerform()

  const handleDecline = () => {
    if (isDeclining) return
    if (window.confirm('정말 선물을 거절하시겠어요? 보내주신 분께 결제 금액이 환불돼요.')) {
      submitDecline()
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '48px var(--spacing-md) 48px' }}>
      {phase === PHASE.LOADING && (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }} aria-live="polite">불러오는 중입니다...</div>
      )}
      {/* FE-GMA-11: 410(이미 완성/거절/환불/만료)은 사용자가 잘못한 게 아니므로 오류색
          대신 안내 톤으로 보여주고, 다음에 갈 곳(마이페이지/홈)을 버튼으로 제공한다. */}
      {phase === PHASE.ERROR && fetchStatus === 410 && (
        <div role="status" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', alignItems: 'center' }}>
          <Info size={48} color="var(--color-primary)" aria-hidden="true" />
          <p style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>안내드립니다</p>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>{fetchError}</p>
          <Link to={ROUTES.MY} style={linkButtonStyle('primary')}>마이페이지로 이동</Link>
          <Link to={ROUTES.HOME} style={linkButtonStyle('secondary')}>홈으로 가기</Link>
        </div>
      )}
      {phase === PHASE.ERROR && fetchStatus !== 410 && (
        <div role="alert" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', alignItems: 'center' }}>
          <AlertCircle size={48} color="var(--color-error)" aria-hidden="true" />
          <p style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700 }}>링크를 열 수 없습니다</p>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>{fetchError}</p>
        </div>
      )}
      {phase === PHASE.LOCKED && <LockedStep verifyError={verifyError} />}
      {phase === PHASE.VERIFY && <VerifyStep verifyError={verifyError} isVerifying={isVerifying} onSubmit={submitVerification} />}
      {phase === PHASE.INTRO && (
        <IntroStep
          info={info}
          onNext={goToAccount}
          onDecline={handleDecline}
          isDeclining={isDeclining}
          declineError={declineError}
        />
      )}
      {phase === PHASE.ACCOUNT && (
        <AccountStep
          accountError={accountError}
          needsAccountConsent={needsAccountConsent}
          isLinking={isLinking}
          onSubmit={submitAccount}
          onDecline={handleDecline}
          isDeclining={isDeclining}
          declineError={declineError}
        />
      )}
      {phase === PHASE.DECLINED && <DeclinedStep declineResult={declineResult} />}
    </main>
  )
}
