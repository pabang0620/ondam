import { Eye, EyeOff } from 'lucide-react'

// 비밀번호 보기/숨기기 토글 - 로그인·회원가입 공용.
// 부모는 position: relative인 래퍼여야 하고, input 오른쪽 padding을 64px 이상 줘야
// 입력 글자와 겹치지 않는다. 터치 타겟 48px(어르신 UX).
export default function PasswordToggleButton({ visible, onToggle, controls }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={visible}
      aria-controls={controls}
      aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
      className="absolute flex items-center justify-center"
      style={{
        top: '50%',
        right: 4,
        transform: 'translateY(-50%)',
        width: 'var(--min-touch-target)',
        height: 'var(--min-touch-target)',
        minHeight: 'var(--min-touch-target)',
        border: 'none',
        background: 'transparent',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--color-text-primary)',
        cursor: 'pointer',
      }}
    >
      {visible ? <EyeOff size={22} aria-hidden="true" /> : <Eye size={22} aria-hidden="true" />}
    </button>
  )
}
