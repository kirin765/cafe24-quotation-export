# cafe24-quotation-export

Cafe24 B2B 판매자가 **상품·수량·협의 단가로 견적을 작성하고, 편집 가능한 XLSX와 인쇄용 PDF로 전달하기** 위한 앱입니다.

- **A. 로컬 데모** (`plan.md`): 구현 완료. 서버·DB·OAuth 없이 합성 데이터로 동작합니다.
- **C. 연동 MVP**: 진행 중. Cafe24 설치(launch/OAuth)·토큰 저장·상품 조회까지 구현했습니다. 초안 저장·버전 관리는 아직 없습니다.
- **B. 실제 작업 적합성 확인 / D. 파일럿**: 미착수.

## 무엇을 하는가

- 설치된 쇼핑몰의 상품을 이름으로 검색해 견적 품목으로 가져옵니다(옵션별 행 생성).
- CSV 파일·붙여넣기, 수동 입력도 그대로 씁니다.
- 상품명·옵션·수량·협의 단가를 편집하고, 수신 회사명·유효기한·납기/배송 조건·가격 조건·비고를 입력합니다.
- 행 금액 = 수량 × 단가, 상품 합계 = 행 금액 합계, 견적 총액 = 상품 합계 + 조정 금액(필수 설명, 음수 할인 허용)으로 계산합니다.
- 같은 문서 데이터로 **XLSX 다운로드**와 **A4 인쇄 화면(PDF로 저장)** 을 만듭니다.

## 무엇을 하지 않는가

- PDF 파일을 버튼 하나로 직접 생성하지 않습니다. 인쇄 화면에서 브라우저의 ‘PDF로 저장’을 사용합니다.
- XLSX 합계는 숫자 값으로만 내보내며 **자동 재계산 수식을 넣지 않습니다.**
- 부가세를 자동 계산하지 않습니다. 가격 조건에 세금 포함 여부를 글로 적습니다.
- 상품을 만들거나 수정하지 않습니다. 필요한 권한은 `mall.read_product` 하나입니다.
- 주문·회원·고객 정보를 조회하지 않습니다. 고객 식별자 권한을 요청하지 않습니다.
- 견적은 주문 전 제안이며 결제 완료나 주문 생성으로 표시하지 않습니다.
- 상품 판매가는 쿠폰·회원가·옵션 추가금 반영 전 값이라 **협의 단가의 제안값**일 뿐입니다. UI가 그렇게 표시하고 운영자가 확인해 확정합니다.


## 실행

Node 26 기준입니다. `mise.toml`에 툴체인을 고정했습니다.

```bash
npm install
npm run dev        # http://localhost:3000
```

| 스크립트 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 프로덕션 서버 |
| `npm test` | 계산·CSV·XLSX 단위 테스트 (vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next 16 flat config) |

## 화면과 라우트

| 경로 | 설명 |
|---|---|
| `/` | 범위와 사용 흐름 안내 |
| `/demo` | 견적 편집(문서 정보, 상품 검색, 품목, 조정 금액, 합계 미리보기, 내보내기) |
| `/demo/print` | A4 인쇄 미리보기(`/demo`의 현재 문서를 localStorage에서 읽음) |
| `/api/auth/install` | **App URL.** Cafe24가 앱 실행 시 호출. hmac·timestamp 검증 후 OAuth로 보냄 |
| `/api/auth/callback` | **Redirect URI.** 인증 코드를 토큰으로 교환하고 세션 쿠키 발급 |
| `/api/webhooks/cafe24` | 앱 삭제(90077)·만료(90078) 수신. 토큰 삭제 |
| `/api/cafe24/session` | 이 브라우저의 연동 상태(몰 ID, 저장소 종류) |
| `/api/cafe24/products` | 설치된 몰의 상품 검색(`q`, `limit`, `offset`) |
| `/api/cafe24/products/{product_no}/options` | 상품 옵션 목록 |

`plan.md`의 `/quotes`·`/settings`·`/quotes/[id]` 화면과 초안/버전 저장은 아직 없습니다(서버 저장 필요).

## 연동 설치 흐름

```text
Cafe24 관리자 > 앱 실행
  → GET /api/auth/install?mall_id=..&timestamp=..&hmac=..
      hmac(클라이언트 시크릿, HMAC-SHA256 base64) + timestamp ±2시간 검증
      저장된 토큰이 401/403으로 거부될 때만 재동의, 그 외에는 바로 /demo
  → 302 https://{mall_id}.cafe24api.com/api/v2/oauth/authorize?scope=mall.read_product
      state는 쿠키(cq_state)와 state 값 양쪽에 담아 콜백에서 대조(CSRF)
  → GET /api/auth/callback?code=..&state=..
      code → token 교환, DB 저장, cq_sess 세션 쿠키 발급, /demo로 이동
  → /demo 에서 상품 검색·추가

앱 삭제/만료 → POST /api/webhooks/cafe24 (X-API-Key 검증) → 토큰 삭제
```

## 환경변수

`.env.example` 참고. Vercel 프로젝트 > Settings > Environment Variables에 넣습니다.

| 변수 | 필수 | 설명 |
|---|---|---|
| `CAFE24_CLIENT_ID` | 예 | 개발자센터 앱 인증정보 |
| `CAFE24_CLIENT_SECRET` | 예 | 개발자센터 앱 인증정보. 재발급 시 여기도 교체 |
| `CAFE24_REDIRECT_URI` | 예 | 등록한 Redirect URI와 글자 단위로 동일 |
| `CAFE24_WEBHOOK_API_KEY` | 예 | 개발자센터 WebHook 인증정보 값 |
| `CAFE24_SCOPES` | 아니오 | 기본 `mall.read_product`. 개발자센터 권한관리와 반드시 일치 |
| `CAFE24_API_VERSION` | 아니오 | 기본 `2026-09-01`(2027-09-01까지 유효) |
| `DATABASE_URL` | 예(운영) | 토큰 저장용 Postgres. 없으면 메모리 저장소로 떨어져 서버리스에서 설치가 유지되지 않음 |

## 실행

Node 26 기준입니다. `mise.toml`에 툴체인을 고정했습니다.

```bash
npm install
npm run dev        # http://localhost:3000
```

| 스크립트 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 프로덕션 서버 |
| `npm test` | 계산·CSV·XLSX·launch·OAuth·웹훅 단위 테스트 (vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next 16 flat config) |

## 구조

```text
src/app/                        /, /demo, /demo/print, /api/* (HTTP 경계)
src/features/quotes/model.ts    QuoteDocument, 검증, 금액 계산
src/features/quotes/csv.ts      RFC 4180 CSV 파싱, 행별 오류
src/features/quotes/xlsx.ts     문서 → XLSX (문자열 셀 명시, 수식 없음)
src/features/quotes/print/      인쇄 레이아웃
src/features/quotes/demo/       편집 화면, Cafe24 상품 선택기
src/features/quotes/storage.ts  데모 문서 localStorage 보관
src/lib/cafe24.ts               OAuth·토큰·Admin API·상품/옵션 매핑
src/lib/launch.ts               launch hmac/timestamp 검증, 세션 쿠키
src/lib/store.ts                토큰 저장소(Postgres/메모리)
src/lib/token.ts                만료 임박 시 자동 갱신
src/fixtures/samples.ts         합성 상품 10개, 샘플/빈 문서
QA.md                           수동 검증표와 자동 검증 결과
```

## 앱 삭제·보관 정책

- 앱 삭제(90077)·만료(90078) 웹훅을 받으면 저장한 토큰을 삭제합니다. 견적 문서는 아직 서버에 저장하지 않으므로 함께 지울 것이 없습니다.
- 웹훅은 유실될 수 있으므로, 이미 삭제된 앱을 다시 실행하면 저장된 토큰이 401/403으로 거부되고 재동의 흐름으로 돌아갑니다.
- 서버 저장(초안·확정 버전)을 추가할 때 삭제·보관 기간 정책과 실제 동작을 함께 맞춥니다.

## 입력 규칙

- CSV 열: `item_code, product_name, option_name, quantity, unit_price` (`product_name`, `quantity`, `unit_price` 필수)
- 최대 1MB / 200행, UTF-8(BOM 허용), 인용부호·쉼표·개행 처리
- 품목 코드·옵션명은 선택이며 **앞자리 0을 문자열로 보존**합니다. 코드가 같아도 자동 병합하지 않습니다.
- 수량은 1 이상의 정수, 단가는 0 이상의 정수(원). 소수·음수·쉼표 포함 값은 행 오류로 표시합니다.
- 헤더 누락은 파일 전체를 거부하고, 행 오류는 줄 번호와 함께 모두 보여 준 뒤 **아무 행도 자동으로 가져오지 않습니다.** 사용자가 ‘오류 N행 제외하고 M행 가져오기’를 눌러야 반영됩니다.

## XLSX 라이브러리 결정

| 항목 | 내용 |
|---|---|
| 선택 | `xlsx` (SheetJS Community Edition) **0.18.5 고정** (`^` 없이 핀) |
| 라이선스 | Apache-2.0 |
| 브라우저 지원 | `XLSX.write({ type: "array" })`로 브라우저에서 바로 ArrayBuffer 생성, 서버 불필요 |
| 대안 | `exceljs`(MIT) — 기능은 충분하나 브라우저 번들이 크고 이 데모는 쓰기만 필요해 보류 |
| 주의 | npm에 공개된 0.18.5는 2022년 버전이고, **읽기(parse)** 경로에 알려진 취약점이 있습니다. 현재 코드는 사용자가 준 XLSX를 **읽지 않고 쓰기만** 하므로 영향 범위가 제한적입니다. 파일 가져오기 기능을 추가할 때 라이브러리를 재평가합니다. |

## 보안 관련 구현

- 문자열 셀은 `{ t: "s" }`로 명시해 `=`, `+`, `-`, `@`로 시작하는 상품명·메모가 Excel 수식으로 해석되지 않게 합니다. (테스트: `xlsx.test.ts`)
- 인쇄 화면은 React가 입력 문자열을 escape하며 임의 HTML을 렌더링하지 않습니다.
- 외부 URL·로고를 서버에서 가져오지 않습니다. 로고는 아직 없습니다.
- 다운로드 파일명은 문서번호에서 위험 문자를 제거해 만듭니다.
- launch의 `hmac`(HMAC-SHA256, 클라이언트 시크릿)과 ±2시간 `timestamp`를 검증하고, 쿼리의 `mall_id`를 신뢰하지 않습니다. 몰은 검증을 통과해 발급한 세션 쿠키에서만 꺼냅니다.
- OAuth `state`는 쿠키와 대조해 CSRF를 막습니다. 세션·state 쿠키는 httpOnly + secure + sameSite=lax입니다.
- 웹훅은 `X-API-Key`를 `timingSafeEqual`로 비교하고, 값이 없으면 아무 것도 하지 않습니다(실패 시 기본 거부).
- 상품·옵션 API는 세션이 없으면 401, 토큰이 없으면 409로 막고 `Cache-Control: no-store`로 응답합니다.
- 고객·주문 데이터를 조회하지 않고 고객 식별자 권한을 요청하지 않습니다. 토큰은 Postgres에만 저장하고 로그에 남기지 않습니다.
- `CAFE24_CLIENT_SECRET`은 서버 라우트에서만 읽습니다. 코드·커밋에 넣지 않습니다.

## 배포

Vercel에 배포합니다. 서버 라우트를 쓰므로 위 환경변수와 토큰용 Postgres가 필요합니다.

```bash
vercel --prod
```

토큰 저장은 `DATABASE_URL`이 가리키는 아무 Postgres나 됩니다(Neon 무료 티어 등). 테이블은 `cafe24_quotation_token`을 첫 요청 때 자동 생성합니다.

