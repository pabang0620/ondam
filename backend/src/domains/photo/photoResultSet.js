// AI 사진관 "세트" 결과물 정의 (2026-08-22 결정1)
//
// 결정: 9,900원 주문 1건은 "용도"(장례/증명/취업) 선택 1회로 결과물 4종 세트를
// 받는다. 사용자가 처리 옵션을 개별 선택하지 않는다 (SPEC-08 1절).
//
// photo_files.kind ENUM('raw','enhanced')은 값이 2개뿐이라(ondam_schema.sql 확인
// 결과) 세트 내 4종을 구분할 컬럼이 없다. 스키마 변경은 금지되어 있으므로, kind는
// 전부 'enhanced'로 저장하고 s3_key 파일명 접미사(`result_<variant>.jpg`)로 세트
// 항목을 구분한다. 이 파일이 접미사 <-> 사람이 읽는 라벨의 SSOT다.
// photoWorker.js(생성)와 photoService.js(조회 응답 라벨링) 양쪽 모두 반드시 이
// 파일을 거쳐서만 variant key/label을 다룬다 (드리프트 방지, G1 정신 준용).
//
// [실측 판단 근거] 4종 조합을 "의미 있게" 고른 이유:
// - restore_auto / restore_only 2개를 함께 주는 이유: 사진이 흑백인지 컬러인지
//   서버에서 사전 판별하지 않으므로(추가 CV 라이브러리 도입은 스코프 밖), 자동
//   컬러화 프롬프트가 컬러 원본에 대해 "이미 컬러면 색은 유지"를 명시해 무의미한
//   중복 컬러화를 피하되, 그 판단이 어색하게 나올 가능성에 대비해 색감을 절대
//   바꾸지 않는 안전판을 별도로 둔다 (SPEC-08 24행 "재처리 요청을 줄이는 장치").
// - id_crop: 복원과 무관하게 "규격 문서 사진"이라는 별개 용도이므로 복원 세트와
//   섞지 않고 독립 변형으로 분리.
// - suit: 유일한 사용자 선택값인 "용도"(funeral/id/job)에 따라 프롬프트가 달라지는
//   항목 - 이미 각 용도별로 다른 정장/배경 스타일을 지정하고 있어 세트 내에서
//   가장 "용도 특화"된 결과물.
// 컬러 원본에 "컬러화"만 단독으로 넣는 조합(무의미)은 채택하지 않았다.

export const SET_PHOTO_TYPES = ['funeral', 'id', 'job']

const SUIT_PROMPTS = {
  funeral: '이 사람의 얼굴을 유지하면서 깔끔한 검은 정장 착용 영정사진 스타일로 편집해 주세요. 배경은 흰색으로, 정면 상반신 구도.',
  id: '이 사람의 얼굴을 유지하면서 밝은 배경의 증명사진 스타일로 편집해 주세요. 정장 착용, 단색 배경.',
  job: '이 사람의 얼굴을 유지하면서 취업 프로필 사진 스타일로 편집해 주세요. 비즈니스 캐주얼, 깔끔한 배경.',
}

const VARIANT_DEFS = [
  {
    key: 'restore_auto',
    label: '복원본 (자동 컬러화)',
    prompt:
      '이 손상되거나 오래된 사진을 복원해 주세요. 스크래치·먼지 제거, 색바램 복원, ' +
      '화질 개선, 노이즈 제거. 사진이 흑백이면 자연스러운 색상으로 컬러화하고, ' +
      '이미 컬러 사진이면 색상은 그대로 두고 화질만 개선하세요.',
  },
  {
    key: 'restore_only',
    label: '원본 색감 유지본',
    prompt:
      '이 손상되거나 오래된 사진을 복원해 주세요. 스크래치·먼지 제거, 화질 개선, ' +
      '노이즈 제거. 색상은 절대 바꾸지 말고 원본 색감(흑백이면 흑백 그대로, 컬러면 ' +
      '컬러 그대로)을 유지하세요.',
  },
  {
    key: 'id_crop',
    label: '증명·영정 규격본',
    prompt:
      '이 사람의 얼굴을 유지하면서 배경을 깔끔한 흰색 단색으로 정리하고, ' +
      '증명사진/영정사진 규격(3:4 비율, 인물을 중앙에 상반신으로 배치)에 맞게 편집해 주세요.',
  },
  {
    key: 'suit',
    label: '정장 합성본',
    promptByType: SUIT_PROMPTS,
  },
]

const VARIANT_META_BY_KEY = VARIANT_DEFS.reduce((acc, def, idx) => {
  acc[def.key] = { label: def.label, order: idx + 1 }
  return acc
}, {})

/**
 * 용도(funeral/id/job) 주문 1건에 대해 생성할 결과물 4종 정의를 반환한다.
 * 용도 주문이 아니면(레거시 단일 처리 타입) null.
 */
export const buildResultSet = (photoType) => {
  if (!SET_PHOTO_TYPES.includes(photoType)) return null
  return VARIANT_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    prompt: def.promptByType ? def.promptByType[photoType] : def.prompt,
  }))
}

const VARIANT_KEY_PATTERN = /result_([a-z0-9_]+)\.[a-z0-9]+$/i

export const parseVariantKey = (s3Key) => {
  if (!s3Key) return null
  const match = s3Key.match(VARIANT_KEY_PATTERN)
  return match ? match[1] : null
}

/**
 * photo_files.s3_key로부터 세트 항목의 라벨/정렬순서를 복원한다.
 * 세트 주문이 아니거나(레거시) 패턴이 없으면 null.
 */
export const getVariantMeta = (s3Key) => {
  const key = parseVariantKey(s3Key)
  if (!key) return null
  const meta = VARIANT_META_BY_KEY[key]
  return meta ? { key, ...meta } : null
}
