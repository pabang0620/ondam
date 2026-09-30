# 로컬 개발 환경 셋업 (WSL 기준)

> 최종 갱신: 2026-09-30(환경변수 검증 규칙·`VITE_USE_MSW` 추가). 최초 작성 2026-08-23. 이 문서는 실제로 WSL(Ubuntu 26.04)에 처음부터 설치·기동해 검증한
> 절차다. 이 문서만 보고 클론 → 설치 → DB 적용 → 서버 기동 → 로그인까지 끝까지 갈 수 있어야
> 한다. 막히면 맨 아래 "문제 해결"부터 본다.
>
> 이 문서는 **로컬 개발자 워크스테이션** 셋업만 다룬다. 서버 배포·모니터링·장애 대응은
> [OPERATIONS.md](OPERATIONS.md)를 본다. 두 문서는 겹치지 않게 역할을 나눴다.

## 0. 전제

- WSL2 + Ubuntu (이 문서 검증 당시 26.04). 다른 Linux/WSL 배포판도 대체로 동일하지만,
  서비스 기동 명령(1-2절)은 배포판마다 다를 수 있다.
- Node.js 22, npm 10 (이 문서 검증 당시 버전. `node -v`로 확인)
- MySQL 8.4, Redis 8.x는 아래 절차대로 apt로 설치한다(별도 Docker 불필요 - 실제로
  이렇게 구축해 검증했다)

## 1. 저장소 설치

```bash
cd ~/project/ondam   # 저장소 루트
cd backend && npm install
cd ../frontend && npm install
```

## 2. MySQL 설치·기동

### 2-1. 설치 (최초 1회)

```bash
sudo apt update
sudo apt install -y mysql-server
```

### 2-2. 기동

```bash
sudo service mysql start
```

> **WSL 주의 (실측 근거로 꼭 필요한 정보)**: WSL 환경은 배포판·설정(`/etc/wsl.conf`의
> systemd 활성화 여부)에 따라 `systemctl`이 동작하지 않을 수 있다. `systemctl start mysql`이
> "System has not been booted with systemd" 류의 에러를 내면 위처럼 **`service` 명령**을
> 쓴다. `service`는 systemd가 있는 환경에서도 동일하게 동작하므로, WSL에서는 이쪽을
> 기본으로 쓰는 것이 안전하다.

기동 확인:

```bash
pgrep -c mysqld            # 1 이상이면 떠 있는 것
# 또는
mysql -uroot -p -e "SELECT VERSION();"
```

### 2-3. root 비밀번호 설정 (최초 1회)

apt로 설치한 MySQL은 기본적으로 `auth_socket` 인증이라 비밀번호 로그인이 안 될 수 있다.
비밀번호 인증으로 전환하려면:

```bash
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '1234';"
```

> **`1234`는 로컬 개발 전용 비밀번호다.** 운영 환경에는 절대 이 비밀번호를 쓰지 않는다.
> 배포 시에는 반드시 강력한 별도 비밀번호를 생성해 시크릿 관리 수단으로 주입한다.

이후부터는 `mysql -uroot -p1234 ...`로 접속한다.

### 2-4. DB 생성

```bash
mysql -uroot -p1234 -e "CREATE DATABASE ondam CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

## 3. 스키마 적용

**`ondam_schema.sql`(저장소 루트) 1회 실행이면 끝이다.** 이 파일이 통합 정본이고,
`docs/migrations/`에 있는 개별 마이그레이션 4세트(2026-08-21 ~ 2026-08-23)는 **전부 이미
이 파일에 반영돼 있다** - 각 마이그레이션 README 상단에 "`ondam_schema.sql`에 통합됨.
신규 DB는 이 마이그레이션을 실행하지 말 것"이라고 명시돼 있다. 2026-08-23 동의
append-only 전환(`UNIQUE(user_id, consent_type)` 제거)도 스키마 파일에서 직접
확인했다(`user_consents` 테이블 정의에 해당 UNIQUE 제약이 없고, 테이블 COMMENT에도
append-only로 전환됐다고 적혀 있다).

```bash
mysql -uroot -p1234 ondam < ondam_schema.sql
```

정상 적용되면 테이블 30개가 생긴다(에러 0건이어야 한다):

```bash
mysql -uroot -p1234 ondam -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='ondam';"
```

**`docs/migrations/` 안의 `.up.sql`/`.down.sql`은 신규 셋업에서 실행하지 않는다.** 이미
존재하는(스키마 파일 적용 이전 시점의) DB를 마이그레이션할 때만 쓰는 파일이고, 지금은
해당 상황이 아니다.

이 시점의 DB는 **테이블만 있고 데이터는 0건**이다. `ondam_schema.sql`은 순수 DDL이라
계정·시드 데이터가 전혀 없다 - 로그인 가능한 계정은 다음 절의 시드 스크립트로 만든다.

## 4. Redis 설치·기동

```bash
sudo apt install -y redis-server
sudo service redis-server start
```

2절과 동일한 이유로 `systemctl` 대신 `service`를 쓴다.

기동 확인:

```bash
redis-cli ping   # PONG이 나와야 정상
```

## 5. 환경변수 설정

### 5-1. 백엔드

```bash
cp backend/.env.example backend/.env
```

`backend/.env`를 열어 최소한 아래 값을 채운다(`backend/src/config/validateEnv.js`
기준 필수 - 없으면 서버가 즉시 종료된다):

| 변수 | 로컬 개발 값 예시 |
|---|---|
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | `1234` (2-3절에서 설정한 값, **빈 문자열이면 서버가 기동하지 않는다**) |
| `DB_NAME` | `ondam` |
| `JWT_SECRET` | 아무 임의 문자열 (`openssl rand -hex 32`로 생성 권장) |
| `JWT_REFRESH_SECRET` | 위와 별도의 임의 문자열 |

AWS/Gemini/ElevenLabs/토스 등 벤더 키는 **비워 둬도 서버는 뜬다**(경고 로그만 찍힌다).
해당 기능을 쓸 때의 동작은 6절을 본다.

기동 시 검증 규칙(`backend/src/utils/env.js`, 2026-09-30):

- `NODE_ENV`는 `development`/`production`/`test` 중 하나여야 한다(없으면 기동 거부). 로컬은 `development`.
- `JWT_SECRET`과 `JWT_REFRESH_SECRET`이 같으면 기동 거부. 32자 미만은 로컬에서는 경고, production에서는 거부.
- `PAYMENT_MOCK`/`AI_MOCK`은 `NODE_ENV=development`일 때만 동작한다. production에서 `true`면 기동 거부.
- 린트: `cd backend && npm run lint`(0 errors 유지).

### 5-2. 프론트엔드

`frontend/.env`는 **이 저장소에 아직 만들어져 있지 않다.** `frontend/.env.example`은
존재하므로 그대로 복사해서 쓴다:

```bash
cp frontend/.env.example frontend/.env
```

| 변수 | 로컬 개발 값 |
|---|---|
| `VITE_API_URL` | 비워 둔다(같은 origin의 Vite 프록시를 타므로 로컬에서는 불필요) |
| `VITE_TOSS_CLIENT_KEY` | 비워 두면 결제 버튼에서 명확한 에러가 난다(무한 로딩 아님). 실제 결제 플로우를 테스트하려면 토스 테스트용 클라이언트 키(`test_ck_...`)를 발급받아 채운다 |
| `VITE_CONTACT_PHONE` | 비워 둬도 무방(관련 UI가 대체 문구로 렌더링됨) |
| `VITE_USE_MSW` | 비워 두면 실백엔드(`:4000`)를 쓴다. 백엔드 없이 화면만 볼 때(디자인 미리보기) `true`. 2026-09-30부터 개발 모드라도 이 값이 `true`일 때만 MSW가 켜진다 - 이전에는 항상 켜져 실백엔드 응답을 가로챘다 |

## 6. 관리자 계정 시드

`ondam_schema.sql`을 갓 적용한 DB는 사용자 0명이다. 관리자 로그인이 필요하면 시드
스크립트를 돌린다:

```bash
cd backend
npm run seed:admin
```

기본값으로 role별 계정 3개가 생긴다(비밀번호는 전부 `ondam-dev-1234!`):

| role | 이메일 |
|---|---|
| super | `dev-super@ondam.dev` |
| manager | `dev-manager@ondam.dev` |
| reviewer | `dev-reviewer@ondam.dev` |

옵션: `--role=super`(특정 role만), `--email=`/`--password=`(커스텀 계정),
`--force`(이미 있는 계정 비밀번호 재설정). `NODE_ENV=production`이면 스크립트가 즉시
중단된다(운영 DB 오염 방지).

**일반 사용자 계정**은 시드 스크립트가 만들지 않는다. 프론트엔드 회원가입 화면에서
직접 가입해서 테스트한다. **회원가입은 비밀번호 8자 이상을 요구한다**
(`authRoutes.js` Zod 스키마) - 로그인 자체는 1자 이상만 통과하지만, 그건 기존 계정
검증용이고 가입 화면에서 8자 미만을 넣으면 그 자리에서 거부된다.

> 참고: 이 문서를 작성한 시점의 실제 로컬 DB(`ondam`)에는 이전 테스트 과정에서 생긴
> 사용자 61명·관리자 6명이 남아 있고, 화면 확인 편의를 위해 전부 비밀번호를 `1234`로
> 통일해 뒀다. **이건 이 DB 인스턴스 하나에만 적용된 일회성 조치이지 `ondam_schema.sql`이나
> 시드 스크립트가 재현하는 상태가 아니다.** 스키마를 새로 적용하면 이 계정들은 없다 -
> 위에서 설명한 시드 스크립트 + 회원가입으로 처음부터 계정을 만들어야 한다.

## 7. 개발 서버 기동

세 프로세스를 각각 별도 터미널에서 띄운다.

```bash
# 1) 백엔드 API 서버 (포트 4000)
cd backend && npm run dev

# 2) BullMQ 워커 (AI 처리 큐 - 사진/음성/영상/알림 작업을 실제로 처리하려면 필요)
cd backend && npm run workers

# 3) 프론트엔드 (포트 5173)
cd frontend && npm run dev
```

- 프론트는 `/api`, `/socket.io` 요청을 전부 `:4000`으로 프록시한다
  (`frontend/vite.config.js`) - 별도 CORS 설정 불필요.
- **5173은 다른 로컬 프로젝트가 먼저 점유하고 있을 수 있다.** 그 경우 Vite가 자동으로
  다음 포트(5174 등)를 잡고 터미널에 실제 URL을 출력한다 - 뜬 URL을 그대로 쓴다.
- 헬스체크: `curl http://localhost:4000/api/health`

## 8. 로그인 확인

- 관리자: 6절에서 만든 `dev-super@ondam.dev` / `ondam-dev-1234!`로 관리자 콘솔 로그인
- 일반 사용자: 프론트 회원가입 화면에서 이메일 + 8자 이상 비밀번호로 신규 가입 후 로그인

## 9. 벤더 키가 없을 때의 실제 동작 (지금 이 상태로 테스트 가능한 것)

`.env`에 AWS·Gemini·ElevenLabs·토스 키를 비워 둔 채로도 서버는 정상 기동한다. 각 기능은
아래처럼 동작한다(추측이 아니라 이 문서 작성 시점에 벤더 키 없이 실제로 확인한 동작):

| 기능 | 벤더 키 없을 때 |
|---|---|
| 사진/음성 업로드 | **503** - 안전 문구로 치환되어 응답(내부 환경변수명이 노출되지 않는다) |
| 결제 버튼 | 토스 클라이언트 키 부재로 **명확한 에러**를 낸다(무한 로딩/정지가 아니다) |
| AI 처리 큐 | 작업은 **시작되지만** 벤더 호출 단계에서 실패하고, **자동 환불**로 종료된다 |
| 결제 승인/환불 | `.env`의 `PAYMENT_MOCK=true`면 토스를 호출하지 않고 모의로 즉시 완료 처리된다 |

`PAYMENT_MOCK`은 **로컬/테스트 전용**이다. 운영 환경에서 켜지면 실결제를 가짜로
통과시키므로 절대 켜지 않는다(`.env.example`에도 이 경고가 있다).

### KMS 미설정 시 (중요 - 조건이 두 가지다)

`KMS_KEY_ID`가 비어 있으면 유언 본문(`wills.content_text_encrypted`)과 음성 샘플의
S3 키(`voice_samples.s3_key_encrypted`)가 **평문으로 저장되는 폴백 경로**가 있다
(`backend/src/domains/will/willService.js`에서 확인). 단, 이 폴백은 아래 **두 조건이
모두** 참일 때만 열린다(하나라도 아니면 폴백하지 않고 그대로 503으로 실패한다):

1. KMS 에러가 "키 자체가 아예 설정되지 않음"을 뜻하는 구조적 마커일 것
   (자격 증명 오류·네트워크 장애 등 실제 KMS 장애는 여기 해당하지 않음)
2. `NODE_ENV`가 **정확히** `development`일 것 (화이트리스트 비교 - 미설정·`staging`·
   오타 등은 전부 통과하지 못하고 503)

즉 로컬에서 `NODE_ENV=development`이고 `KMS_KEY_ID`를 비워 두면 유언장·음성 등록까지
끝까지 테스트할 수 있다(단 평문 저장이라는 것을 인지하고 써야 한다). 운영 배포 전에는
반드시 `KMS_KEY_ID`를 설정한다.

### 벤더 키 없이 끝까지 확인 가능한 화면

회원가입/로그인, 동의 화면, 펫 등록·추모관, 마이페이지, 관리자 콘솔, 선물 링크
본인확인 - 이 흐름들은 벤더 키 없이도 끝까지 동작한다.

## 10. 경고 - 셸 환경변수가 `.env`를 무력화할 수 있다

**이 개발 환경에서는 `~/.bashrc`에 실제 ElevenLabs API 키가 평문으로 `export`돼 있다.**
Node의 `dotenv`는 **이미 존재하는 `process.env` 값을 덮어쓰지 않는다.** 즉:

- `backend/.env`의 `ELEVENLABS_API_KEY`를 비워 둬도, 셸에 이미 그 값이 export돼 있으면
  워커가 **실제 ElevenLabs API를 호출해 과금이 발생**할 수 있다.
- 이건 코드나 `.env` 설정의 문제가 아니라 **셸 환경의 문제**다. `.env`만 확인하고
  "키가 없으니 안전하다"고 판단하면 틀릴 수 있다.

새 셸에서 작업을 시작하기 전에 확인:

```bash
echo "${ELEVENLABS_API_KEY:+set}"   # "set"이 출력되면 이미 값이 있는 것
env | grep -i elevenlabs
```

음성 클론 경로(voiceWorker)를 로컬에서 태울 때는 특히 이 부분을 주의한다.

## 11. 문제 해결

### MySQL이 안 올라온다
- `systemctl start mysql`이 "System has not been booted with systemd" 에러를 내면
  `sudo service mysql start`를 쓴다(2-2절).
- `pgrep -c mysqld`가 0이면 `sudo service mysql status`로 로그 확인.
- 비밀번호 로그인이 안 되면(`Access denied`) 2-3절의 `ALTER USER` 명령을 다시 실행했는지
  확인 - apt 설치 직후 root는 기본 `auth_socket` 인증이라 비밀번호가 아예 안 걸려 있을
  수 있다.

### 포트 충돌
- 4000번(백엔드)이 이미 쓰이고 있으면 `lsof -i :4000`으로 점유 프로세스 확인 후 종료,
  또는 `backend/.env`의 `PORT`를 바꾼다.
- 5173번(프론트)은 다른 프로젝트가 먼저 잡고 있을 수 있다 - Vite가 자동으로 다음 포트로
  올라가니 터미널 출력의 실제 URL을 확인한다(7절 참고).

### Redis가 안 떠서 워커가 멈춰 있다
- `redis-cli ping`이 실패하면 `sudo service redis-server start`.
- 워커(`npm run workers`)를 안 띄우면 업로드/결제까지는 되지만 AI 처리 큐가 영원히
  `pending`으로 남는다 - 워커 프로세스가 반드시 별도로 떠 있어야 한다.

### 사진/음성 업로드가 503으로 실패한다
- 벤더 키(`AWS_*`, `S3_BUCKET`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`)가 없으면
  정상적으로 발생하는 동작이다(9절). 코드 결함이 아니다.

### 회원가입이 400으로 거부된다
- 비밀번호 8자 미만이면 서버가 거부한다(6절). 8자 이상으로 다시 시도한다.

## 관련 문서

- 운영·배포·모니터링: [OPERATIONS.md](OPERATIONS.md)
- 재발 방지 규약(G1~G15): [DEVELOPMENT_GUIDELINES.md](DEVELOPMENT_GUIDELINES.md)
- 마이그레이션 이력(신규 셋업에는 불필요): `docs/migrations/*.README.md`
- 문서 전체 지도: [../PLANNING-INDEX.md](../PLANNING-INDEX.md)
