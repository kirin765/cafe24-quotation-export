import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

/**
 * 카페24 스토어 등록 폼의 FAQ 가져오기용 파일을 만든다.
 * 내려받은 샘플(`faq_sample_ko.xlsx`)의 형식 그대로 `제목`/`내용` 두 열만 쓴다.
 *
 *   node store-assets/render-faq.mjs
 *
 * .xlsx(샘플과 같은 형식)와 .csv(UTF-8)를 함께 만든다. 폼의 버튼은 'Import CSV'지만
 * 내려받은 샘플이 .xlsx이므로 둘 다 준비해 두고, 실패하면 나머지 하나를 쓴다.
 */
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "store-assets");

/** 실제 동작과 어긋나지 않는 답변만 적는다. 기능이 바뀌면 여기도 함께 고친다. */
const FAQ = [
  [
    "견적서를 파일로 받을 수 있나요?",
    "네. 같은 내용을 편집 가능한 XLSX와 A4 인쇄용 PDF로 내보냅니다. PDF는 인쇄 전용 화면에서 브라우저의 ‘PDF로 저장’을 사용합니다.",
  ],
  [
    "상품을 일일이 입력해야 하나요?",
    "아니요. 쇼핑몰에 등록된 상품·옵션을 검색해 견적 품목으로 가져옵니다. 이미 쓰던 CSV나 엑셀 파일을 올려도 되고, .csv와 .xlsx를 읽습니다.",
  ],
  [
    "엑셀에서 수량이나 단가를 고치면 합계도 바뀌나요?",
    "XLSX는 견적 시점의 금액을 숫자 값으로 담고 수식은 넣지 않습니다. 자동으로 다시 계산되지 않는다는 안내를 파일 안에 적어 두었고, 재계산이 필요하면 앱에서 수정한 뒤 다시 내보내면 됩니다.",
  ],
  [
    "부가세도 계산해 주나요?",
    "자동 계산하지 않습니다. ‘가격 조건’에 세금 포함 여부를 적어 두고, 배송비나 할인은 조정 금액으로 더하거나 뺍니다. 세금계산서를 대신하지 않습니다.",
  ],
  [
    "불러온 상품 판매가와 실제 협의 단가가 다른데요?",
    "불러온 판매가는 쿠폰·회원가·옵션 추가금이 반영되기 전 값이라 제안값입니다. 화면에도 그렇게 표시되며, 운영자가 확인한 협의 단가로 고쳐 확정합니다.",
  ],
  [
    "확정한 견적을 나중에 고치면 어떻게 되나요?",
    "확정본은 그 시점의 내용(공급자 정보·품목명·단가·합계)을 그대로 보관하고 바뀌지 않습니다. 수정한 내용은 다시 확정할 때 새 버전으로 쌓입니다.",
  ],
  [
    "두 사람이 같은 견적을 동시에 고치면요?",
    "먼저 저장한 내용을 기준으로 충돌을 알려 주고, 늦은 저장이 새 내용을 덮어쓰지 않습니다. 최신 내용을 불러와 비교한 뒤 저장할 수 있습니다.",
  ],
  [
    "견적 여러 건을 따로 관리할 수 있나요?",
    "네. 몰별로 목록이 분리되고, 수신처나 문서번호로 검색할 수 있습니다. 이전 견적을 복제해 새 견적을 만들 수도 있습니다.",
  ],
  [
    "어떤 권한을 요청하나요?",
    "상품 조회(mall.read_product)와 앱 설치 정보뿐입니다. 주문·회원 정보는 조회하지 않고, 고객 식별자 권한도 요청하지 않습니다.",
  ],
  [
    "인쇄하면 A4에 맞고 긴 품목명도 잘리지 않나요?",
    "인쇄 전용 화면은 A4 규격으로 만들었습니다. 품목이 많으면 여러 페이지로 나뉘고, 긴 상품명은 줄바꿈되어 잘리지 않습니다.",
  ],
  [
    "앱을 삭제하면 만든 견적은 어떻게 되나요?",
    "저장된 카페24 접근 토큰은 삭제·만료 알림을 받으면 바로 지웁니다. 견적은 몰별로 보관되어 앱을 다시 설치하면 그대로 보이며, 앱에서 직접 삭제할 수도 있습니다.",
  ],
  [
    "설치 후 바로 사용할 수 있나요?",
    "카페24 관리자에서 앱을 실행하면 상품 조회 권한에 동의한 뒤 바로 견적 목록이 열립니다. 별도 준비물이나 외부 서비스가 필요하지 않습니다.",
  ],
];

const rows = [["제목", "내용"], ...FAQ];

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
const xlsxPath = path.join(outDir, "faq_ko.xlsx");
XLSX.writeFile(workbook, xlsxPath);
console.log(`${xlsxPath}  FAQ ${FAQ.length}건`);

const escapeCell = (value) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const csvPath = path.join(outDir, "faq_ko.csv");
fs.writeFileSync(csvPath, rows.map((row) => row.map(escapeCell).join(",")).join("\n"), "utf8");
console.log(`${csvPath}  UTF-8`);
