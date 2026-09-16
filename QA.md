# QA — 로컬 데모

- 작성일: 2026-09-16 (연동 MVP 검증 추가)
- 대상: `/demo`, `/demo/print`, `/api/auth/*`, `/api/cafe24/*`, `/api/webhooks/cafe24`
- 설치 한도 소모: **없음** (자동 검증은 모두 로컬/스텁이며 실제 몰에 설치하지 않음)

문서는 세 종류로 검증했습니다.

1. **자동 테스트** — `npm test` (계산·CSV·XLSX·launch·OAuth·웹훅 67개), `npm run typecheck`, `npm run lint`, `npm run build`
2. **브라우저 확인** — Playwright(Chromium)로 실제 편집·다운로드·인쇄 흐름 확인, PDF는 `pdftotext`/`pdfinfo`/`pdffonts`로 내용·페이지·폰트 확인
3. **HTTP 라우트 확인** — 프로덕션 빌드를 띄우고 `/api/auth/install`·`/api/auth/callback`·`/api/cafe24/session`·`/api/cafe24/products`·`/api/webhooks/cafe24`에 직접 요청 (20개 확인)

## 2차: 연동(OAuth·상품 조회) 검증

| # | 시나리오 | 기대값 | 결과 |
|---|---|---|---|
| 20 | launch 요청에 파라미터가 없음 | 401 | 통과 (HTTP) |
| 21 | launch hmac을 다른 시크릿으로 서명 | 401 | 통과 (HTTP·단위) |
| 22 | launch hmac 정상(공백·한글 포함 쿼리) | mall_id 반환 | 통과 (단위) |
| 23 | launch timestamp가 ±2시간 초과 | 401 | 통과 (단위) |
| 24 | launch 정상 → OAuth authorize | 302/307, `https://{mall}.cafe24api.com/api/v2/oauth/authorize` | 통과 (HTTP) |
| 25 | authorize 요청의 scope·redirect_uri·response_type·state | `mall.read_product`, 등록한 Redirect URI와 동일, `code`, `mall_id:`로 시작 | 통과 (HTTP) |
| 26 | authorize 응답의 state/mall 쿠키 | cq_state·cq_mall 설정, httpOnly | 통과 (HTTP) |
| 27 | 토큰 교환 요청 형식 | POST `/oauth/token`, Basic 인증, `grant_type=authorization_code`, `code`, `redirect_uri` | 통과 (stub fetch) |
| 28 | 갱신 요청 형식 | `grant_type=refresh_token` | 통과 (stub fetch) |
| 29 | 타임존 없는 KST 만료시각 | +09:00으로 보정해 9시간 밀리지 않음 | 통과 (단위·stub) |
| 30 | 만료 5분 전 토큰 | 갱신 후 새 토큰을 저장 | 통과 (stub fetch) |
| 31 | 갱신 실패(리프레시 만료) | 낡은 토큰을 돌려주지 않고 null | 통과 (stub fetch) |
| 32 | 상품 목록 요청 | `/admin/products`, `limit`·`offset`·`fields`, `Bearer`, `X-Cafe24-Api-Version` | 통과 (stub fetch) |
| 33 | limit/offset 안전 범위 | 1~100, 0~5000으로 클램프 | 통과 (stub fetch) |
| 34 | 옵션 조회 | `/admin/products/{no}/options` | 통과 (stub fetch) |
| 35 | 상품 응답의 문자열 숫자 | 숫자로 변환, 없는 필드는 빈 문자열 | 통과 (단위) |
| 36 | 403(권한 없음)·401 응답 | 상태코드와 본문을 담아 예외 | 통과 (stub fetch) |
| 37 | 세션이 없을 때 상품/옵션 API | 401 | 통과 (HTTP) |
| 38 | 웹훅 X-API-Key 없음/불일치 | 401, 토큰 유지 | 통과 (HTTP·단위) |
| 39 | 웹훅 90077(앱 삭제) | 200, 토큰 삭제 | 통과 (HTTP·단위) |
| 40 | 웹훅 90078(앱 만료) | 200, 토큰 삭제 | 통과 (단위) |
| 41 | 웹훅 기타 이벤트 | 200, 토큰 유지 | 통과 (단위) |
| 42 | 웹훅 mall_id 없음 / JSON 아님 | 400 | 통과 (단위) |
| 43 | 콜백 state 불일치 | 400 + 사람이 읽는 안내(보안 검증 실패) | 통과 (HTTP) |
| 44 | 미설치 브라우저의 `/demo` | "설치된 쇼핑몰 세션이 없어 CSV와 수동 입력만" 안내, 기존 계산 888,700원 유지, 콘솔 오류 없음 | 통과 (브라우저) |

## 자동 테스트 실행 결과

```text
npm test           67 passed (model 12, csv 9, xlsx 5, launch 9, cafe24 매핑 8,
                              OAuth/상품 fetch 8, token 5, webhook 7 … )
npm run typecheck  통과
npm run lint       통과 (오류 0)
npm run build      통과 (/ , /demo, /demo/print + API 라우트 7개)
브라우저 확인       14/14, PDF 확인 8/8, 라우트 확인 20/20, 상품 선택기 3/3
```

## 사람이 직접 확인해야 하는 항목

- **실제 Cafe24 테스트몰에서 설치 → 실행 → 상품 검색 → 견적 출력** (plan.md C 완료 조건). 자동 검증은 스텁이라 실몰 동작·설치 한도 소모는 확인하지 않았습니다.
- 실사용 운영자의 익명 품목표를 변환해 기존 Cafe24 기본 출력과 비교 (`plan.md` B 단계)
- 인쇄 대화상자에서 실제 프린터/PDF 저장 동작(운영체제·브라우저별 여백)
- 멀티쇼핑몰(`shop_no`) 상품 구분이 실제로 필요한지와 호출 제한 체감

## 이번 범위에서 검증하지 않은 것

- 초안 저장·확정 snapshot·견적 번호/버전·복제 (서버 저장 미구현)
- tenant 간 접근 차단(현재는 몰별 토큰만 분리, 견적 문서는 서버에 없음)
- 자동 부가세 계산·세금계산서 적합성 (기능 자체를 제외)
- 상품 5,000개 초과 시 `offset` 한계(`sin_product_no` 방식) — 상품 수가 많으면 별도 확인 필요

## 1차: 로컬 데모 검증 (CSV → XLSX/PDF)

## 수동 시나리오와 기대값

| # | 시나리오 | 기대값 | 결과 |
|---|---|---|---|
| 1 | `npm install && npm run dev` 후 `/demo` 접속 | 합성 상품 10행과 총액 888,700원(배송비 3,000원 포함) 표시 | 통과 (자동) |
| 2 | 합성 상품 10개 상태에서 총액 확인 | 상품 합계 885,700원 + 조정 3,000원 = 888,700원, 화면·XLSX·PDF 동일 | 통과 (자동) |
| 3 | 계획서 계산 사례(10×5,000 + 20×3,000 + 3,000) | 110,000원 → 113,000원 | 통과 (단위 테스트) |
| 4 | 수량·단가 수정 | 행 금액 = 수량 × 단가, 합계 즉시 갱신 | 통과 |
| 5 | 상품명 비움 / 수량 0 / 단가 소수 입력 | 행별 오류 메시지, `확인 필요 N건`, XLSX·인쇄 차단 | 통과 |
| 6 | 조정 금액에 설명 없이 금액만 입력 | 오류 표시, 내보내기 차단 | 통과 (단위 테스트) |
| 7 | 할인으로 총액이 음수 | `조정 후 총액은 0원보다 작을 수 없습니다.` 표시 | 통과 (단위 테스트) |
| 8 | CSV 파일 가져오기(`item_code,product_name,option_name,quantity,unit_price`) | 2행 추가, `000123` 앞자리 0 보존 | 통과 (자동) |
| 9 | BOM + 인용부호 쉼표 + 인용부호 안 개행이 있는 CSV | 값이 깨지지 않고 그대로 유지 | 통과 (자동, 단위 테스트) |
| 10 | 필수 헤더 누락 CSV | 파일 전체 거부, 사유 표시, 아무 행도 추가되지 않음 | 통과 (단위 테스트) |
| 11 | 일부 행에 오류가 있는 CSV | 줄 번호·열·사유를 모두 표시, **자동으로 일부만 가져오지 않음**, 사용자가 ‘오류 N행 제외하고 M행 가져오기’를 눌러야 반영 | 통과 |
| 12 | 200행 초과 CSV | `CSV 데이터는 200행 이하여야 합니다.` 로 전체 거부 | 통과 (단위 테스트) |
| 13 | XLSX 다운로드 | `견적서_<문서번호>_v<버전>.xlsx`, 숫자 셀은 숫자, 합계·문서번호·안내 문구 포함 | 통과 (자동, 실제 파일 재파싱) |
| 14 | 상품명 `=1+1`, `+SUM(...)`, `@cmd` | 문자열 셀(`t: "s"`)로 기록, 수식 셀 0개 | 통과 (단위 테스트) |
| 15 | 인쇄 화면 `/demo/print` | 문서번호·버전·작성시각, 888,700원, 원화 합계, PDF 저장 안내 표시 | 통과 (자동) |
| 16 | 긴 상품명 + 70행 인쇄 | 여러 페이지로 분할되고 잘리지 않음 | 통과 (자동, A4 6페이지) |
| 17 | 한글 PDF 출력 | 한글이 깨지지 않고 폰트가 임베드됨 | 통과 (자동, `pdffonts`) |
| 18 | 새로고침 후 인쇄 화면 | 마지막 편집 내용이 유지됨(localStorage) | 통과 |
| 19 | 브라우저 콘솔 | 페이지 오류 없음 | 통과 (자동) |
