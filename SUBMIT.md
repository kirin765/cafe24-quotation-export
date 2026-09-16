# 카페24 견적 내보내기 — 심사 제출 절차 (사용자 핸드오프)

순수익 앱(2회 반려)과 리뷰이사에서 얻은 교훈을 그대로 적용한다. 특히 **(1) 상세 설명 이미지 필수**,
**(2) scope 요청값 = 개발자센터 권한관리 선택값**, **(3) App URL은 launch 엔드포인트**가 반려를 가른다.

## 0. 현재 상태 (2026-09-16)

- 코드: 데모 + 연동 MVP + 초안/확정 버전까지 구현, Vercel 배포 완료
- 앱 등록: Web application(Authorization Code), 운영자 권한 `상품(Product) 읽기` + `앱(Application)`, 고객 권한 없음
- 테스트몰 설치·상품 선택·저장·확정·출력 확인 완료
- 토큰 저장: Vercel Storage `cafe24-quotation-export-db`(Neon)

## 1. 개발자센터에서 확인할 것 (사용자 입력)

| 항목 | 값 | 비고 |
|---|---|---|
| App URL | `https://cafe24-quotation-export.vercel.app/api/auth/install` | ⚠️ 랜딩(`/`)이나 `/demo`가 아니어야 한다. launch 파라미터(hmac·mall_id)를 받는 엔드포인트다 |
| Redirect URI | `https://cafe24-quotation-export.vercel.app/api/auth/callback` | 개발자센터 등록값과 **글자 단위로** 같아야 한다 |
| 권한관리(운영자) | `mall.read_product`, 앱(Application) | 코드가 요청하는 scope(`CAFE24_SCOPES` 기본 `mall.read_product`)와 **일치**해야 한다 |
| 권한관리(고객) | 선택 없음 | 고객 식별자 권한을 요청하지 않는다 |
| WebHook | 앱 삭제(90077), 앱 만료(90078) → `https://cafe24-quotation-export.vercel.app/api/webhooks/cafe24` | 인증정보 값이 Vercel `CAFE24_WEBHOOK_API_KEY`와 같아야 한다 |
| Front API | 사용안함 | Admin API만 쓴다 |

Vercel 환경변수(production): `CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`, `CAFE24_REDIRECT_URI`,
`CAFE24_WEBHOOK_API_KEY`, `CAFE24_SCOPES`, `CAFE24_API_VERSION`, `DATABASE_URL`.

## 2. 제출 전 자기 시험 (순서대로)

1. 테스트몰에서 **앱 삭제 → 재실행 → 동의 → `/quotes`** 까지 완주 (scope 불일치·토큰 잔존 확인)
2. 앱 재실행 시 **재동의 없이** 바로 들어오는지 확인 (토큰 살아있으면 재동의하지 않는다)
3. 상품 검색 → 옵션별 행 추가 → 수량·단가 수정 → 저장 → 확정 → 확정본 인쇄·XLSX
4. 다른 몰(또는 다른 몰 계정)에서 이 몰의 견적 URL을 열어 **404**인지 확인
5. 브라우저 콘솔 오류 0건, 인쇄 미리보기에서 한글·여러 페이지 확인

## 3. 등록물

- 카피: `store-assets/store-listing-copy.md`
- 아이콘·배너: `store-assets/icon-512.png`, `icon-256.png`, `banner-740x416.png`
- 스크린샷(합성 데이터): `store-assets/screenshots/`
- **상세 설명 이미지(심사 필수)**: `public/store/detail-01..05.png` — 텍스트 위주로 내면 반려된다
- 개인정보처리방침: `https://cafe24-quotation-export.vercel.app/privacy`
- 지원 안내: 개인정보처리방침 7항의 문의 이메일 / 스토어 지원 이메일 동일하게

## 4. 반려 사유 대응표 (선제 점검)

| 반려 유형 | 이 앱에서 확인할 것 |
|---|---|
| 상세 설명 부실 | 1720px 디자인 PNG 5장 + 기능·제외 범위 명시 (문의처 포함) |
| 기능 완성도 | 빈 화면·미완성 버튼 없음. 서버 저장·확정·복제·출력 모두 동작 |
| 파라미터 전달 | App URL이 `/api/auth/install`이고, launch hmac·timestamp 검증을 통과해야 화면이 뜬다 |
| scope 불일치 | 개발자센터 권한관리 = `CAFE24_SCOPES`. 불일치 시 `The scope added by Cafe24 Developers is invalid` |
| 설치 한도 초과 | 테스트 설치는 기본 5회. 테스트몰 설치를 아껴 쓰고, 반복 시험은 `/demo`(서버 저장 없음)로 |
| 개인정보 | `/privacy`에 수집·미수집·보관·파기 명시. 고객 개인정보를 요청하지 않음 |

## 5. 아직 하지 않은 것 (출시 전 결정 필요)

- 요금·무료 한도·결제·해지 정책 (plan.md D, 유료 시험 전 확정)
- 파일럿 몰·기간·지원 범위·지원 응답시간 상한
- 견적서 로고 이미지 (형식·크기 제한과 재인코딩 필요, XLSX는 SheetJS CE가 이미지 삽입을 지원하지 않아 인쇄물에만 반영됨)
- 측정: 견적 작성/수정 시간, 실제 사용 건수, 출력 오류, 지원시간
