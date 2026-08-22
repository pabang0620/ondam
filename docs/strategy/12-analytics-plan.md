# 12. 계측(Analytics) 설계: 이벤트 사전·KPI 산출식·가설 검증

> 배경: [04-gtm-plan.md](04-gtm-plan.md) 4절이 KPI 8종과 검증 가설 4개를 "지표로 판정한다"고 선언했으나, 무엇을 어떻게 재는지가 어디에도 없었다. 코드에도 분석 도구가 0건이다(2026-08-22 실측: `frontend/`·`backend/` 전체에서 GA4·Amplitude·Mixpanel·PostHog·Sentry 관련 의존성 및 호출 0건). 이 상태로는 Phase 2 종료 게이트를 물리적으로 판정할 수 없다.
> 이 문서가 채우는 공백: ① 이벤트 사전 ② KPI 분자·분모 정의 ③ 가설별 판정 규칙 ④ [SPEC-06](../specs/SPEC-06-admin-console.md) 대시보드 KPI 위젯의 데이터 출처.
> 도구는 **확정하지 않는다.** 선정 기준과 후보 비교까지만 제시하고 결정은 오너에게 남긴다(6절).

---

## 1. 측정 원칙

### 1-1. 개인정보 최소 수집 (강제)

온담은 사망·건강·음성이라는 고민감 맥락을 다룬다. 계측 사고 1건의 신뢰 비용이 지표의 효용보다 크다.

**이벤트 페이로드에 절대 싣지 않는 것**

| 금지 대상 | 이유 |
|---|---|
| 음성 파일·영상 파일·이미지 바이너리 및 그 URL(presigned 포함) | 유출 시 원본 접근 가능. KMS 암호화의 의미가 사라짐 |
| 사망증명서 관련 일체(파일·S3 key·열람 여부 외 상세) | `will_release_requests.death_cert_s3_key`는 KMS 대상 |
| 유언 텍스트(`wills.content_text`), 유언 제목 | 내용 자체가 민감정보 |
| 고인 성명·생년, 수신인 성명·연락처(`will_beneficiaries.name/email/phone`) | 제3자 정보. 본인 동의 범위 밖 |
| 이메일·휴대폰 원문, 카카오 ID, 빌링키, 카드정보, 토스 결제키 | 식별자 원문 반출 금지 |
| 서명 토큰(`perform_token`, `/watch/:token`) | URL 파라미터 그대로 전송하면 계측 도구가 토큰 보관소가 된다 |

**대신 싣는 것**: 외부 노출용 UUID(`user_id`, `order_id`, `will_id`, `gift uuid`), 범주형 값(ENUM), 버킷화된 수치(파일 크기·녹음 길이는 구간으로), 불리언.

**URL 마스킹 규칙(필수)**: 계측·에러 추적 도구에 전송되는 모든 URL은 경로 세그먼트를 치환한 형태로만 보낸다.
```
/watch/a1b2c3...        → /watch/:token
/gifts/perform/xyz...   → /gifts/perform/:token
/memorial/{slug}        → /memorial/:slug
```
쿼리스트링은 UTM 파라미터 화이트리스트만 통과시키고 나머지는 제거한다.

**버킷 규칙 예시**: `file_size_bucket` = `lt1mb|1_5mb|5_10mb|gt10mb`, `duration_sec_bucket` = `lt30|30_60|60_120|gt120`.

### 1-2. 서버 이벤트와 클라이언트 이벤트의 분담 기준

| 성격 | 담당 | 이유 |
|---|---|---|
| 돈이 움직이는 사건(결제·환불·구독) | **서버** | 광고 차단기·JS 실패·네트워크 끊김에 영향받으면 안 됨. 회계와 대사 가능해야 함 |
| 상태 전이(AI 작업, 선물 수행, 사후 공개, 전달) | **서버** | 이미 DB가 정본. 클라이언트가 다시 보고하면 두 숫자가 갈라진다 |
| 화면 노출·클릭·스크롤·입력 이탈 | **클라이언트** | 서버가 알 수 없는 정보 |
| 유입 출처(UTM·referrer) | **클라이언트 캡처 → 서버 저장** | 캡처는 브라우저에서만 가능하지만, 귀속은 결제 레코드와 조인해야 하므로 서버에 영속화 |
| 외부 결제창 이탈(토스 창을 닫음) | **클라이언트** | 서버에는 `ready` 상태만 남고 "왜 안 왔는지"가 없다 |

### 1-3. 중복 계측 금지 (가장 중요한 규칙)

**서버 DB에 이미 남는 사실은 클라이언트 이벤트로 다시 심지 않는다.** 온담은 상태 로그 테이블이 이미 촘촘하다(`photo_order_logs`, `will_status_logs`, `pet_status_logs`, `subscription_logs`, `subscription_payment_logs`, `ai_jobs`, `payments`, `notifications`, `audit_logs`). 이 사실들을 이벤트로 중복 발행하면 두 개의 진실이 생기고, 어느 쪽이 맞는지 매번 대조해야 한다.

원칙:
- **분자·분모가 모두 DB에 있는 KPI는 SQL로 산출한다.** 계측 도구를 거치지 않는다.
- 계측 도구는 **DB에 없는 것**(노출·클릭·이탈·유입 출처)만 담당한다.
- 두 세계를 잇는 접착제는 `user_id`(UUID)와 `anonymous_id`다. 결제 성공 시점에 두 ID를 매핑 저장한다.

### 1-4. 식별자 체계

| ID | 발급 | 수명 | 용도 |
|---|---|---|---|
| `anonymous_id` | 첫 방문 시 1st-party 쿠키(UUID v4) | 만료 [확인 필요 - 법률 검토] | 비로그인 퍼널 추적 |
| `user_id` | `users.user_id`(CHAR(36)) | 영구 | 로그인 후 모든 이벤트 |
| `gift_actor_id` | 선물 수행 토큰의 해시 앞 16자 | 토큰 수명(90일) | **무계정 수행자(부모)** 퍼널 추적. 계정이 없으므로 유일한 수단 |
| `session_id` | 30분 무활동 시 갱신 | 세션 | 방문→결제 전환율의 분모 |

로그인·계정 연결 시 `anonymous_id → user_id` alias 이벤트를 1회 발행해 과거 세션을 잇는다. `gift_actor_id`는 [SPEC-01](../specs/SPEC-01-gift-flow.md) 4-3(기존 계정 연결) 발생 시에만 `user_id`로 alias한다.

### 1-5. 동의·법적 전제

- 온라인 맞춤형 광고·행태정보 수집에 대한 동의 및 개인정보 처리방침 고지 문안: **[확인 필요 - 07-risk-legal.md 법률 검토 항목에 편입]**
- 계측 도구가 국외(미국) 서버면 개인정보 국외이전 고지가 필요하다(6절 선정 기준에 반영).
- 쿠키 배너 도입 여부와 형태: [확인 필요 - 법률 검토]. 결정 전까지는 **동의 없이도 적법한 범위**(자사 서비스 운영·보안 목적의 1st-party 최소 로그)로 시작한다.

---

## 2. 이벤트 사전

**소스 표기**
- `DB` = 이미 서버 DB에 기록됨. **새로 심을 것 없음.** SQL로 집계
- `DB+` = DB에 기록되나 **컬럼·테이블이 부족**. 스키마 보강 필요
- `S` = 서버에서 신규 기록 필요
- `C` = 클라이언트 이벤트 신규 필요

### 2-1. 유입·랜딩 (여정: 인지 → 고려)

| # | 이벤트 | 발생 시점 | 소스 | 프로퍼티 |
|---|---|---|---|---|
| 1 | `page_view` | 모든 페이지 진입 | C | `path_masked`, `referrer_host`, `utm_source/medium/campaign/content`, `device_type`, `session_id` |
| 2 | `first_touch_captured` | 세션 최초 진입 1회 | C→S | `utm_*`, `referrer_host`, `landing_path_masked`. **결제 귀속의 유일한 근거이므로 서버에 영속화** |
| 3 | `landing_view` | 랜딩 노출 | C | `product`(photo/will/pet), `variant`(A/B 시) |
| 4 | `sample_video_play` | 예시 영상 재생 시작 | C | `product`, `position`(hero/mid) |
| 5 | `before_after_slider_use` | 복원 전후 슬라이더 조작 | C | `product=photo` |
| 6 | `price_section_view` | 가격 영역 50% 이상 1초 노출 | C | `product`, `price_krw` |
| 7 | `faq_open` | FAQ 항목 펼침 | C | `topic`(refund/legal/privacy/delivery/...) |
| 8 | `phone_cta_click` | 전화 문의 번호 클릭 | C | `page_masked`. 5060 신뢰 장치의 실사용량 |

### 2-2. 상품 조회·구매 진입

| # | 이벤트 | 발생 시점 | 소스 | 프로퍼티 |
|---|---|---|---|---|
| 9 | `product_view` | 상품 상세 진입 | C | `product_type`, `price_krw`, `entry_mode`(self/gift) |
| 10 | `purchase_mode_select` | 셀프/선물 선택 | C | `mode`(self/gift), `product_type`. **가설 1의 선행 지표** |
| 11 | `checkout_start` | 결제 준비 API 호출 성공 | DB | `payments`에 `status='ready'` 레코드 생성됨. 별도 이벤트 불필요 |

### 2-3. 업로드·프리체크 ([SPEC-08](../specs/SPEC-08-photo-product.md))

| # | 이벤트 | 발생 시점 | 소스 | 프로퍼티 |
|---|---|---|---|---|
| 12 | `upload_start` | 업로드 화면 진입 | C | `product_type`, `actor`(self/gift_recipient) |
| 13 | `upload_file_selected` | 파일 선택 완료 | C | `file_count`, `mime_type`, `file_size_bucket` |
| 14 | `precheck_result` | 프리체크 판정 직후 | **S** | `result`(pass/warn/block), `reason`(low_res/no_face/small_face/multi_face/none), `order_id` 또는 `gift_actor_id`. **SPEC-08 수용기준 2가 "경고 후 진행 케이스가 로그에 구분 기록"을 요구 → 서버 기록이 스펙 요건** |
| 15 | `precheck_override` | 경고 후 사용자가 진행 선택 | **S** | `reason`, `order_id`. 품질 불만 재처리 귀책 판정 근거 |
| 16 | `upload_complete` | S3 업로드 성공 | DB | `photo_files` / `photo_orders.source_image_url`에 기록됨 |
| 17 | `voice_record_start` | 녹음 버튼 첫 클릭 | C | `actor`, `guide_sentence_id` |
| 18 | `voice_record_retry` | 재녹음 | C | `retry_no`. **핵심 이탈 지점 2(10 문서 2절) 측정용** |
| 19 | `voice_record_complete` | 녹음 확정 | DB+ | `voice_samples.duration_sec` 존재. 다만 **재녹음 횟수 컬럼 없음** → 18번 클라 이벤트로 보완 |
| 20 | `consent_check` | 음성·AI영상 동의 체크 | DB | `user_consents`에 IP/UA와 함께 기록(SPEC-01 수용기준 3) |

### 2-4. 결제

| # | 이벤트 | 발생 시점 | 소스 | 프로퍼티 |
|---|---|---|---|---|
| 21 | `payment_success` | 토스 승인 완료 | DB | `payments.status='done'`, `paid_at`, `amount_krw`, `target_type`, `target_id` |
| 22 | `payment_fail` | 승인 실패 | DB | `payments.status='failed'`, `fail_reason` |
| 23 | `payment_abandon` | **결제창을 닫거나 이탈** | **C** | `stage`(widget_open/auth/confirm), `elapsed_sec`. **서버에는 `ready`만 남고 이유가 없다. 이 이벤트가 없으면 "결제 시작 → 성공률"의 분모가 오염된다** |
| 24 | `payment_pending_unresolved` | confirm 타임아웃 등 불확정 | DB | `payments.status='ready'`가 임계 시간 초과 잔존. OPERATIONS 4-3의 정기 점검 항목과 동일 소스 |
| 25 | `refund_executed` | 환불 실행 | DB+ | `payments.canceled_at`, `cancel_reason` 존재. **환불 유형 구분 컬럼이 없음** → `refund_type`(auto_ai_fail/self_cancel/discretionary/gift_declined) 추가 필요. 유형별 분해 없이는 환불율이 해석 불가 |

### 2-5. AI 처리

| # | 이벤트 | 발생 시점 | 소스 | 프로퍼티 |
|---|---|---|---|---|
| 26 | `ai_job_queued` | 큐 적재 | DB | `ai_jobs.job_status='queued'`, `created_at` |
| 27 | `ai_job_started` | 워커 착수 | DB | `job_status='running'`, `started_at` |
| 28 | `ai_job_completed` | 성공 | DB | `job_status='completed'`, `completed_at`. 처리 소요 = `completed_at - started_at` |
| 29 | `ai_job_failed` | 최종 실패 | DB | `job_status='failed'`, `error_message`, `retry_cnt` |
| 30 | `ai_job_vendor_billed` | 벤더 호출 1건 종료 | **DB+** | **`ai_jobs`에 벤더·과금 단위 컬럼이 없다.** `vendor`(gemini/elevenlabs/did/sync/fal), `vendor_job_id`, `billable_units`(이미지 장수·TTS 문자수·영상 초수), `cost_estimate_krw` 추가 필요. **이 컬럼이 없으면 09 문서의 원가가 영원히 추정치로 남는다(DEV-02가 자동으로 안 끝난다)** |
| 31 | `reprocess_requested` | "마음에 안 들어요" | **DB+** | `reason`(not_similar/damaged/other), `item_kind`. SPEC-02가 `reprocess_count`를 전제하나 **`photo_orders`에 해당 컬럼 없음** → 추가 필요. 재처리 기대원가(09 문서) 산정의 유일한 소스 |

### 2-6. 결과 수령·공유·업셀

| # | 이벤트 | 발생 시점 | 소스 | 프로퍼티 |
|---|---|---|---|---|
| 32 | `result_view` | 결과 화면 최초 열람 | **S** | `order_id`, `product_type`, `time_to_view_sec`(완료 통지 → 열람). **"결제 → 수령 완료율"의 분자. DB에 열람 시각 컬럼이 없다** → `photo_orders.first_viewed_at` 추가 권장 |
| 33 | `result_download` | 개별/전체 다운로드 | C | `kind`, `download_mode`(single/all) |
| 34 | `share_click` | 공유 버튼 클릭 | C | `channel`(kakao/link_copy/save_image), `order_id`. **공유율의 분자** |
| 35 | `share_link_visit` | 공유된 링크로 외부인 진입 | **S** | `share_id`(서명 파라미터), `is_new_visitor`. **실제 확산(바이럴 계수)은 클릭이 아니라 이걸로 잰다. 공유 URL에 `share_id` 파라미터를 심지 않으면 사후 소급 불가** |
| 36 | `upsell_impression` | 결과 화면에서 영상 편지 안내 노출(50%·1초) | **C** | `from`(photo_result/memorial/mypage), `to_product`, `order_id`. **업셀 전환율 분모 후보 C의 유일한 소스** |
| 37 | `upsell_click` | 업셀 CTA 클릭 | C | `from`, `to_product`, `order_id` |
| 38 | `memorial_cta_click` | 추모관 방문 유가족의 사진관 안내 클릭 | C | `slug_masked`. 03 문서 4절 "유가족 열람 화면이 곧 신규 접점" 검증 |

### 2-7. 선물 동선 ([SPEC-01](../specs/SPEC-01-gift-flow.md))

| # | 이벤트 | 발생 시점 | 소스 | 프로퍼티 |
|---|---|---|---|---|
| 39 | `gift_link_sent` | 링크 발송 | DB | `gift_orders.status='link_sent'` (신설 테이블) |
| 40 | `gift_link_opened` | 부모가 링크 진입 | DB | `status='opened'` |
| 41 | `gift_verify_fail` | 휴대폰 뒤 4자리 오입력 | **S** | `attempt_no`. 5회 잠금 전조. 이탈 원인 분해에 필수 |
| 42 | `gift_perform_step` | 수행 단계 통과 | **DB+** | `step`(consent/photo/voice/beneficiary), `gift_actor_id`. **`gift_orders.status`는 `in_progress` 한 값뿐이라 단계별 이탈을 못 잰다** → `gift_order_logs`에 step 전이를 기록 |
| 43 | `gift_completed` | 수행 완료 | DB | `status='completed'` |
| 44 | `gift_declined` | 정중히 거절(SPEC-01 4-5) | DB | `status='declined'`. **거절률은 상품 수용성의 직접 신호이므로 별도 지표로 승격** |
| 45 | `gift_reminder_sent` | 미수행 리마인드 발송 | **S** | `target`(recipient/giver), `seq`(1/2), `channel`. 리마인드 효과(발송 → 진입) 측정 |
| 46 | `gift_link_expired` | 90일 만료 | DB | `status='expired'` |

### 2-8. 사후 공개·전달·열람 ([SPEC-05](../specs/SPEC-05-letter-delivery.md))

| # | 이벤트 | 발생 시점 | 소스 | 프로퍼티 |
|---|---|---|---|---|
| 47 | `release_request_submitted` | 유가족이 사망증명 제출 | DB | `will_release_requests.created_at` |
| 48 | `release_reviewed` | 관리자 승인/반려 | DB | `req_status`, `reviewed_at`, `reviewed_by`. **검수 SLA = `reviewed_at - created_at`** (SPEC-06이 화면에 요구) |
| 49 | `delivery_sent` | 수신인별 전달 발송 | **DB+** | `will_beneficiaries`에 발송 시각 컬럼 없음 → `delivered_at` 추가 필요 |
| 50 | `watch_page_open` | `/watch/:token` 진입 | **S** | `beneficiary_id`, `is_first`. URL의 토큰은 절대 전송 금지(1-1) |
| 51 | `watch_play_click` | "마음의 준비가 되면" 버튼 | **C** | `hesitation_sec`(진입 → 클릭). 감정 설계의 유일한 정량 신호 |
| 52 | `watch_download` | 원본 다운로드 | S | `beneficiary_id` |
| 53 | `watch_footer_cta_click` | "나도 남기고 싶다면" | **C** | **바이럴 원점(10 문서 P-C). 이 링크의 전환이 곧 다음 코호트** |
| 54 | `watch_link_extend_requested` | 만료 후 연장 요청 | DB | 재발급 로그 |

> `wills`에 `video_watched_at`·`watch_count`가 있다고 SPEC-05 4절이 적고 있으나, **현재 `ondam_schema.sql`의 `wills` 테이블에는 두 컬럼이 없다.** [확인 필요 - 마이그레이션 대기분 포함 실 DB 대조]

### 2-9. 구독·펫 ([SPEC-03](../specs/SPEC-03-memorial-access.md))

| # | 이벤트 | 발생 시점 | 소스 | 프로퍼티 |
|---|---|---|---|---|
| 55 | `subscription_started` | 구독 개시 | DB | `subscriptions.created_at`, `plan`, `price_krw` |
| 56 | `subscription_renewed` | 정기결제 성공 | DB | `subscription_payment_logs` |
| 57 | `subscription_payment_failed` | 정기결제 실패 | DB | `fail_count`, `sub_status` 전이 |
| 58 | `subscription_canceled` | 해지 | DB | `canceled_at`, `cancel_reason`. **해지 사유 선택지를 정형화(ENUM)하지 않으면 이탈 원인 분석이 불가** → 사유 코드 표준화 필요 |
| 59 | `partner_coupon_redeemed` | 제휴 쿠폰 등록 | **DB+** | `partner_code`, `pet_id`. **테이블 없음.** 가설 4를 판정할 유일한 소스이므로 DEV-14와 함께 신설 |
| 60 | `pet_memorial_public_view` | 공개 추모 페이지 조회 | S | `slug_masked`, `is_owner` |
| 61 | `pet_guestbook_post` | 방명록 작성 | DB | 신고·모더레이션 큐와 동일 소스 |

### 2-10. 광고비 입력 (CAC의 분자)

| # | 이벤트 | 발생 시점 | 소스 | 프로퍼티 |
|---|---|---|---|---|
| 62 | `ad_spend_recorded` | 관리자가 광고비 입력 | **DB+** | `channel`(meta/youtube/community/partner), `period_start`, `period_end`, `spend_krw`, `note`. **테이블 없음.** 자동 연동(Meta API)은 과잉이므로 관리자 수기 입력 화면으로 충분하되, **이 테이블이 없으면 CAC는 영원히 산출 불가** |

**합계: 62개 항목** (DB 기존 활용 24, DB 스키마 보강 필요 9, 서버 신규 12, 클라이언트 신규 17)

---

## 3. KPI 산출식

모든 지표는 **KST 기준 일 단위로 절단**하고, 별도 표기가 없으면 **월(달력월) 집계**를 기본으로 한다. 봇·내부 IP·관리자 계정은 전 지표에서 제외한다.

### 3-1. North Star: 전달 예약된 영상 편지 수

```
NSM(기간) = COUNT(DISTINCT will_id)
            WHERE wills.status가 기간 내에 'active'로 최초 진입
              AND result_video_s3_key_encrypted IS NOT NULL   -- 제작 완료
              AND 확정 수신인 수 >= 1                          -- 전달 대상 존재
              AND wills.deleted_at IS NULL
```

- **"결제"가 아니라 "제작 완료 + 수신인 확정"까지 간 건수**다(04 문서 정의). `payments`가 아니라 `wills` 상태를 본다.
- 상태 최초 진입 시각은 `will_status_logs`에서 얻는다. `wills.updated_at`은 이후 수정에 덮이므로 쓰지 않는다.
- 계정 삭제·유언 폐기(`revoked`)로 사후 감소한 건은 **차감하지 않는다**(누적 성취 지표). 대신 `revoked` 전환 건수를 보조 지표로 별도 표시한다.
- 선물 동선으로 만들어진 건도 포함한다(수행자 = 소유자).

### 3-2. 방문 → 결제 전환율

```
CVR_visit_pay = (기간 내 최초 결제 성공이 발생한 세션 수)
              / (기간 내 랜딩 또는 상품 상세를 본 세션 수)
```

- 분모 소스: 클라이언트 `page_view` / `product_view`의 `session_id` distinct.
- 분자 소스: `payments.status='done'`인 결제의 `session_id`(결제 준비 시 세션 ID를 `payments`에 함께 저장해야 조인 가능 → **`payments`에 `session_id`·`anonymous_id` 컬럼 추가 필요**). 컬럼이 없으면 이 지표는 계산 자체가 불가하다.
- **상품별로 분리**한다(사진관·영상 편지 혼합 금지). 가격대가 5배 차이라 합산값은 해석 불가.
- 재방문 후 결제한 경우 결제가 일어난 세션에 귀속한다(last-session). 유입 채널 귀속은 `first_touch_captured`(first-touch)를 따로 쓴다. **두 귀속 규칙을 혼용하지 않는다.**

### 3-3. 결제 → 결과물 수령 완료율

혼동을 막기 위해 **두 개로 쪼갠다.** 하나로 합치면 "AI가 실패한 것"과 "만들어졌는데 안 본 것"이 섞인다.

```
(a) 제작 완료율 = COUNT(주문 중 ai_jobs 최종 completed) / COUNT(payments.status='done' 주문)
(b) 수령률     = COUNT(result_view 1회 이상 발생 주문) / COUNT(제작 완료 주문)

결제 → 수령 완료율 = (a) × (b)
```

- **코호트 기준**: 결제일 기준으로 묶고 **관측창 D+7**. 관측창이 아직 안 닫힌 코호트는 "미확정"으로 표시하고 확정 수치와 같은 축에 그리지 않는다.
- (a)가 낮으면 파이프라인 문제(벤더·프리체크), (b)가 낮으면 통지 도달 문제(알림톡·SMS)다. 대응 부서가 다르므로 반드시 분리한다.
- 부분 실패(세트 4종 중 1종 실패, SPEC-02 2절)는 (a)에서 **실패로 계산**한다. 전액 환불 대상이기 때문이다.

### 3-4. 결과물 공유율

```
공유 클릭률   = COUNT(DISTINCT order_id WHERE share_click 발생) / COUNT(DISTINCT order_id WHERE result_view 발생)
실확산 계수 K = COUNT(share_link_visit WHERE is_new_visitor) / COUNT(DISTINCT order_id WHERE result_view 발생)
```

- 분모를 "결제 건"이 아니라 **"결과를 실제로 본 건"**으로 잡는다. 안 본 사람은 공유할 기회 자체가 없었으므로 분모에 넣으면 지표가 파이프라인 실패를 흡수한다.
- 카카오 공유는 클릭 후 실제 전송 여부를 알 수 없다(SDK 콜백 신뢰 불가). 그래서 클릭률과 실확산 K를 **둘 다** 본다. K가 04 문서가 말한 "바이럴 계수의 선행 지표"의 실체다.
- `share_link_visit`은 공유 URL에 `share_id`가 심겨 있어야만 잡힌다. **출시 후 소급 불가**(7절 P0).

### 3-5. CAC

```
CAC(채널, 기간) = SUM(ad_spend.spend_krw WHERE channel=c AND 기간 겹침 안분)
                / COUNT(DISTINCT user_id WHERE 기간 내 생애 첫 결제 성공 AND first_touch.utm_source가 채널 c)
```

- **분자(광고비) 입력 경로**: `/admin`에 광고비 입력 화면을 만들고 `ad_spend` 테이블에 기간·채널·금액을 수기 등록한다(이벤트 #62). Meta·Google API 자동 연동은 초기 볼륨에서 과잉이다. **다만 이 화면이 없으면 CAC는 계산 자체가 불가능하다.**
- 기간이 걸친 광고비는 일할 안분한다.
- 분모는 **생애 첫 결제자**(신규 고객)다. 재구매는 제외한다.
- **오가닉 유입은 분모에서 제외**한다(광고비를 안 쓴 고객을 분모에 넣으면 CAC가 임의로 낮아진다). 대신 블렌디드 CAC(전체 광고비 / 전체 신규 결제자)를 보조로 병기한다.
- **판정식(04 문서 3절)의 계산 형태**:
  ```
  판정 1: CAC < CM_photo                       → 사진관 단독 확장 가능
  판정 2: CAC < CM_photo + u × CM_will          → 사진관은 미끼로 성립
  (CM = 기여이익, 09 문서 7절 / u = 업셀 전환율, 아래 3-6의 분모 A 기준)
  ```
  두 판정 모두 실패하면 유료 광고를 중단하고 1순위 채널(콘텐츠)로 회귀한다.

### 3-6. 사진관 → 영상 편지 업셀 전환율 (분모 정의가 핵심)

**분모 후보 3개 중 무엇을 쓰느냐로 값이 크게 달라진다. 셋 다 계산하되 용도를 고정한다.**

| 정의 | 분모 | 분자 | 용도 | 
|---|---|---|---|
| **A. 사업 판정용 (정본)** | 기간 내 사진관 **결제 성공 고객** 수 (distinct user) | 그중 관측창 내 영상 편지 결제 성공 고객 수 | **CAC 판정식의 `u`. 04 문서 3절과 정합하려면 반드시 A다** (CAC는 사진관 결제자 1명 획득 비용이므로 분모가 같아야 한다) |
| B. 퍼널 진단용 | 사진관 **결과를 수령한** 고객 수 | 동일 | 파이프라인 실패를 제거한 순수 상품 매력도 |
| C. 화면 최적화용 | `upsell_impression` 노출 고객 수 | 동일 | 문구·배치 A/B 테스트 |

- **A를 정본으로 삼는 이유**: B와 C는 분모가 제품 변경(노출 로직·성공률)에 따라 흔들려 시계열 비교가 깨진다. A만 "돈을 낸 사람 중 몇 %가 또 냈나"라는 불변 정의를 갖는다.
- **기간 절단 방법 (코호트)**:
  ```
  u(코호트 M, 관측창 D일) = COUNT(DISTINCT user WHERE 첫 사진관 결제 in M
                                     AND 영상편지 결제 within D일 of 사진관 결제)
                          / COUNT(DISTINCT user WHERE 첫 사진관 결제 in M)
  ```
  - **관측창 D = 30일**을 기본으로 한다. 근거: 업셀 노출이 결과 화면(결제 후 수일 내)에서 발생하고, 시즌 트리거(어버이날·명절)는 별도 캠페인 지표로 분리해야 하기 때문. **D는 가정값이며, 실데이터의 전환 지연 분포를 본 뒤 재조정한다.**
  - 달력월 단순 나눗셈(그달 영상편지 결제 / 그달 사진관 결제)은 **쓰지 않는다.** 성장기에는 분모가 부풀어 전환율이 실제보다 낮게, 감소기에는 높게 나온다.
  - **관측창이 닫히지 않은 코호트는 "진행 중"으로 표기**하고 확정 코호트와 같은 선에 그리지 않는다. SPEC-06 대시보드 위젯에도 이 표기가 있어야 한다.
- 사진관을 선물로 받은 부모(수행자)와 결제한 자녀 중 **누가 전환했는지 분리 집계**한다. 전환 주체가 다르면 업셀 화면을 누구에게 보여줄지가 달라진다.

### 3-7. 티어 분포

```
티어 분포 = 티어별 영상 편지 결제 성공 건수 / 전체 영상 편지 결제 성공 건수
```

- **베이직 49,000원 단일가 출시(03 문서 확정)이므로 2차 티어 도입 전까지 이 지표는 항상 100%다.** 측정 가능 시점은 스탠다드·프리미엄 출시 이후다. Phase 3 게이트에서 이 지표를 판정 조건에 넣으면 안 된다(구조적으로 판정 불가).
- 그때까지의 대체 신호는 3-8의 가설 3 설계를 따른다.

### 3-8. 선물 동선 비중

```
선물 동선 비중(상품) = COUNT(gift_orders 결제 성공) / COUNT(해당 상품 전체 결제 성공)
```

- **상품별로 분리**한다. 사진관과 영상 편지는 선물 성향이 다를 가능성이 크다.
- **알려진 과소계상**: 자녀가 셀프 동선에서 자기 계정으로 결제한 뒤 부모를 대신해 조작하는 경우는 `gift_orders`에 안 잡힌다. 보정 방법:
  - 결제 완료 화면에 **1문항 설문**("누구를 위한 것인가요? 나 / 부모님 / 다른 가족")을 넣고 `purchase_intent` 이벤트로 수집.
  - 보고 시 **하한(gift_orders 기준)과 상한(gift_orders + 설문 '부모님/다른 가족')을 구간으로 제시**한다. 단일 숫자로 보고하지 않는다.
- 셀프 동선 결제자의 연령대는 알 수 없다(가입 시 생년 수집 안 함). 연령 추정을 위해 가입 폼에 생년을 추가하는 것은 **개인정보 최소수집 원칙과 충돌**하므로 하지 않는다. 대신 위 설문으로 대체한다.

### 3-9. AI 처리 실패율·환불율

```
AI 최종 실패율 = COUNT(ai_jobs job_status='failed') / COUNT(ai_jobs 종료(completed+failed))
AI 시도 실패율 = (실패 시도 수 포함) / (전체 시도 수)      -- retry_cnt 반영
```
- 두 버전을 함께 본다. 최종 실패율은 고객 영향, 시도 실패율은 벤더 품질·원가 누수다.
- **벤더별·`job_type`별로 반드시 분해**한다(이벤트 #30의 `vendor` 컬럼 필요). 벤더 교체 판단(`LIPSYNC_PROVIDER`)의 유일한 근거다.

```
환불율(유형별) = COUNT(refund WHERE refund_type=t) / COUNT(payments.status='done')
```
- **유형 분해 없는 환불율은 보고하지 않는다.** `auto_ai_fail`(제품 결함) / `self_cancel`(구매 취소) / `discretionary`(CS 재량) / `gift_declined`(수행자 거절)는 원인도 대응도 전혀 다르다.
- `gift_declined`는 환불이지만 **실패가 아니다**(SPEC-01 4-5의 강요 금지 장치가 정상 작동한 것). 환불율 총계에는 넣되 "제품 결함 환불율" 지표에서는 제외한다.

### 3-10. SPEC-06 대시보드 위젯 데이터 출처 (구현 명세)

SPEC-06 2절이 요구하는 KPI 위젯 3종의 출처를 여기서 고정한다.

| 위젯 | 소스 | 갱신 주기 | 주의 |
|---|---|---|---|
| North Star (전달 예약 영상 수) | `wills` + `will_status_logs` (3-1) | 실시간 쿼리 가능(볼륨 작음) | 당월 누계 + 전월 대비 |
| 업셀 전환율 | 3-6 정의 A. `payments` self-join | 일 1회 배치 권장 | **관측창 미완료 코호트는 "진행 중" 배지 필수** |
| 선물 동선 비중 | 3-8. `gift_orders` / `payments` | 실시간 | **구간(하한~상한)으로 표시**, 단일 숫자 금지 |
| 오늘 지표(신규 주문·매출·처리중·실패·검수대기) | `payments`, `ai_jobs`, `will_release_requests` | 실시간 | 전부 기존 DB. 신규 계측 불필요 |

---

## 4. 가설 검증 설계

04 문서 4절의 가설 4개를 판정 규칙으로 변환한다.

> **표본 크기 산정 근거**: 비율 지표의 95% 신뢰구간 반폭 ≈ `1.96 × sqrt(p(1-p)/n)`. 아래 최소 표본은 이 식으로 목표 정밀도를 역산한 값이다. 계산식을 함께 적었으니 목표 정밀도를 바꾸면 표본 수도 다시 계산할 수 있다.
> **임계값은 대부분 가정이다.** 시장 벤치마크를 확보하지 못했으므로 아래 임계는 "제안"이며 오너 확정 대상이다. 임계를 확정하지 않은 채 데이터를 보면 사후 합리화가 된다.

### 가설 1. 자녀가 주 결제자다

| 항목 | 내용 |
|---|---|
| 판정 지표 | 선물 동선 비중(3-8), 하한·상한 구간 |
| 최소 표본 | **결제 성공 100건** (p=0.5에서 CI 반폭 ±9.8%p) |
| 참 판정 | 하한값이 **50% 초과** |
| 부분 참 | 구간이 30~50%에 걸침 → "양축 병행". 셀프 동선을 버리지 않는다 |
| 기각 | 상한값이 **30% 미만** → 포지셔닝 결정 3(02 문서) 재검토. 선물 동선(DEV-10) 투자 축소, 셀프 동선 UX에 재배분 |
| 관측 기간 | 결제 100건 누적 시점까지. 시즌 캠페인 기간은 별도 표기(어버이날은 선물 비중이 구조적으로 높다) |
| 보조 신호 | `purchase_mode_select`의 gift 선택률(결제 전 의향), `gift_declined` 비율 |

### 가설 2. 사진관이 업셀 퍼널로 작동한다

| 항목 | 내용 |
|---|---|
| 판정 지표 | 업셀 전환율 `u` (3-6 정의 A, 관측창 D+30) |
| 최소 표본 | **사진관 결제 200건** 그리고 그 코호트의 D+30 경과. (p=0.05에서 CI 반폭 ±3.0%p) |
| 참 판정 | **CAC 실측 후**: `u ≥ (CAC - CM_photo) / CM_will` (09 문서 **7-5절** 표에 CAC별 `u_min`이 계산되어 있다. 기본 가정에서 CAC 10,000원 → 2.8%, 20,000원 → 25.2%, 30,000원 → 47.4%)<br>**CAC 실측 전 임시 게이트**: `u ≥ 5%` **(가정값. 근거 없음, 오너 확정 필요)** |
| 기각 | `u < 2%` → 사진관은 미끼로 작동하지 않는다. 사진관을 독립 수익 상품으로 재규정하거나(가격 인상), 영상 편지를 직접 랜딩으로 유도 |
| 관측 기간 | 코호트 D+30. **관측창 미완료 상태로 판정하지 않는다** |
| 함정 | 초기 사용자는 얼리어답터라 `u`가 과대 추정된다. 최소 2개 이상의 월 코호트가 같은 방향을 가리켜야 판정한다 |

### 가설 3. 49,000원은 저가 침투로 유효하다

**티어 분포로는 판정할 수 없다**(단일가 출시, 3-7). 대체 설계:

| 항목 | 내용 |
|---|---|
| 판정 지표 | ① 영상 편지 방문→결제 전환율(3-2) ② 결제 시작→성공률 = `payment_success / (payment_success + payment_fail + payment_abandon)` ③ `price_section_view` 이후 이탈률 |
| 최소 표본 | **영상 편지 결제 시작 150건** (②의 p=0.7에서 CI 반폭 ±7.3%p) |
| 참 판정 | ② **≥ 70%** 이고, ③이 사진관(9,900원) 대비 유의하게 높지 않음 **(임계는 가정값, 오너 확정 필요)** |
| 기각 | ②가 50% 미만이거나 가격 노출 직후 이탈이 사진관 대비 2배 이상 → 가격 저항. **가격 인하가 아니라** 신뢰 장치 보강(예시 영상·후기)을 먼저 시도하고, 그래도 안 되면 가격 실험 |
| 주의 | 이 가설은 "49,000원이 싸다"가 아니라 **"49,000원이 5060/4050에게 결제 결심 가능한 금액인가"**를 묻는다. 상방 지불의사(스탠다드·프리미엄)는 2차 티어 도입 시 별도 검증 |
| 보조 | 이탈자 대상 1문항("망설이신 이유는?") - 표본 확보가 어려우므로 참고용 |

### 가설 4. 펫 화장 직후 제휴 쿠폰이 전환된다

| 항목 | 내용 |
|---|---|
| 판정 지표 | ① 쿠폰 등록률 = `partner_coupon_redeemed` / 배포 쿠폰 수 ② 등록 → 30일 내 구독 전환율 |
| 최소 표본 | **제휴처 3곳 이상 × 쿠폰 100장 이상 배포** (제휴처 1곳 결과로 일반화 금지. 업체별 전달 방식 차이가 크다) |
| 참 판정 | 등록률 **≥ 10%** **(가정값. 오프라인 쿠폰 벤치마크 미확보, 오너 확정 필요)** |
| 기각 | 등록률 < 3% → 쿠폰 전달 방식 문제인지 상품 문제인지 분리 확인(업체 직원이 실제로 전달했는지 현장 확인). 그래도 낮으면 3순위 채널 후순위화 |
| 필수 선행 | **`ad_spend`·`partner_coupon` 테이블과 `partner_code` 발급 체계가 없으면 판정 불가.** DEV-14와 함께 만든다 |
| 배포 수 파악 | 업체에 전달한 쿠폰 코드 수를 발급 시점에 기록(자동). 업체가 실제 전달했는지는 시스템으로 알 수 없음 → **업체별 등록률 편차를 전달 이행률의 대리 지표로 사용** |

---

## 5. 무엇을 재지 않을 것인가

지표를 늘리면 판단이 아니라 관리 부담이 는다. 아래는 의도적으로 재지 않는다.

- **개별 사용자의 화면 녹화·히트맵**: 사망·유언 맥락의 화면을 재생 가능한 형태로 저장하는 것은 위험 대비 효용이 낮다.
- **음성 녹음 내용·영상 내용 관련 일체의 파생 지표**(길이 버킷 제외).
- **체류시간·스크롤 깊이 전반**: 전환과의 연결이 약하고 노이즈가 크다. 4번(예시 영상 재생)·6번(가격 노출)처럼 목적이 명확한 지점만 잰다.
- **관리자 화면 사용성 지표**: 운영자 1~2명 규모(SPEC-06)에서는 직접 물어보는 편이 빠르다.

---

## 6. 도구 선정 기준과 후보 (확정하지 않음 - 오너 결정)

### 6-1. 온담 특성상 먼저 알아야 할 사실

**KPI 8개 중 6개는 이미 서버 DB만으로 계산된다**(North Star, 제작 완료율, 티어 분포, 선물 동선 비중, AI 실패율, 환불율). 계측 도구가 반드시 필요한 것은 **방문→결제 전환율, 공유율, 업셀 노출 기준 전환율, CAC 귀속** 정도다. 즉 **도구는 퍼널 앞단 4개 지표를 위한 것**이며, 여기에 과투자할 이유가 없다.

### 6-2. 선정 기준 (가중치 순)

1. **개인정보 국외이전 부담**: 미국 서버 도구는 처리방침에 국외이전 고지가 필요하다. 사망·건강 맥락 서비스에서 이 항목의 설명 부담은 실질적이다.
2. **서버 이벤트 수집 가능 여부**: 온담 이벤트의 절반이 서버발이다. 클라이언트 전용 도구는 반쪽이다.
3. **무료 티어 한도**: 초기 트래픽에서 유료 전환이 언제 강제되는가.
4. **코호트·퍼널 분석 기본 제공**: 3-6의 코호트 계산을 도구가 해주는가, 우리가 SQL로 짜야 하는가.
5. **구현 부담**: 1인 개발 체제. 초기 설치·유지 공수.
6. **데이터 소유·원본 export**: 도구를 갈아탈 때 과거 데이터를 들고 갈 수 있는가.

### 6-3. 후보 비교

| 후보 | 국외이전 | 서버 이벤트 | 무료 티어 | 코호트·퍼널 | 구현 부담 | 데이터 소유 |
|---|---|---|---|---|---|---|
| **GA4** | 미국 (고지 필요) | Measurement Protocol로 가능하나 이질적 | 사실상 무제한 | 퍼널 제공, 코호트는 제한적 | 낮음 | 원본 export는 BigQuery 연동 필요 |
| **Amplitude** | 미국 (고지 필요) | HTTP API 정식 지원 | 무료 티어 있음, 한도 [확인 필요 - 현행 요금표] | **강함**(제품 분석 특화) | 중간 | export 가능 |
| **Mixpanel** | 미국 (고지 필요) | 지원 | 무료 티어 있음, 한도 [확인 필요] | 강함 | 중간 | export 가능 |
| **PostHog Cloud** | 미국/EU 리전 선택 가능 | 지원 | 무료 티어 있음, 한도 [확인 필요] | 강함 | 중간 | export 가능 |
| **PostHog 셀프호스팅** | **국외이전 없음** | 지원 | 인프라 비용만 | 강함 | **높음**(운영 부담 추가) | 완전 소유 |
| **자체 `events` 테이블 + BI 조회** | **국외이전 없음** | 네이티브 | 인프라 비용만 | **직접 SQL 작성** | 중간(스키마·적재만) | 완전 소유 |

### 6-4. 검토 시 짚을 점 (권고 아님, 판단 재료)

- 자체 `events` 테이블 안은 이미 MySQL·BullMQ가 있으므로 추가 인프라 없이 시작 가능하고, 서버 DB와 같은 곳에 있어 3-6 같은 코호트 조인이 쉽다. 대신 퍼널 UI를 우리가 만들거나 조회 도구를 붙여야 한다.
- SaaS 도구 안은 UI를 즉시 얻지만, 도구 안의 클라이언트 데이터와 DB 안의 서버 데이터가 **분리되어 조인이 어렵다**. 온담의 핵심 KPI가 두 세계에 걸쳐 있으므로 이 단점이 크게 작용한다.
- 어느 쪽을 택하든 **1-3(중복 계측 금지)과 1-1(민감정보 금지)은 동일하게 적용**된다. 도구 결정을 기다리며 이벤트 설계를 미룰 이유는 없다.

---

## 7. 에러 추적 (Sentry류) - 운영 모니터링과의 역할 분담

[OPERATIONS.md](../guidelines/OPERATIONS.md) 4절에 모니터링 항목이 이미 정의되어 있다. 역할이 겹치면 알림이 두 배로 오고 결국 둘 다 무시하게 된다.

| 구분 | 담당 | 질문 | 소스 |
|---|---|---|---|
| **운영 모니터링**(OPERATIONS 4절) | 집계·임계 알림 | "얼마나 실패하고 있나" | `ai_jobs`, `payments`, `subscription_payment_logs`, 큐 길이, DB 커넥션 |
| **에러 추적**(Sentry류) | 개별 예외의 원인 | "왜 실패했나" | 처리되지 않은 예외, 5xx, 프론트 JS 런타임 에러, 릴리즈별 회귀 |
| **감사 로그**(`audit_logs`) | 누가 무엇을 했나 | 책임 추적 | 관리자 행위 |

### 7-1. 중복 방지 규칙 (필수)

- **비즈니스 실패는 에러 추적으로 보내지 않는다.** AI 벤더가 400을 반환해 `ai_jobs.job_status='failed'`가 되는 것은 예외가 아니라 정상 처리된 실패다. Sentry로 이중 전송하면 노이즈가 되어 진짜 예외를 묻는다.
- **에러 추적으로 보낼 것**: 잡히지 않은 예외, `errorHandler`가 500으로 처리한 건, DB 커넥션 획득 실패, S3/KMS SDK 예외, 워커 프로세스 크래시, 프론트 렌더 에러.
- **양쪽에 다 보낼 것**: 없다. 하나의 사건은 한 곳에만.

### 7-2. 도입 시 필수 설정 (민감정보)

에러 추적 도구는 요청 URL·헤더·바디를 기본 수집하므로 **설정 없이 붙이면 1-1을 즉시 위반한다.**

- `beforeSend` 훅에서 반드시 제거: presigned URL, `perform_token`, `/watch/:token`, `Authorization` 헤더, 쿠키, 이메일·전화 원문, `death_cert_*`, 빌링키, 토스 결제키.
- URL은 1-1의 마스킹 규칙을 적용한 뒤 전송.
- `sendDefaultPii = false` 고정.
- **이 설정이 코드로 들어가기 전에는 도입하지 않는다.**

### 7-3. 판단

- **도입 권장**(단, 7-2 완료 후). 근거: 워커가 앱 서버와 분리 실행되고 Socket.IO가 워커에 없어 실시간 신호가 약하며(OPERATIONS 1절), 프론트 에러를 볼 수단이 현재 전무하다.
- 무료 티어 한도: [확인 필요 - Sentry 현행 요금표 직접 확인]. 초기 볼륨에서 무료 범위 내일 가능성이 높다.
- 셀프호스팅 대안(GlitchTip 등)은 운영 부담을 늘리므로 초기에는 권하지 않는다.

---

## 8. 구현 우선순위

### P0 - 출시 전 필수 (사후 소급이 불가능한 것)

| 항목 | 왜 소급 불가인가 |
|---|---|
| `first_touch` UTM·referrer 캡처 → 서버 영속화 | 방문 시점에만 존재하는 정보. 나중에 붙이면 그 이전 고객의 유입 채널은 영원히 미상 |
| `anonymous_id`·`session_id` 쿠키 + `payments`에 컬럼 추가 | 세션과 결제를 잇는 유일한 고리. 없으면 방문→결제 전환율(3-2)이 계산 불가 |
| `ad_spend` 테이블 + 관리자 입력 화면 | 광고비를 사후에 기억으로 채우면 CAC가 신뢰를 잃는다 |
| 공유 URL의 `share_id` 서명 파라미터 | 이미 나간 공유 링크에는 소급해서 심을 수 없다 |
| `upsell_impression` / `upsell_click` | 노출 기준 전환율의 분모. 나중에 붙이면 이전 코호트와 비교 불가 |
| `precheck_result` / `precheck_override` 서버 기록 | SPEC-08 수용기준 2가 요구하는 스펙 요건이기도 함 |
| `ai_jobs`에 `vendor`·`billable_units`·`cost_estimate_krw` 컬럼 | 과거 작업의 벤더·과금량은 복원 불가 → 09 문서 원가가 계속 추정치로 남는다 |
| `payments`에 `refund_type` 컬럼 | 환불 사유를 사후 재분류하려면 사람이 건별로 봐야 함 |
| `gift_order_logs`의 step 전이 기록 | 선물 동선 단계별 이탈은 상태값 하나로는 복원 불가 |
| `will_status_logs`의 `active` 진입 시각 확인 | **North Star의 시간축이 여기 달려 있다.** 기존 테이블 존재하므로 기록 여부만 확인 |
| `photo_orders.first_viewed_at` (또는 동등 기록) | 수령률(3-3 b)의 분자 |
| `page_view` / `product_view` 기본 계측 | 퍼널 최상단 분모 |

### P1 - 출시 직후 2주 내 (소급은 불가하나 초기 볼륨이 작아 손실이 제한적)

- `payment_abandon`, `gift_verify_fail`, `gift_reminder_sent`
- `voice_record_retry`, `result_download`, `share_link_visit`
- `reprocess_requested` + `reprocess_count` 컬럼
- 결제 완료 화면 1문항 설문(`purchase_intent`) - 가설 1 보정
- `will_beneficiaries.delivered_at` (사후 전달 개시 전까지만 완료하면 됨)
- 에러 추적 도구 도입(7-2 설정 포함)

### P2 - 나중에 추가해도 되는 것

- `watch_*` 계열 전체 - **사후 공개 기능이 실제로 가동되기 전까지는 발생 자체가 없다.** 단 `watch_footer_cta_click`은 첫 전달 전에 준비
- `partner_coupon_redeemed` + 테이블 - DEV-14(펫 구독 오픈)와 동시
- `pet_memorial_public_view`, `pet_guestbook_post`
- 티어 분포 집계 - 2차 티어 도입 시
- A/B 테스트 프레임워크 - 표본이 쌓이기 전에는 무의미

### 8-1. 스키마 보강 요약 (P0 범위)

| 테이블 | 추가 | 목적 |
|---|---|---|
| `payments` | `session_id`, `anonymous_id`, `refund_type` | 3-2, 3-9 |
| `ai_jobs` | `vendor`, `vendor_job_id`, `billable_units`, `cost_estimate_krw` | 3-9, 09 문서 원가 실측 |
| `photo_orders` | `first_viewed_at`, `reprocess_count`(P1) | 3-3, SPEC-02 |
| `users` 또는 신규 `user_attribution` | `first_utm_*`, `first_referrer_host`, `first_landing_at` | 3-5 |
| 신규 `ad_spend` | `channel`, `period_start`, `period_end`, `spend_krw`, `note` | 3-5 |
| 신규 `events`(도구 선정 결과에 따라) | 클라이언트 이벤트 적재 | 6-3 |
| `gift_order_logs`(SPEC-01 신설분) | `step` | 3-8, 이탈 분석 |
| `will_beneficiaries` | `delivered_at` | 2-8 #49 |

> 스키마 변경은 **db-schema-architect 절차**를 따르고, 운영 DB에 ALTER를 직접 실행하지 않는다(프로젝트 규칙). 이 문서는 무엇이 왜 필요한지만 규정한다.

---

## 9. [확인 필요] 목록

| 항목 | 어디서 확인하나 |
|---|---|
| 행태정보 수집·맞춤형 광고 동의 문안, 쿠키 배너 필요 여부 | 07-risk-legal.md 법률 검토 항목에 편입 → 법률 자문 |
| `anonymous_id` 쿠키 보관 기간 상한 | 위와 동일 |
| Amplitude/Mixpanel/PostHog/Sentry 무료 티어 현행 한도 | 각 벤더 요금 페이지 직접 확인(문서 작성 시점 수치를 신뢰하지 말 것) |
| `wills.video_watched_at`·`watch_count` 실존 여부 | `ondam_schema.sql` + `docs/migrations/` 대기분 2건 적용 후 실 DB `DESCRIBE wills` |
| 계측 도구 국외이전 시 개인정보 처리방침 기재 형식 | 법률 검토 |

---

## 관련 문서
- KPI·가설 원본: [04-gtm-plan.md](04-gtm-plan.md)
- 원가·기여이익(CAC 판정식의 `CM`): [09-unit-economics.md](09-unit-economics.md)
- 여정 단계: [10-personas-and-journey.md](10-personas-and-journey.md)
- 대시보드 요구: [SPEC-06](../specs/SPEC-06-admin-console.md)
- 운영 모니터링(역할 분담): [OPERATIONS.md](../guidelines/OPERATIONS.md) 4절
- 선물 동선·프리체크·환불·전달: [SPEC-01](../specs/SPEC-01-gift-flow.md) / [SPEC-08](../specs/SPEC-08-photo-product.md) / [SPEC-02](../specs/SPEC-02-refund-failure.md) / [SPEC-05](../specs/SPEC-05-letter-delivery.md)
