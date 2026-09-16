# 카페24 견적 내보내기 — 스토어 등록 카피 (심사/스토어용)

## 앱 이름

- 후보: `카페24 견적 내보내기`(기본) / `견적서 자동 작성` / `B2B 견적 파일 내보내기`
- → **`카페24 견적 내보내기`** (저장소·개인정보처리방침과 동일)

## 한 줄 소개 (상세 설명 첫 줄)

> 상품을 고르고 협의 단가만 확인하면, 편집 가능한 XLSX와 인쇄용 PDF 견적서가 바로 만들어집니다.

## 상세 설명

```
거래처에 보낼 견적서, 상품 정보를 다시 입력하고 계셨나요?

【불러오기】 카페24에 등록된 상품·옵션을 검색해 견적 품목으로 가져옵니다.
【확인】 수량과 협의 단가, 배송·가격 조건만 확인해 고칩니다.
【내보내기】 같은 내용을 편집 가능한 XLSX와 A4 인쇄용 PDF로 만듭니다.

기능
- 상품명으로 검색해 품목 추가 (옵션이 있으면 옵션별 행)
- CSV 파일·붙여넣기로 품목 일괄 입력 (1MB·200행, 앞자리 0 보존)
- 품목·수량·단가·조정 금액(배송비·할인)을 한 화면에서 편집
- 견적 총액 미리보기, 필수값·범위 오류를 행별로 표시
- XLSX 내보내기 — 금액은 숫자 값, 수식 주입 방지
- A4 인쇄 화면에서 브라우저 'PDF로 저장'
- 초안 저장, 확정하면 그 시점 내용이 버전으로 남고 이후 수정과 분리
- 이전 견적을 복제해 새 견적 작성

견적은 주문 전 제안입니다. 결제 완료나 주문 생성으로 표시하지 않으며, 세금계산서를 대신하지 않습니다.
부가세는 자동 계산하지 않고 '가격 조건'에 세금 포함 여부를 적어 둡니다.
```

## 연관검색어

`견적서` `견적서 양식` `B2B 견적` `거래처 견적` `엑셀 견적서` `PDF 견적서` `도매 견적` `상품 견적`

## 앱 아이콘·배너

| 파일 | 용도 |
|---|---|
| `store-assets/icon-512.png` | 앱 아이콘(원본) |
| `store-assets/icon-256.png` | 앱 아이콘(등록용) |
| `store-assets/banner-740x416.png` | 스토어 배너 |

## 스크린샷 (스토어 '앱 스크린샷' 필드)

합성 샘플 데이터로만 촬영해 실제 거래처·개인정보가 들어가지 않습니다.

| # | 파일 | 내용 |
|---|---|---|
| 1 | `store-assets/screenshots/01-demo-editor.png` | 견적 편집 화면 전체 |
| 2 | `store-assets/screenshots/02-product-picker.png` | 상품 검색·옵션 선택 |
| 3 | `store-assets/screenshots/03-print-a4.png` | A4 인쇄 미리보기 |
| 4 | `store-assets/screenshots/04-quotes-list.png` | 저장한 견적 목록 |
| 5 | `store-assets/screenshots/05-confirmed-versions.png` | 확정 버전과 이력 |
| 6 | `store-assets/screenshots/06-settings.png` | 공급자 설정 |

재생성: `node store-assets/render-screenshots.mjs` (Playwright, 합성 데이터)

## 상세 설명 이미지 (심사 필수)

리뷰이사·순수익 앱의 반려 교훈(텍스트 위주·저해상도 캡처 반려)을 그대로 적용해
**디자인 PNG**로 만든다. `store-assets/detail-images.html`을 Playwright로 860px × 2배 → 1720px PNG로
렌더해 `public/store/`에 둔다.

| # | 파일 | 내용 |
|---|---|---|
| 1 | `public/store/detail-01.png` | 히어로 — 상품 고르고 단가만 확인 → XLSX·PDF |
| 2 | `public/store/detail-02.png` | 문제 — 상품 정보를 견적서에 다시 입력하는 반복 작업 |
| 3 | `public/store/detail-03.png` | 사용 흐름 4단계 |
| 4 | `public/store/detail-04.png` | 확정 버전 — 확정본은 바뀌지 않고 새 버전으로만 쌓임 |
| 5 | `public/store/detail-05.png` | 안전 — 고객 개인정보 미수집, 수식 주입 방지, 견적은 주문 전 제안 |

재생성: `node store-assets/render-detail-images.mjs`
