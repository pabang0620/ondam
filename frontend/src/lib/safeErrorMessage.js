// 결함4 방어 유틸 - 서버가 준 사용자용 실패 사유(예: activateWill의 "프로필 사진이
// 없습니다..." 400 메시지)는 원래 행동 가능한 정보라 그대로 보여줘야 하지만, 무비판적으로
// 뿌리면 안 된다. 백엔드 errorHandler.js는 NODE_ENV=development에서 5xx 원문(DB 에러,
// 벤더 응답, 환경변수명 등)까지 그대로 응답에 실어 보낸다 - 프로덕션 전환 전 실수로
// development 설정이 남거나, 다른 팀이 백엔드를 손보는 동안 일시적으로 원문이 샐 수 있다.
// 5060 대상 서비스라 그런 문구가 그대로 노출되면 혼란이 크다.
//
// 백엔드 utils/failureMessages.js와 동일한 차단목록(blocklist) 원칙 - 완벽한 분류가
// 목적이 아니라 "내부 구조를 노출하는 패턴이면 걸러낸다"가 목적이므로, 매칭되지 않는
// 나머지 문구는 그대로 통과시킨다(우리 자신의 컨트롤러가 던지는 한국어 안내문은 대부분
// 여기 걸리지 않는다).
const UNSAFE_PATTERNS = [
  // 환경변수·API 키·인증 정보
  /환경변수|API[_ ]?KEY|api[_ ]?key|credential/i,
  // 외부 벤더명·HTTP 상태코드·벤더 응답 원문
  /elevenlabs|sync\.?so|musetalk|d-id|toss ?payments?|gemini|openai|vendor|http\s*\d{3}|status\s*code/i,
  // 네트워크/타임아웃류 내부 코드
  /timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ECONNABORTED|ENOTFOUND/i,
  // DB/SQL 원문
  /mysql|SQLSTATE|ER_[A-Z_]+|SELECT .* FROM|syntax error/i,
  // JS 스택트레이스·소스 위치
  /\bat\s+\S+\s*\(.*:\d+:\d+\)/, // "at foo (/path/file.js:12:34)"
  /\.js:\d+/,
  /^(Error|TypeError|ReferenceError|SyntaxError):/,
  // Node 내부 프로퍼티 접근 에러 원문
  /Cannot read propert(y|ies) of/i,
  /undefined is not/i,
]

const MAX_SAFE_LENGTH = 200 // 이 프로젝트의 정상 사용자 안내문은 전부 이보다 짧다

/**
 * 서버 응답 메시지가 사용자에게 보여줘도 안전한지 판단해 반환한다.
 * 의심스러우면(패턴 매칭 또는 과도하게 긴 원문) fallback으로 대체한다.
 * 개발자가 원인을 진단할 수 있도록 원문은 항상 console.error에 남긴다.
 *
 * @param {unknown} err - axios 에러 객체 (err.response.data.message 형태 기대)
 * @param {string} fallback - 안전하지 않거나 메시지가 없을 때 보여줄 기본 문구
 * @param {string} [context] - 콘솔 로그 식별용 태그
 * @returns {string}
 */
export function getSafeErrorMessage(err, fallback, context = '') {
  const raw = err?.response?.data?.message

  if (!raw || typeof raw !== 'string') return fallback

  if (raw.length > MAX_SAFE_LENGTH) {
    console.error(`[safeErrorMessage${context ? ':' + context : ''}] 과도하게 긴 서버 메시지를 차단함:`, raw)
    return fallback
  }

  const matched = UNSAFE_PATTERNS.find((pattern) => pattern.test(raw))
  if (matched) {
    console.error(`[safeErrorMessage${context ? ':' + context : ''}] 안전하지 않은 서버 메시지를 차단함:`, raw)
    return fallback
  }

  return raw
}
