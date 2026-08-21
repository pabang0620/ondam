# 온담 문서 지도 & 현황 (Planning Index)

> 온담의 모든 기획·전략·세부기획·감사·가이드 문서의 진입점이자 현행 상태판이다. 최종 갱신: 2026-08-21.
> 문서가 많아졌으므로, 무엇을 먼저 읽고 무엇이 확정/대기인지 여기서 파악한 뒤 개별 문서로 들어간다.

## 1. 문서 지도

```
docs/
├── PRD.md                         원본 기획 (v1.0, 2026-04) - 기능 목록·라우트·DB 스키마
├── PLANNING-INDEX.md              (이 문서) 지도 + 현황
│
├── strategy/                      사업 전략 (분석·의사결정)
│   ├── 00-README                  전략 문서 색인 + 결정 현황
│   ├── 01-market-research         시장 데이터·경쟁사 실측(수치+출처)
│   ├── 02-business-strategy       포지셔닝 3대 결정·하지 않을 것
│   ├── 03-product-pricing         상품 구조·가격·결제 동선·UX 원칙
│   ├── 04-gtm-plan                채널·퍼널·KPI·검증 가설
│   ├── 05-execution-phases        로드맵 (Phase 0 결함개선 신설됨)
│   ├── 06-dev-backlog             개발 태스크 SSOT (DEV-01~29)
│   ├── 07-risk-legal              리스크·법률 체크리스트·윤리 원칙
│   ├── 08-lipsync-vendor          립싱크 벤더 실사 (D-ID 확정)
│   ├── 09-unit-economics          원가·마진 모델·티어 판단 근거
│   ├── 10-personas-and-journey    페르소나 4종·고객 여정
│   └── 11-brand-messaging         네이밍·톤·카피 규칙 (SSOT)
│
├── specs/                         세부 기획 (기능 단위 상세)
│   ├── SPEC-00-README             지위·PRD 대비 변경표·변경 통제 원칙
│   ├── SPEC-01-gift-flow          선물하기(자녀 결제→부모 수행)
│   ├── SPEC-02-refund-failure     환불·취소·AI 실패 처리
│   ├── SPEC-03-memorial-access    추모관 접근 모델(이원화)
│   ├── SPEC-04-notification       알림 매트릭스
│   ├── SPEC-05-letter-delivery    영상 편지 열람·전달·보관
│   ├── SPEC-06-admin-console      관리자 권한·운영 화면
│   ├── SPEC-07-identity-consent   본인확인·동의·탈퇴
│   └── SPEC-08-photo-product      사진관 상품 구성
│
├── review/                        코드 감사 (2026-08-21)
│   ├── 2026-08-21-full-audit      5개 에이전트 종합 리포트
│   └── remediation-plan           DEV-22~29 실행 플랜
│
├── guidelines/
│   └── DEVELOPMENT_GUIDELINES     재발 방지 규약 G1~G9
│
├── migrations/
│   └── 2026-08-21-schema-drift-fix.{up,down}.sql + README
│
└── handoff/
    └── README                     코딩 AI 인계 프롬프트
```

## 2. 우선순위: 지금 무엇을 하나

1. **[개발] Phase 0 결함 개선** - `review/remediation-plan.md`의 DEV-22~29. 현재 코드는 가입·결제가 실제로 안 됨. 출시 전 필수. (코딩은 다른 모델)
2. **[오너 결정] 승인 대기 3건** - 아래 4절. 특히 추모관 접근모델은 방금 추가한 컬럼 정책과 직결.
3. **[오너 실행] 스키마 마이그레이션** - `migrations/...README.md` 보고 백업 후 직접 적용.
4. **[개발] 기능 로드맵** - Phase 0 통과 후 Phase 1~4 (05 문서).

## 3. 확정된 것 (분석·판정 근거 있음)

| 항목 | 근거 |
|---|---|
| 명칭 "마지막 영상 편지"(구 유언장) | 법적 오인 방지, lee-wonho ADOPT |
| 포지셔닝: 생전 본인 기록 / 4050 자녀 결제 / 사진관 쐐기→영상편지 코어 | 02 문서, 시장 실측 |
| 립싱크 벤더 D-ID 1차 확정 | 08 문서 실사(이미지 지원·원가 1/3) |
| 단건 결제 코어 + 구독은 펫에 한정 | HereAfter 실패 실증 |
| 개발 규약 G1~G9 | 감사 결과 |

## 4. 오너 결정 대기 (지금 정하면 좋음)

| # | 항목 | 권장안 | 정하면 풀리는 것 |
|---|---|---|---|
| 1 | 보관 구독(월 1,900원) 폐지 | 폐지(단건가 내재화) | DEV-17, 수익모델 확정 |
| 2 | 영상 편지 가격 티어 | 베이직 49,000원 단일가로 출시 → 데이터 후 티어 확대 | DEV-11 가격, 09 문서 |
| 3 | 추모관 접근 모델 | 사람=비공개 접근코드 / 펫=공개 선택 | DEV-16, memorial 보안 정책 |

> 3건 모두 lee-wonho가 ESCALATE(오너 결정)로 판정. 근거는 각 SPEC/strategy 문서.

## 5. 문서 관리 규칙

- **카피·명칭**은 `strategy/11-brand-messaging`이 SSOT. 다른 문서와 어긋나면 11을 따른다.
- **개발 태스크**는 `strategy/06-dev-backlog`이 SSOT (DEV 번호).
- **기능 동작 정책**은 해당 `specs/SPEC-*`가 SSOT. PRD와 충돌 시 SPEC 우선.
- 결정이 바뀌면 해당 SSOT 문서부터 고치고, 이 인덱스의 3·4절 상태를 갱신한다.
- 충돌은 숨기지 말고 표면화한다(SPEC-00 통제 원칙).
