// [DESIGN-PREVIEW] MSW mock handler - memorial 도메인, 실제 백엔드 없이 로컬 디자인 검토용
//
// 계약 근거:
// - GET /api/memorial/:slug?accessCode=... 응답 포맷: { success, data: { pet, media } }
//   (src/pages/memorial/memorialApi.js, src/pages/memorial/useMemorial.js)
// - useMemorial.js가 실제로 읽는 필드: data.data.pet, data.data.media (없으면 [])
// - MemorialPage.jsx가 실제로 참조하는 pet 필드: name, breed, birthDate, deathDate,
//   profileImageUrl (PawPrint 아이콘 대체 UI 있음 - profileImageUrl은 null이어도 무방)
// - MemorialPage.jsx가 실제로 참조하는 media 필드: mediaId, url, caption
// - 접근 코드 검증 흐름(FIX: DEV-30, apiClient.js PUBLIC_UNAUTH_PATH_PATTERNS 주변 설명 참고):
//   accessCode 쿼리 없음 -> 404(비공개), accessCode 있지만 틀림 -> 403,
//   accessCode === 'ONDAM2024' -> 200 성공. 디자인 검토 시 이 흐름으로
//   "코드 입력 폼 -> 오류 -> 정상 조회"를 모두 확인할 수 있다.
import { http, HttpResponse } from 'msw'

const VALID_ACCESS_CODE = 'ONDAM2024'

const DUMMY_PET = {
  petId: 'design-preview-pet-0001',
  name: '초코',
  breed: '말티즈',
  birthDate: '2012-05-14',
  deathDate: '2024-11-02',
  profileImageUrl: 'https://picsum.photos/seed/ondam-memorial-1/800/600',
}

const DUMMY_MEDIA = [
  {
    mediaId: 'design-preview-media-0001',
    url: 'https://picsum.photos/seed/ondam-memorial-2/800/600',
    caption: '처음 우리 집에 온 날',
  },
  {
    mediaId: 'design-preview-media-0002',
    url: 'https://picsum.photos/seed/ondam-memorial-3/800/600',
    caption: '봄 소풍 갔던 날',
  },
  {
    mediaId: 'design-preview-media-0003',
    url: 'https://picsum.photos/seed/ondam-memorial-4/800/600',
    caption: '첫 생일 파티',
  },
  {
    mediaId: 'design-preview-media-0004',
    url: 'https://picsum.photos/seed/ondam-memorial-5/800/600',
    caption: '햇살 아래 낮잠',
  },
  {
    mediaId: 'design-preview-media-0005',
    url: 'https://picsum.photos/seed/ondam-memorial-6/800/600',
    caption: '마지막 여름 바닷가에서',
  },
]

export const handlers = [
  // 추모관 조회 - 접근 코드 검증 흐름 포함
  http.get('/api/memorial/:slug', ({ request }) => {
    const url = new URL(request.url)
    const accessCode = url.searchParams.get('accessCode')

    // FIX: DEV-30 - 접근 코드 없이 열람 시 비공개(404)
    if (!accessCode) {
      return HttpResponse.json(
        { success: false, message: '비공개 추모관입니다. 접근 코드가 필요합니다.' },
        { status: 404 },
      )
    }

    // FIX: DEV-30 - 접근 코드가 틀리면 403
    if (accessCode !== VALID_ACCESS_CODE) {
      return HttpResponse.json(
        { success: false, message: '접근 코드가 올바르지 않습니다.' },
        { status: 403 },
      )
    }

    return HttpResponse.json({
      success: true,
      data: {
        pet: DUMMY_PET,
        media: DUMMY_MEDIA,
      },
    })
  }),
]
