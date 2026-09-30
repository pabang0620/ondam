// 영상 편지 작성 단계 간 localStorage 공유 헬퍼
// 손상된 JSON이 들어 있어도 화면이 깨지지 않도록 파싱 실패 시 기본값을 돌려준다.

export const WILL_STORAGE_KEYS = [
  'will_consents',
  'will_beneficiaries',
  'will_audio_s3key',
  'will_voice_sample_id',
  'will_photo_s3key',
  'will_photo_url',
  'will_current_id',
]

export function readWillJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

export function clearWillDraft() {
  WILL_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key)
    } catch {
      // 저장소 접근 불가(사생활 보호 모드 등)는 무시
    }
  })
}
