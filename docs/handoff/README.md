# 코딩 AI 인계 프롬프트 (복사해서 그대로 사용)

> 착수 가능 태스크의 인계 프롬프트다. 각 블록을 통째로 코딩 AI(Codex 등)에 붙여넣으면 된다.
> ~~승인 대기 항목~~ **2026-08-21 오너 확정 완료**: 보관구독 폐지·가격(베이직 단일가 선출시)·추모관 이원화 3건 모두 채택. DEV-11(가격)·DEV-16(추모관)·DEV-17(구독폐지)의 승인 게이트가 풀렸다. 단 실행 우선순위는 Phase 0 결함개선(DEV-22~29)이 먼저다.
>
> **2026-08-21 전체 감사 이후 우선순위 변경**: 배포 차단 결함(BLOCKER 6·HIGH 8)이 발견됐다.
> 신규 기능(DEV-01·05 등)보다 **결함 개선(DEV-22~29)이 먼저**다. 실행 순서·태스크별 상세는
> **`docs/review/remediation-plan.md`**, 재발 방지 규약은 **`docs/guidelines/DEVELOPMENT_GUIDELINES.md`**.
> 각 코딩 태스크에 그 2개 문서를 함께 준다.
>
> - DEV-03(스키마 중복 정리)은 **DEV-22에 흡수됨** (아래 DEV-03 블록은 참고용으로만 남김).
> - DEV-22 마이그레이션 파일은 `docs/migrations/2026-08-21-schema-drift-fix.*`로 이미 생성됨. **실행은 사용자가 백업 후 직접.**

---

## DEV-03: DB 스키마 중복 정리 (가장 작은 건, 먼저 던지기 좋음)

```
작업 디렉토리: /home/lee/project/ondam

[작업] ondam_schema.sql에 subscription_payment_logs 테이블의 CREATE TABLE 정의가
두 곳(약 601행, 914행)에 중복되어 있다. 두 정의를 비교해 정본 1개만 남겨라.

절차:
1. grep -n "CREATE TABLE" ondam_schema.sql 로 중복 위치 확인
2. 두 정의의 컬럼·인덱스 차이를 diff로 비교
3. 차이가 있으면: backend/src/domains/subscription/ 하위 Repository 코드가 실제로
   사용하는 컬럼명을 기준으로 정본 선택 (코드가 진실)
4. 중복 제거 후 스키마 파일 전체를 새 임시 DB에 적용해 에러 없는지 검증
   (mysql로 새 스키마 적용 테스트만. 기존 운영/개발 DB에 ALTER·DROP 절대 금지)

수용 기준:
- grep -c "CREATE TABLE.*subscription_payment_logs" ondam_schema.sql == 1
- 스키마 전체 신규 적용 시 에러 0
- 제거한 쪽과 남긴 쪽의 차이를 커밋 메시지 본문에 기록

금지: 다른 테이블 정의 수정, 스키마 파일 재정렬·재포맷, 운영 DB 접속
```

---

## DEV-05: "유언장" → "마지막 영상 편지" 명칭 전환 (2026-08-21 확정된 결정)

```
작업 디렉토리: /home/lee/project/ondam
사전 필독: .claude/CLAUDE.md (프로젝트 컨벤션)

[배경] "AI 디지털 유언장"은 민법상 유언 효력이 없어 명칭 오인 리스크가 있다.
서비스명을 "마지막 영상 편지"로 변경하기로 확정됐다.

[작업] 사용자에게 노출되는 문자열만 전면 교체한다.
1. frontend/src 전체에서 "유언장"·"디지털 유언장" 노출 문구를 "마지막 영상 편지"
   (문맥상 짧게는 "영상 편지")로 교체: 페이지 타이틀, 버튼, 안내문, 폼 라벨,
   메타 태그, 알림 메시지 문자열
2. backend에서 사용자에게 전달되는 message 문자열(응답 message, 알림 본문)도 교체
3. 구매 플로우 첫 화면과 랜딩 소개 영역에 고지 1줄 추가:
   "이 영상은 마음을 전하는 기록으로, 민법상 유언의 법적 효력은 없습니다."

[절대 금지 - 표시 문자열 외 변경 금지]
- DB 테이블명(wills, will_beneficiaries 등), 컬럼명 변경 금지
- API 경로(/api/will 등), 라우트 경로(/will 등) 변경 금지
- 코드 심볼(변수·함수·파일명 willService 등) 변경 금지
- CSS 클래스명 변경 금지

수용 기준:
- 프론트 렌더링 문자열 grep에서 "유언장" 0건 (위 고지문 내 "유언의" 제외)
- 빌드 성공 + 주요 화면(랜딩, /will 진입, 구매 플로우) 렌더 확인
```

---

## DEV-01: 립싱크 벤더 실검증 (D-ID 우선, 사전 조사 완료됨)

```
작업 디렉토리: /home/lee/project/ondam
사전 필독: docs/strategy/08-lipsync-vendor-comparison.md (공식 스펙 실사 결과),
          .claude/CLAUDE.md, backend/src/services/lipsync/ 현재 코드

[배경] lipsync 어댑터 3종(syncSo.js, museTalk.js, did.js)이 추정 스펙으로 구현돼
있다. 공식 문서 실사 결과 1차 검증 벤더는 D-ID로 정해졌다. 실사에서 확인된
실스펙은 08 문서에 있다 - 그 문서가 정본이며 추측으로 구현하지 않는다.

[작업 1] did.js 어댑터를 실스펙으로 교정:
- 인증: Basic 인증 (Authorization: Basic base64(username:password)). Bearer로
  구현돼 있으면 반드시 교체. 자격증명은 .env (D_ID_API_KEY 형태, 커밋 금지)
- POST /talks: source_url(이미지 presigned URL) + script {type:"audio", audio_url}
- GET /talks/{id} 폴링: 상태값 created/started/done/error/rejected, 결과 result_url
- result_url은 만료되는 외부 S3 URI이므로 즉시 온담 S3로 복사 저장
- 어댑터 공통 인터페이스(다른 어댑터와의 시그니처)는 유지

[작업 2] syncSo.js도 08 문서에 확인된 범위(base URL v2, x-api-key, POST /generate,
model sync-3, 상태값 대문자 5종, outputUrl)로 교정. 미확인 부분(폴링 GET 경로)은
TODO 주석으로 명시 유지 - 추측 구현 금지.

[작업 3] E2E 스모크 테스트 (D-ID Trial 14일 무료로 가능):
- 테스트 이미지 1장 + 한국어 음성 샘플(wav)로 D-ID 직접 호출 → 영상 수신 확인
- videoWorker(BullMQ) 경유 전체 파이프라인으로도 1건: TTS/음성 → 립싱크 → S3 저장
  → ai_jobs 상태 completed 기록
- 한국어 오디오 립싱크 품질을 결과 영상으로 확인 (입모양 동기화 여부 주관 평가 기록)

수용 기준:
- 실제 D-ID API로 생성된 영상이 온담 S3에 저장되고 ai_jobs가 정상 완료 기록
- 한국어 스모크 테스트 결과(품질 평가·처리 시간·과금 크레딧)를
  docs/strategy/08-lipsync-vendor-comparison.md 하단에 "실측 결과" 절로 추기
- .env.example에 필요한 키 항목 추가 (실제 키 커밋 금지)

주의: D-ID 계정·API 키 발급은 사람이 해야 할 수 있다 - 키가 없으면 키 발급이
필요하다고 보고하고 멈출 것 (임의로 다른 벤더 무료 티어로 대체하지 말 것)
```

---

## 인계 시 공통 지침

- 태스크당 커밋 분리. 커밋 메시지는 `<type>: <설명>` 형식, attribution 라인 없음
- 완료 후 `docs/strategy/06-dev-backlog.md`의 해당 태스크 상태를 `DONE(해시)`로 갱신
- 작업 중 기존 기획(PRD·strategy·specs)과 다른 판단에 도달하면 임의 변경하지 말고 충돌 지점을 보고 (SPEC-00 통제 원칙)
