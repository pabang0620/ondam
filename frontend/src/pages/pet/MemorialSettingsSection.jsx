import { useState } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'

// FIX: DEV-30 - 가족이 전화로 불러줄 수 있을 정도로 쉬운 6자리 숫자 코드를 기본값으로
// 제안한다. 사용자가 원하면 직접 다른 값(6자 이상)으로 바꿀 수 있다.
function generateAccessCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

const inputStyle = {
  border: '1.5px solid var(--color-border-strong)',
  borderRadius: 'var(--radius-sm)',
  padding: '0 var(--spacing-md)',
  minHeight: 'var(--size-input-h)',
  fontSize: 'var(--fs-body)',
  width: '100%',
  outline: 'none',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
}

// FIX: DEV-30 - 추모 페이지 접근 코드/주소를 설정할 수 있는 유일한 UI. 이게 없어서
// PUT /api/pet/:petId 의 memorialSlug·memorialAccessCode를 호출하는 곳이 프론트에 0건
// 이었고, 백엔드가 "접근 코드 없으면 비공개(404)"로 확정하면서 모든 추모 페이지가
// 영구 404가 됐다.
// FIX: DEV-31 - 백엔드 GET /pet/:petId(소유자 전용)가 이제 memorial_access_code를
// 함께 내려준다. 따라서 새로고침 이후에도 소유자 본인은 현재 코드를 이 화면에서 다시
// 확인할 수 있다. 기존의 "저장 후에는 다시 확인할 수 없다" 안내는 사실과 달라졌으므로
// 문구를 실제 동작에 맞춰 수정했고, 입력란에도 현재 코드를 채워 보여준다.
// FIX: DEV-16 - 추모 페이지 공개/비공개 토글. 기본값은 항상 비공개(pet.is_public이
// 없거나 0이면 false)이며, 사용자가 명시적으로 체크해야만 공개로 전환된다(안전 기본값
// - SPEC-03, 마이그레이션 b README 3절과 동일한 원칙). 공개로 켜면 접근 코드 없이도
// 누구나 볼 수 있다는 점을 쉬운 말로 안내한다(어르신 UX).
export default function MemorialSettingsSection({ pet, isSaving, saveError, onSave }) {
  const [slug, setSlug] = useState(pet.memorial_slug || pet.pet_id)
  const [code, setCode] = useState(pet.memorial_access_code || generateAccessCode())
  const [isPublic, setIsPublic] = useState(Boolean(pet.is_public))
  const [savedCode, setSavedCode] = useState(null)
  const [copied, setCopied] = useState(false)

  const trimmedCode = code.trim()
  const canSave = slug.trim().length >= 3 && trimmedCode.length >= 6

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSave || isSaving) return
    const ok = await onSave({ memorialSlug: slug.trim(), memorialAccessCode: trimmedCode, isPublic })
    if (ok) {
      setSavedCode(trimmedCode)
      setCopied(false)
    }
  }

  const memorialLink = savedCode
    ? `${window.location.origin}/memorial/${slug.trim()}?accessCode=${encodeURIComponent(savedCode)}`
    : null

  const handleCopy = async () => {
    if (!memorialLink) return
    try {
      await navigator.clipboard.writeText(memorialLink)
      setCopied(true)
    } catch {
      // 클립보드 접근 실패해도 링크 텍스트는 화면에 그대로 보이므로 수동 복사가 가능하다
    }
  }

  return (
    <section
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--spacing-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
        background: 'var(--color-surface)',
      }}
      aria-label="추모 페이지 접근 코드 설정"
    >
      <div>
        <p style={{ fontSize: 'var(--fs-body)', fontWeight: 700, marginBottom: 4, color: 'var(--color-primary)' }}>
          추모 페이지 접근 코드
        </p>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          이 코드를 아는 가족만 추모 페이지를 볼 수 있어요. 코드를 설정해야 추모 페이지가 열립니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-md)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg-subtle, var(--color-surface))',
          }}
        >
          <input
            id="memorial-is-public"
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            style={{ width: 24, height: 24, minWidth: 24, marginTop: 2, cursor: 'pointer' }}
            aria-describedby="memorial-is-public-help"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label
              htmlFor="memorial-is-public"
              style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--color-text-primary)', cursor: 'pointer' }}
            >
              추모 페이지 공개하기
            </label>
            <p id="memorial-is-public-help" style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              공개하면 링크를 아는 누구나 접근 코드 없이 볼 수 있어요. 체크하지 않으면
              기본값인 비공개로 유지되고, 아래 접근 코드를 아는 가족만 볼 수 있어요.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          <label htmlFor="memorial-slug" style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            추모 페이지 주소
          </label>
          <input
            id="memorial-slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            style={inputStyle}
            aria-describedby="memorial-slug-help"
          />
          <p id="memorial-slug-help" style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-muted)' }}>
            영문 소문자, 숫자, 하이픈(-)만 사용할 수 있어요. 특별히 원하는 주소가 없으면 그대로 두셔도 됩니다.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          <label htmlFor="memorial-code" style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            가족 접근 코드 (6자 이상)
          </label>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <input
              id="memorial-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6자 이상으로 입력해 주세요"
              style={inputStyle}
              aria-describedby="memorial-code-help"
            />
            <button
              type="button"
              onClick={() => setCode(generateAccessCode())}
              aria-label="코드 새로 만들기"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-xs)',
                minHeight: 'var(--min-touch-target)',
                minWidth: 'var(--min-touch-target)',
                padding: '0 var(--spacing-md)',
                background: 'var(--color-pet-soft)',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-pet)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--fs-body)',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <RefreshCw size={16} aria-hidden="true" />
              새로 만들기
            </button>
          </div>
          <p id="memorial-code-help" style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-muted)' }}>
            숫자 6자리를 추천해요. 가족에게 전화로 알려주기 쉬워요. 지금 설정된 코드는 이 화면에서 언제든 다시
            확인할 수 있으니, 잊어버리셔도 걱정하지 않으셔도 됩니다.
            {isPublic && ' (지금은 공개로 설정되어 있어 이 코드는 사용되지 않아요. 나중에 비공개로 바꾸면 다시 필요해요.)'}
          </p>
        </div>

        {saveError && <p className="pet-detail-memorial-error" role="alert">{saveError}</p>}

        <button
          type="submit"
          disabled={!canSave || isSaving}
          aria-busy={isSaving}
          style={{
            alignSelf: 'flex-start',
            minHeight: 'var(--size-button-h)',
            minWidth: 120,
            padding: '0 var(--spacing-xl)',
            background: !canSave || isSaving ? 'var(--color-text-muted)' : 'var(--color-primary)',
            color: 'var(--color-surface)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            fontSize: 'var(--fs-button)',
            fontWeight: 700,
            cursor: !canSave || isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          {isSaving ? '저장 중...' : '저장하기'}
        </button>
      </form>

      {memorialLink && (
        <div
          role="status"
          style={{
            border: '1px solid var(--color-pet)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--spacing-md)',
            background: 'var(--color-pet-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
          }}
        >
          <p style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--color-primary)' }}>
            저장했어요! 아래 링크를 가족에게 전달해 주세요.
          </p>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-text-primary)', wordBreak: 'break-all' }}>
            {memorialLink}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              minHeight: 'var(--min-touch-target)',
              padding: '0 var(--spacing-md)',
              background: 'var(--color-surface)',
              color: 'var(--color-primary)',
              border: '1.5px solid var(--color-primary)',
              borderRadius: 'var(--radius-pill)',
              fontSize: 'var(--fs-body)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? '복사됨' : '링크 복사하기'}
          </button>
        </div>
      )}
    </section>
  )
}
