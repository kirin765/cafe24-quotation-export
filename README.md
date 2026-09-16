# cafe24-quotation-export

Cafe24 B2B 판매자가 **상품·수량·협의 단가로 견적을 작성하고, 편집 가능한 XLSX와 인쇄용 PDF로 전달하기** 위한 로컬 데모입니다.

[`plan.md`](./plan.md)의 **A. 로컬 데모** 범위를 구현했습니다. 서버·DB·OAuth·Cafe24 연동 없이 합성 데이터로만 동작하며, 입력한 내용은 브라우저를 벗어나지 않습니다.

## 무엇을 하는가

- 합성 상품 10개를 기본으로 불러오고, CSV 파일 또는 붙여넣기로 품목을 추가합니다.
- 상품명·옵션·수량·협의 단가를 편집하고, 수신 회사명·유효기한·납기/배송 조건·가격 조건·비고를 입력합니다.
- 행 금액 = 수량 × 단가, 상품 합계 = 행 금액 합계, 견적 총액 = 상품 합계 + 조정 금액(필수 설명, 음수 할인 허용)으로 계산합니다.
- 같은 문서 데이터로 **XLSX 다운로드**와 **A4 인쇄 화면(PDF로 저장)** 을 만듭니다.

## 무엇을 하지 않는가

- PDF 파일을 버튼 하나로 직접 생성하지 않습니다. 인쇄 화면에서 브라우저의 ‘PDF로 저장’을 사용합니다.
- XLSX 합계는 숫자 값으로만 내보내며 **자동 재계산 수식을 넣지 않습니다.**
- 부가세를 자동 계산하지 않습니다. 가격 조건에 세금 포함 여부를 글로 적습니다.
- Cafe24 상품 API, OAuth, 견적 번호/버전 저장, 이전 견적 복제는 이 데모 범위가 아닙니다. (`plan.md` C 단계)
- 견적은 주문 전 제안이며 결제 완료나 주문 생성으로 표시하지 않습니다.

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

## 화면

| 경로 | 설명 |
|---|---|
| `/` | 범위와 사용 흐름 안내 |
| `/demo` | 견적 편집(문서 정보, 품목, 조정 금액, 합계 미리보기, 내보내기) |
| `/demo/print` | A4 인쇄 미리보기(`/demo`의 현재 문서를 localStorage에서 읽음) |

`plan.md`의 `/quotes`·`/settings`·`/quotes/[id]`는 서버 저장이 필요한 연동 MVP 범위라 데모에 포함하지 않았습니다.

## 구조

```text
src/app/                        /, /demo, /demo/print (HTTP 경계, 메타데이터)
src/features/quotes/model.ts    QuoteDocument, 검증, 금액 계산
src/features/quotes/csv.ts      RFC 4180 CSV 파싱, 행별 오류
src/features/quotes/xlsx.ts     문서 → XLSX (문자열 셀 명시, 수식 없음)
src/features/quotes/print/      인쇄 레이아웃
src/features/quotes/storage.ts  데모 문서 localStorage 보관
src/fixtures/samples.ts         합성 상품 10개, 샘플/빈 문서
QA.md                           수동 검증표와 자동 검증 결과
```

계산·문서 생성은 React와 분리되어 있어, CSV 데모를 그대로 Cafe24 상품 연동 버전으로 확장할 수 있습니다.

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
- 서버 저장·전송이 없어 tenant 격리·공유 캐시 문제는 이 범위에 존재하지 않습니다. 연동 MVP에서 다시 적용합니다.

## 배포

Vercel에 정적 페이지로 배포됩니다. 서버 환경변수·DB가 필요하지 않습니다.

```bash
vercel --prod
```
