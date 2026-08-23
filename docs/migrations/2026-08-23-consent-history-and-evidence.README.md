# 2026-08-23 동의 검증 게이트 + 이력 보존 스키마 변경

> **`ondam_schema.sql`에 통합됨.** 신규 DB는 이 마이그레이션을 실행하지 말고
> `ondam_schema.sql`만 실행할 것. 이 파일은 로컬 개발 DB(`ondam`)에는 이미
> 직접 적용했다(완료 보고서 참고) - 다른 환경(운영 등)에 적용할 때만 이 파일을 쓴다.

출시 차단급 결함 수정 작업("동의 검증 게이트 실제 구현 + 동의 증빙 저장 보강") 중
발견한 스키마 문제 1건을 해소한다.

## 파일 목록

| 파일 | 내용 |
|---|---|
| `2026-08-23-consent-history-and-evidence.up.sql` | `user_consents`의 `UNIQUE(user_id, consent_type)` 제거 → append-only 전환 |
| `2026-08-23-consent-history-and-evidence.down.sql` | 위 UP의 롤백 (이력이 쌓인 뒤에는 안전하지 않음 - 파일 내 경고 참고) |
| `2026-08-23-consent-history-and-evidence.README.md` | 이 파일 |

## 왜 필요했나

`user_consents`는 `(user_id, consent_type)` UNIQUE 제약으로 "유형당 최신 1건만 유지"
하도록 설계돼 있었고, `authRepository.upsertConsent`가 `ON DUPLICATE KEY UPDATE`로
기존 행을 그 자리에서 덮어썼다. 이 방식의 문제:

1. **이력 소실** - 철회 → 재동의를 반복해도 "지금 상태"만 남고 "언제 무엇에
   동의/철회했는지"의 변천사가 사라진다. 동의는 이력 자체가 법적 증빙이다.
2. **FK 참조 붕괴** - `voice_samples.consent_id`가 업로드 시점의 `consent_id`를
   저장해 두는데, 사용자가 나중에 같은 유형으로 다시 동의/철회하면
   `upsertConsent`가 해당 행의 `consent_id`를 새 UUID로 바꿔버려
   `voice_samples.consent_id`가 더 이상 존재하지 않는 UUID를 가리키게 된다.

## 무엇을 바꿨나

- `UNIQUE(user_id, consent_type)` 제거. `consent_id`의 개별 `UNIQUE`(사실상 PK 역할)는
  유지.
- 이제 동의/철회/재동의는 각각 별도 행(append-only)으로 영구 보존된다.
- 최신 상태 조회는 `WHERE user_id=? AND consent_type=? ORDER BY agreed_at DESC,
  id DESC LIMIT 1`. 기존 인덱스 `idx_consents_user (user_id, consent_type,
  agreed_at DESC)`가 그대로 이 조회를 커버하므로 인덱스 추가는 필요 없었다.
  `id DESC`는 동일 초 내 여러 이력이 쌓였을 때 결정적 최신 판정을 위해 조회
  함수 쪽(코드)에 추가했다(스키마 자체 변경 아님).

## 동반 코드 변경 (같은 작업 범위)

- `authRepository.js`: `upsertConsent`(ON DUPLICATE KEY UPDATE) 제거.
- `authService.saveConsents`: `authRepository.createConsent`(append-only, IP·User-Agent
  기록)를 사용하도록 변경. 컨트롤러에서 ip/userAgent를 전달받는다(`register()`와
  동일 패턴).
- `willRepository.findVoiceConsent` 등 조회 함수: `ORDER BY agreed_at DESC` 뒤에
  `, id DESC` 추가.

## 적용 방법 (운영 등 이 DB가 아닌 환경)

1. **DB 전체 백업** (mysqldump 등) - 백업 없이 절대 진행하지 말 것
2. `2026-08-23-consent-history-and-evidence.up.sql` 적용
3. 애플리케이션 코드 배포(위 "동반 코드 변경" 반영본)
4. `SELECT COUNT(*) FROM user_consents;`로 행 손실이 없는지 확인 (마이그레이션
   전후 카운트가 같아야 한다 - 이 변경은 제약 완화만 수행하고 어떤 행도 삭제하지
   않는다)

## 로컬 개발 DB 적용 이력

2026-08-23, 이 작업(동의 검증 게이트 구현) 진행 중 `ondam` 로컬 DB에 위 UP을
직접 실행했다. 적용 전 `user_consents` 63행, 적용 후에도 63행(무손실 확인).
