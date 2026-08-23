/**
 * 내부 에러 원문 → 사용자 노출용 안전 문구 매핑 (보안 갭 2 수정)
 *
 * 워커(photoWorker/videoWorker/voiceWorker)는 실패 시 `err.message`를 그대로
 * `ai_jobs.error_message`·`photo_orders.fail_reason` 등 DB 컬럼에 저장한다 -
 * 이건 의도된 동작이다(운영자가 원인을 진단하려면 원문이 필요하다, admin 도메인은
 * 이 원문을 그대로 조회한다). 문제는 이 컬럼이 **소유자 본인에게도 API 응답으로
 * 그대로 나간다는 점**이다 - 응답 핸들러 레벨에서 500 원문 노출은 막아뒀지만
 * (G9-5), DB에 저장된 원문 에러 메시지가 정상 200 응답의 필드값으로 그대로
 * 실려 나가면서 우회된다. 실측 사례: "GEMINI_API_KEY 환경변수가 설정되지
 * 않았습니다"가 photo_orders.fail_reason을 통해 그대로 노출됨.
 *
 * 이 함수는 **DB 저장을 바꾸지 않는다** - 저장은 계속 원문으로 하고(운영 진단
 * 목적 유지), 서비스 레이어가 소유자에게 응답을 만드는 시점에만 이 함수를 거쳐
 * 안전한 한국어 문구로 치환한다(스키마 변경 없이 응답 시점 매핑 방식 채택,
 * 5060 대상 서비스라 쉬운 말로 작성).
 *
 * 패턴은 원문에 어떤 종류의 내부 정보가 실려있는지로 대략 분류한다 - 완벽한
 * 분류가 목적이 아니라 "내부 구조를 절대 노출하지 않는" 것이 목적이므로,
 * 매칭되지 않는 나머지는 전부 안전한 기본 문구로 떨어진다(허용목록이 아니라
 * 차단목록 방식이라 새로운 에러 문구가 추가돼도 기본적으로 안전하다).
 */

const PATTERNS = [
  // 환경변수·API 키 미설정/인증 실패 - "GEMINI_API_KEY 환경변수가 설정되지
  // 않았습니다", "ELEVENLABS_API_KEY 환경변수가 설정되지 않았습니다",
  // "KMS_KEY_ID 환경변수가 설정되지 않았습니다", "○○ 립싱크 벤더의 API 키가
  // 설정되지 않았습니다" 등 - 환경변수명·벤더명 등 내부 인프라 구조가 그대로 드러난다.
  {
    test: /환경변수|API[_ ]?KEY|api key|인증.*실패|credential/i,
    message: '지금은 처리가 어려워요. 잠시 후 다시 시도해 주세요. 계속 안 되면 고객센터로 문의해 주세요.',
  },
  // 외부 벤더(ElevenLabs/Sync.so/MuseTalk/D-ID/토스 등) 응답 원문 그대로 노출 -
  // "ElevenLabs TTS 오류 (429): {...}" 처럼 HTTP 상태코드·벤더 응답 바디까지 실린다.
  {
    test: /elevenlabs|sync\.?so|musetalk|d-id|벤더|vendor|http\s*\d{3}|status\s*code/i,
    message: '연결이 원활하지 않아 처리에 실패했어요. 잠시 후 다시 시도해 주세요.',
  },
  // 네트워크/타임아웃류
  {
    test: /timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|network/i,
    message: '일시적인 통신 오류로 처리에 실패했어요. 다시 시도해 주세요.',
  },
  // 요청 과다/속도 제한
  {
    test: /rate limit|429|quota|too many/i,
    message: '지금은 요청이 많아 처리에 실패했어요. 잠시 후 다시 시도해 주세요.',
  },
]

const DEFAULT_MESSAGE = '처리 중 문제가 발생했어요. 다시 시도해 주세요. 계속 실패하면 고객센터로 문의해 주세요.'

/**
 * @param {string|null|undefined} rawMessage - DB에 저장된 내부 에러 원문
 * @returns {string|null} 사용자에게 보여줘도 안전한 한국어 문구 (원문이 없으면 null)
 */
export const toSafeFailureMessage = (rawMessage) => {
  if (!rawMessage) return null
  const matched = PATTERNS.find((p) => p.test.test(rawMessage))
  return matched ? matched.message : DEFAULT_MESSAGE
}
