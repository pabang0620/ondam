import { Link } from 'react-router-dom'
import { useJoin } from './useJoin.js'
import { ROUTES } from '../../constants/routes.js'

function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6" aria-label={`${total}단계 중 ${current}단계`}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{
              backgroundColor: n <= current ? 'var(--color-primary)' : 'var(--color-border)',
              color: n <= current ? 'var(--color-surface)' : 'var(--color-text-muted)',
              transition: 'background-color var(--transition-base)',
            }}
            aria-current={n === current ? 'step' : undefined}
          >
            {n}
          </div>
          {n < total && (
            <div
              className="w-8"
              style={{
                height: '2px',
                backgroundColor: n < current ? 'var(--color-primary)' : 'var(--color-border)',
                transition: 'background-color var(--transition-base)',
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
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="font-medium"
        style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-primary)' }}
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
        className="w-full outline-none"
        style={{
          height: 'var(--size-input-h)',
          padding: '0 16px',
          fontSize: 'var(--fs-body)',
          border: '1px solid var(--color-border)',
          borderRadius: '10px',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
          transition: 'border-color var(--transition-base)',
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
    <div className="flex flex-col gap-7">
      <div className="text-center">
        <h1
          className="font-bold mb-1"
          style={{
            fontSize: 'var(--fs-h2)',
            color: 'var(--color-text-primary)',
            letterSpacing: 'var(--ls-heading-ko)',
          }}
        >
          회원가입
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}>
          온담과 함께 소중한 기억을 간직하세요
        </p>
      </div>

      <StepIndicator current={step} total={2} />

      {/* Step 1: 기본 정보 입력 */}
      {step === 1 && (
        <form onSubmit={handleNextStep} noValidate className="flex flex-col gap-5">
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
              style={{
                fontSize: 'var(--fs-body)',
                color: 'var(--color-error)',
                backgroundColor: 'var(--color-error-light)',
                border: '1px solid var(--color-error-muted)',
                borderRadius: '10px',
                padding: '10px 14px',
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full font-semibold mt-2"
            style={{
              height: 'var(--size-button-h)',
              fontSize: 'var(--fs-button)',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-surface)',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              opacity: isLoading ? 0.65 : 1,
              transition: 'opacity var(--transition-base)',
            }}
          >
            다음 단계
          </button>
        </form>
      )}

      {/* Step 2: 동의 항목 */}
      {step === 2 && (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <div
            style={{
              backgroundColor: 'var(--color-accent)',
              borderRadius: 'var(--radius-card)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* 전체 동의 */}
            <label
              className="flex items-center gap-3 cursor-pointer"
              style={{ minHeight: 'var(--size-button-h)' }}
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
                style={{ fontSize: 'var(--fs-body-lg)', color: 'var(--color-text-primary)' }}
              >
                전체 동의
              </span>
            </label>

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)' }} />

            {/* 개별 동의 항목 */}
            {consentItems.map((item) => (
              <label
                key={item.type}
                className="flex items-center gap-3 cursor-pointer"
                style={{ minHeight: 'var(--size-button-h)' }}
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
                  style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-primary)' }}
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
              style={{
                fontSize: 'var(--fs-body)',
                color: 'var(--color-error)',
                backgroundColor: 'var(--color-error-light)',
                border: '1px solid var(--color-error-muted)',
                borderRadius: '10px',
                padding: '10px 14px',
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
              className="flex-1 font-semibold"
              style={{
                height: 'var(--size-button-h)',
                fontSize: 'var(--fs-body)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              이전
            </button>
            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="flex-[2] font-semibold"
              style={{
                height: 'var(--size-button-h)',
                fontSize: 'var(--fs-button)',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-surface)',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                opacity: isLoading ? 0.65 : 1,
                transition: 'opacity var(--transition-base)',
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
        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}>또는</span>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--color-border)' }} />
      </div>

      {/* 카카오 시작하기 - 카카오 노란색 유지(접근성) */}
      <a
        href="/api/auth/kakao"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-sm)',
          width: '100%',
          height: 'var(--size-button-h)',
          background: '#FEE500',
          color: '#191600',
          borderRadius: 'var(--radius-pill)',
          fontSize: 'var(--fs-button)',
          fontWeight: 700,
          textDecoration: 'none',
          border: 'none',
        }}
      >
        <img
          src="https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_small.png"
          alt=""
          width={20}
          height={20}
          style={{ width: 20, height: 20 }}
        />
        카카오로 시작하기
      </a>

      {/* 로그인 링크 */}
      <p
        className="text-center"
        style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)' }}
      >
        이미 계정이 있으신가요?{' '}
        <Link
          to={ROUTES.LOGIN}
          className="font-semibold hover:underline"
          // FIX: 결함5 - 폰트는 16px(부모 p의 --fs-body 상속)로 이미 충족했지만
          // 인라인 텍스트라 실제 탭 가능 높이가 텍스트 줄 높이(약 24px)뿐이었다.
          // inline-flex + min-height로 어르신 UX 기준(48px)을 채운다. 단일 문단의
          // 마지막 요소라 줄 높이를 키워도 다른 레이아웃을 밀어내지 않는다.
          style={{
            color: 'var(--color-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 'var(--min-touch-target)',
            padding: '0 4px',
          }}
        >
          로그인
        </Link>
      </p>
    </div>
  )
}
