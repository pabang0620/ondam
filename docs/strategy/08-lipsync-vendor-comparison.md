# 08. 립싱크 벤더 비교 (공식 문서 실사, 2026-08-21)

> DEV-01의 사전 조사 결과. 공식 docs·가격 페이지 직접 크롤링 기반이며, 최종 확정은 실제 API 키 발급 후 한국어 오디오 스모크 테스트(DEV-01 본작업)로 한다.

## 결론: 1차 검증 벤더 = **D-ID (Talks API)**

| 기준 | D-ID | Sync.so | MuseTalk (fal.ai/Replicate) |
|---|---|---|---|
| 정지 이미지 입력 | **네이티브 지원** (`source_url`에 jpg/png URL) | sync-3 모델만 지원 | 원본 코드는 지원하나 fal.ai 래퍼는 `source_video_url`만 노출 - 불투명 |
| 1분 영상 원가 | **약 $0.7~0.9** (Scale 플랜 기준, 15초 단위 반올림 과금) | $2.4~3.0 (초당 $0.04~0.05) | 실행당 ~$0.19(Replicate, 산식 미공개) / 자체호스팅은 GPU 비용 |
| 한국어 | 오디오 직접 입력 방식이라 구조적으로 언어 무관 추정 (명시 문구는 미확인) | "95+ languages"만, 미확인 | README에 中·英·日만 명시 - **부정 신호** |
| 문서 명확성 | 엔드포인트·상태값·결과 필드 전부 공식 문서화 | 상태값 확인됨, 폴링 GET 경로 미확인 | 전용 상태값 문서 없음 |
| 처리 시간 | 미확인 | 미확인 | Replicate 예측 약 4분 |

## D-ID 실스펙 (어댑터 교정용 확정 정보)

- Base: `https://api.d-id.com`
- **인증: Basic 인증** - `Authorization: Basic base64(API_USERNAME:API_PASSWORD)`. Bearer 아님 (기존 추정 구현과 다를 가능성 높은 핵심 교정점). 키는 D-ID Studio > Account Settings에서 1회만 노출
- 생성: `POST /talks` - `source_url`(이미지 URL, jpg/jpeg/png. **URL 방식만, 파일 업로드 미지원** → S3 presigned URL 필요), `script: {type: "audio", audio_url}` (mp3/wav/m4a/flac/mp4, 15MB, talk 최대 10분)
- 조회: `GET /talks/{id}` - 상태값 `created / started / done / error / rejected`, 결과 필드 `result_url`(S3 URI, 만료 있음 → 즉시 온담 S3로 복사 필요)
- 웹훅: `webhook` 필드 지원 (폴링 대신 권장)
- 가격: Build $14.4/월(오프라인 16분) ~ Scale $138.6/월(200분). Trial 14일(3분)로 스모크 테스트 가능

## 타 벤더 확인 정보 (예비 벤더 유지용, 어댑터 교정 참고)

- **Sync.so**: `https://api.sync.so/v2`, 헤더 `x-api-key`. `POST /generate`, model은 이미지 입력 시 `sync-3` 고정. 상태값 `PENDING/PROCESSING/COMPLETED/FAILED/REJECTED`, 결과 `outputUrl`. `webhookUrl` 지원. 무료: sync-3 월 1회·15초
- **MuseTalk**: 리포 소유는 TMElyralab (TencentARC 아님 - 기존 문서 오기 주의). 자체호스팅 MIT·상용 가능하나 GPU 인프라 필요, 실서비스 검증 단계 부적합 판정. fal.ai/Replicate 래퍼는 이미지 입력·단가 미확정

## 원가 시사점 (DEV-02 선반영)

- D-ID 기준 1분 영상 립싱크 원가 약 $0.7~0.9 (약 1,000~1,300원). ElevenLabs 음성 클론·TTS와 S3 비용을 더해도 베이직 49,000원의 원가율은 낮을 것으로 추정 → 티어 설계(승인 대기 3번)의 마진 우려는 크지 않음. 정확한 수치는 DEV-02에서 실측
- Sync.so를 쓰면 원가가 3배 이상 → 예비 벤더로만 유지

## 남은 미확인 (DEV-01 본작업에서 확정할 것)

1. 한국어 오디오 실동작·품질 (3사 모두 문서 미명시 → 실호출 스모크 테스트 필수)
2. D-ID 크레딧→초 정확한 환산 (FAQ "15초 반올림" 역산치임)
3. Sync.so 폴링 GET 경로, MuseTalk 래퍼 이미지 입력 여부 (예비 벤더 필요 시)
