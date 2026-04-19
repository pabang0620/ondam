import { Link } from 'react-router-dom'
import { useJoin } from './useJoin.js'
import { ROUTES } from '../../constants/routes.js'

function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6" aria-label={`${total}단계 중 ${current}단계`}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
            style={{
              backgroundColor: n <= current ? 'var(--color-primary)' : 'var(--color-border)',
              color: n <= current ? 'var(--color-surface)' : 'var(--color-text-muted)',
            }}
            aria-current={n === current ? 'step' : undefined}
          >
            {n}
          </div>
          {n < total && (
            <div
              className="w-8 h-0.5 transition-all"
              style={{
                backgroundColor: n < current ? 'var(--color-primary)' : 'var(--color-border)',
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function InputField({ id, label, type = 'text', value, onChange, placeholder, disabled, autoComplete }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-medium"
        style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 rounded-xl outline-none transition-all"
        style={{
          height: 'var(--min-touch-target)',
          fontSize: 'var(--font-size-base)',
          border: '1.5px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
      />
    </div>
  )
}

export default function JoinPage() {
  const {
    step,
    setStep,
    email, setEmail,
    password, setPassword,
    nickname, setNickname,
    consents,
    handleConsentChange,
    handleAllConsent,
    allChecked,
    isLoading,
    error,
    handleNextStep,
    handleSubmit,
    consentItems,
  } = useJoin()

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1
          className="font-bold mb-1"
          style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-text-primary)' }}
        >
          회원가입
        </h1>
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
          온담과 함께 소중한 기억을 간직하세요
        </p>
      </div>

      <StepIndicator current={step} total={2} />

      {/* Step 1: 기본 정보 입력 */}
      {step === 1 && (
        <form onSubmit={handleNextStep} noValidate className="flex flex-col gap-4">
          <InputField
            id="join-email"
            label="이메일"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            disabled={isLoading}
          />
          <InputField
            id="join-password"
            label="비밀번호"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상 입력해주세요"
            disabled={isLoading}
          />
          <InputField
            id="join-nickname"
            label="닉네임"
            type="text"
            autoComplete="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="2자 이상 입력해주세요"
            disabled={isLoading}
          />

          {error && (
            <p
              role="alert"
              className="px-3 py-2 rounded-lg text-sm"
              style={{
                color: 'var(--color-error)',
                backgroundColor: '#FFF5F5',
                border: '1px solid #FED7D7',
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-xl font-semibold transition-opacity"
            style={{
              minHeight: 'var(--min-touch-target)',
              fontSize: 'var(--font-size-lg)',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-surface)',
            }}
          >
            다음 단계
          </button>
        </form>
      )}

      {/* Step 2: 동의 항목 */}
      {step === 2 && (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            {/* 전체 동의 */}
            <label
              className="flex items-center gap-3 cursor-pointer"
              style={{ minHeight: 'var(--min-touch-target)' }}
            >
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(e) => handleAllConsent(e.target.checked)}
                className="w-5 h-5 accent-[var(--color-primary)]"
                aria-label="전체 동의"
              />
              <span
                className="font-bold"
                style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-primary)' }}
              >
                전체 동의
              </span>
            </label>

            <hr style={{ borderColor: 'var(--color-border)' }} />

            {/* 개별 동의 항목 */}
            {consentItems.map((item) => (
              <label
                key={item.type}
                className="flex items-center gap-3 cursor-pointer"
                style={{ minHeight: 'var(--min-touch-target)' }}
              >
                <input
                  type="checkbox"
                  checked={consents[item.type]}
                  onChange={() => handleConsentChange(item.type)}
                  className="w-5 h-5 accent-[var(--color-primary)]"
                  aria-required={item.required}
                />
                <span
                  className="flex items-center gap-1"
                  style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}
                >
                  {item.label}
                  {item.required && (
                    <span style={{ color: 'var(--color-error)', fontWeight: 700 }} aria-label="필수">
                      *
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>

          {error && (
            <p
              role="alert"
              className="px-3 py-2 rounded-lg text-sm"
              style={{
                color: 'var(--color-error)',
                backgroundColor: '#FFF5F5',
                border: '1px solid #FED7D7',
              }}
            >
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={isLoading}
              className="flex-1 rounded-xl font-semibold transition-colors"
              style={{
                minHeight: 'var(--min-touch-target)',
                fontSize: 'var(--font-size-base)',
                border: '1.5px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
              }}
            >
              이전
            </button>
            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="flex-[2] rounded-xl font-semibold transition-opacity"
              style={{
                minHeight: 'var(--min-touch-target)',
                fontSize: 'var(--font-size-lg)',
                backgroundColor: isLoading ? 'var(--color-primary-light)' : 'var(--color-primary)',
                color: 'var(--color-surface)',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? '가입 중...' : '가입 완료'}
            </button>
          </div>
        </form>
      )}

      {/* 구분선 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--color-border)' }} />
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>또는</span>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--color-border)' }} />
      </div>

      {/* 카카오 시작하기 */}
      <a
        href="/api/auth/kakao"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-sm)',
          width: '100%',
          minHeight: 'var(--min-touch-target)',
          background: '#FEE500',
          color: '#000000',
          border: 'none',
          borderRadius: 'var(--radius-full)',
          fontSize: 'var(--font-size-base)',
          fontWeight: 700,
          textDecoration: 'none',
          cursor: 'pointer',
        }}
      >
        <img
          src="https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_small.png"
          alt=""
          style={{ width: 20, height: 20 }}
        />
        카카오로 시작하기
      </a>

      {/* 로그인 링크 */}
      <p
        className="text-center"
        style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}
      >
        이미 계정이 있으신가요?{' '}
        <Link
          to={ROUTES.LOGIN}
          className="font-semibold hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          로그인
        </Link>
      </p>
    </div>
  )
}
