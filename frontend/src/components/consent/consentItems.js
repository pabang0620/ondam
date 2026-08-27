// 리멤버미 전역 동의 항목 정의 - 화면마다 같은 동의를 다르게 표현하면 그 자체가
// 법적 다툼의 소지가 되므로(추모 서비스 특성상 어르신 이용자도 많다) 여기
// 한 곳에서만 관리하고, 각 화면은 이 배열을 그대로 가져다 쓴다.
//
// key/type 값은 반드시 ondam_schema.sql의 user_consents.consent_type ENUM과
// 일치해야 한다: privacy, portrait, voice, ai_generation, posthumous_release,
// terms, marketing

// AI 유언 영상(will) 제작 동의 - WillConsentPage(일반 경로)·GiftPerformWillPage
// (선물 수행 경로) 공통으로 사용한다. 문구는 기존 useWillConsent.js 원문을 그대로
// 옮긴 것으로 새로 창작하지 않았다.
export const WILL_CONSENT_ITEMS = [
  {
    key: 'portrait',
    label: '초상권 동의 (필수)',
    desc: '본인의 얼굴 사진이 AI 영상 생성에 활용되는 것에 동의합니다.',
  },
  {
    key: 'voice',
    label: '음성권 동의 (필수)',
    desc: '본인의 음성이 AI 음성 복제에 활용되는 것에 동의합니다.',
  },
  {
    key: 'ai_generation',
    label: 'AI 생성물 동의 (필수)',
    desc: 'AI가 생성한 영상이 리멤버미 서비스 내에 보관되는 것에 동의합니다.',
  },
  {
    key: 'posthumous_release',
    label: '사후 공개 동의 (필수)',
    desc: '본인 사망 확인 후 지정한 유가족에게 영상이 공개되는 것에 동의합니다.',
  },
]

// AI 사진관(photo) 처리 동의 - PhotoOrderPage(일반 경로)·GiftPerformPhotoPage
// (선물 수행 경로) 공통. 영정/증명/취업 사진 모두 업로드된 얼굴 사진을 AI로
// 합성·보정하고 그 결과물을 계정에 보관하므로 WILL_CONSENT_ITEMS와 같은 이유로
// portrait·ai_generation 동의가 필요하다.
// [신규 문구] 기존 화면에 사진관용 동의 문구가 없어 WILL_CONSENT_ITEMS의 "영상"을
// "사진"으로 바꾼 것 외에는 동일한 구조로 새로 작성했다 - 작업 보고에 근거 명시.
export const PHOTO_CONSENT_ITEMS = [
  {
    key: 'portrait',
    label: '초상권 동의 (필수)',
    desc: '업로드한 사진 속 얼굴이 AI 사진 보정·합성에 활용되는 것에 동의합니다.',
  },
  {
    key: 'ai_generation',
    label: 'AI 생성물 동의 (필수)',
    desc: 'AI가 생성한 사진이 리멤버미 서비스 내에 보관되는 것에 동의합니다.',
  },
]

// 회원가입(useJoin.js)·선물 수행 계정 연결(GiftPerformPage.jsx) 공통 - 결정3
// (2026-08-22) 법무 검토로 terms가 필수 동의로 바뀐 배경은 원래 useJoin.js 주석 참조.
// "type" 필드명은 /api/auth/register, /api/gifts/perform/:token/account 두 엔드포인트가
// 공통으로 쓰는 consentItemSchema({ type, isAgreed })와 맞춘 것이다(주의: 로그인 후
// 추가 동의를 저장하는 /api/auth/consents만 필드명이 consentType으로 다르다).
export const SIGNUP_CONSENT_ITEMS = [
  { type: 'terms', label: '이용약관 동의 (필수)', required: true },
  { type: 'privacy', label: '개인정보 수집 및 이용 동의 (필수)', required: true },
  { type: 'marketing', label: '마케팅 정보 수신 동의 (선택)', required: false },
]
