import {
  MAX_CODE_LENGTH,
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  MAX_NAME_LENGTH,
  MAX_QUANTITY,
  MAX_UNIT_PRICE,
  newId,
  type QuoteItem,
} from "./model";

export const CSV_COLUMNS = [
  "item_code",
  "product_name",
  "option_name",
  "quantity",
  "unit_price",
] as const;

const REQUIRED_COLUMNS = ["product_name", "quantity", "unit_price"] as const;

/**
 * 실제 운영자가 가진 파일의 열 이름을 받아들인다.
 * - 카페24 상품 목록 '엑셀 다운로드' 양식(상품코드·상품명·공급가·판매가 등)
 * - 일반 견적서 양식(품목·규격·수량·단가·공급가액·세액)
 * 같은 열이 여러 개면 먼저 나온 열을 쓰고 나머지는 경고로 알린다(조용히 버리지 않는다).
 */
const HEADER_ALIASES: Record<string, string> = {
  상품코드: "item_code",
  상품번호: "item_code",
  품목코드: "item_code",
  자체상품코드: "item_code",
  자체품목코드: "item_code",
  코드: "item_code",
  상품명: "product_name",
  품명: "product_name",
  품목: "product_name",
  품목명: "product_name",
  상품: "product_name",
  제품명: "product_name",
  옵션: "option_name",
  옵션명: "option_name",
  규격: "option_name",
  옵션값: "option_name",
  수량: "quantity",
  주문수량: "quantity",
  단가: "unit_price",
  공급가: "unit_price",
  판매가: "unit_price",
  공급단가: "unit_price",
  판매단가: "unit_price",
  기준단가: "unit_price",
  금액: "line_amount",
  공급가액: "line_amount",
  합계: "line_amount",
  품목금액: "line_amount",
};

const normalizeColumn = (value: string) =>
  value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_\-()]/g, "");

const CANONICAL_BY_NORMALIZED = new Map(
  CSV_COLUMNS.map((column) => [normalizeColumn(column), column] as const),
);

function resolveColumn(header: string): string | null {
  const normalized = normalizeColumn(header);
  if (normalized === "") {
    return null;
  }
  return CANONICAL_BY_NORMALIZED.get(normalized) ?? HEADER_ALIASES[normalized] ?? null;
}

export type CsvCellError = {
  line: number;
  column: string;
  message: string;
};

export type CsvParseResult = {
  headerError: string | null;
  items: QuoteItem[];
  errors: CsvCellError[];
  /** 가져오기는 하되 사용자가 알아야 하는 사실(단가 환산, 중복 열 무시 등). */
  warnings: string[];
  dataRowCount: number;
};

export const CSV_TEMPLATE = `item_code,product_name,option_name,quantity,unit_price
SAMPLE-001,샘플 타월,화이트,10,5000
SAMPLE-002,샘플 컵,300ml,20,3000
`;

/**
 * RFC 4180 parser: quoted fields, escaped quotes, commas and newlines inside
 * quotes, CRLF/LF line endings, leading BOM and trailing empty lines.
 */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let index = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    pushField();
    const isBlank = row.every((cell) => cell.trim() === "");
    if (!isBlank) {
      rows.push(row);
    }
    row = [];
  };

  while (index < input.length) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
      index += 1;
      continue;
    }

    if (char === ",") {
      pushField();
      index += 1;
      continue;
    }

    if (char === "\n") {
      pushRow();
      index += 1;
      continue;
    }

    if (char === "\r") {
      if (input[index + 1] === "\n") {
        pushRow();
        index += 2;
        continue;
      }
      pushRow();
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (field !== "" || row.length > 0) {
    pushRow();
  }

  return rows;
}

export function csvByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

export function parseItemCsv(text: string): CsvParseResult {
  const errors: CsvCellError[] = [];
  const items: QuoteItem[] = [];

  if (csvByteLength(text) > MAX_CSV_BYTES) {
    return {
      headerError: `CSV 파일은 ${Math.round(MAX_CSV_BYTES / 1024)}KB 이하여야 합니다.`,
      items: [],
      errors,
      warnings: [],
      dataRowCount: 0,
    };
  }

  const rows = parseCsv(text);
  if (rows.length === 0) {
    return {
      headerError: "CSV 파일이 비어 있습니다.",
      items: [],
      errors,
      warnings: [],
      dataRowCount: 0,
    };
  }

  const header = rows[0].map(normalizeHeader);
  const columnIndex = new Map<string, number>();
  const warnings: string[] = [];
  const ignored: string[] = [];

  header.forEach((raw, index) => {
    const column = resolveColumn(raw);
    if (!column) {
      return;
    }
    if (columnIndex.has(column)) {
      ignored.push(`"${raw}" (${column} 열이 이미 있음)`);
      return;
    }
    columnIndex.set(column, index);
  });

  const hasUnitPrice = columnIndex.has("unit_price");
  const hasLineAmount = columnIndex.has("line_amount");
  const hasQuantity = columnIndex.has("quantity");
  const missing = REQUIRED_COLUMNS.filter(
    (column) =>
      column === "product_name"
        ? !columnIndex.has("product_name")
        : column === "quantity"
          ? false
          : !hasUnitPrice && !hasLineAmount,
  );
  if (missing.length > 0) {
    return {
      headerError: `필수 열이 없습니다: ${missing.join(
        ", ",
      )}. 쓸 수 있는 이름: ${CSV_COLUMNS.join(", ")} 또는 상품명·품명·품목 / 수량 / 단가·공급가·판매가, 금액·공급가액`,
      items: [],
      errors,
      warnings,
      dataRowCount: 0,
    };
  }

  if (!hasUnitPrice && hasLineAmount) {
    warnings.push("단가 열이 없어 금액 ÷ 수량으로 단가를 계산했습니다.");
  }
  if (!hasQuantity) {
    warnings.push("수량 열이 없어 모든 행의 수량을 1로 채웠습니다. 표에서 수정하세요.");
  }
  if (ignored.length > 0) {
    warnings.push(`같은 뜻의 열이 여럿이라 앞의 열만 사용했습니다: ${ignored.join(", ")}`);
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_CSV_ROWS) {
    return {
      headerError: `CSV 데이터는 ${MAX_CSV_ROWS}행 이하여야 합니다. (현재 ${dataRows.length}행)`,
      items: [],
      errors,
      warnings,
      dataRowCount: dataRows.length,
    };
  }

  dataRows.forEach((cells, rowIndex) => {
    const line = rowIndex + 2;
    const value = (column: string): string => {
      const position = columnIndex.get(column);
      if (position === undefined) {
        return "";
      }
      return (cells[position] ?? "").trim();
    };

    if (cells.length > header.length) {
      errors.push({
        line,
        column: "-",
        message: `열 개수가 헤더(${header.length}개)보다 많습니다. 쉼표가 인용부호 없이 들어갔는지 확인하세요.`,
      });
      return;
    }

    const productName = value("product_name");
    const itemCode = value("item_code");
    const optionName = value("option_name");
    const quantityRaw = hasQuantity ? value("quantity") : "1";
    const unitPriceRaw = value("unit_price");

    let rowHasError = false;
    const pushError = (column: string, message: string) => {
      rowHasError = true;
      errors.push({ line, column, message });
    };

    if (productName === "") {
      pushError("product_name", "상품명이 비어 있습니다.");
    } else if (productName.length > MAX_NAME_LENGTH) {
      pushError("product_name", `상품명은 ${MAX_NAME_LENGTH}자 이하여야 합니다.`);
    }

    if (itemCode.length > MAX_CODE_LENGTH) {
      pushError("item_code", `품목 코드는 ${MAX_CODE_LENGTH}자 이하여야 합니다.`);
    }

    if (optionName.length > MAX_NAME_LENGTH) {
      pushError("option_name", `옵션명은 ${MAX_NAME_LENGTH}자 이하여야 합니다.`);
    }

    let quantity = 0;
    if (!/^\d+$/.test(quantityRaw)) {
      pushError("quantity", "수량은 1 이상의 정수여야 합니다. (빈 값·소수·음수 불가)");
    } else {
      quantity = Number.parseInt(quantityRaw, 10);
      if (quantity < 1) {
        pushError("quantity", "수량은 1 이상이어야 합니다.");
      } else if (quantity > MAX_QUANTITY) {
        pushError("quantity", `수량은 ${MAX_QUANTITY.toLocaleString("ko-KR")} 이하여야 합니다.`);
      }
    }

    let unitPrice = 0;
    if (!hasUnitPrice) {
      // 금액 열만 있는 견적서 양식: 수량으로 나누어떨어질 때만 단가로 환산한다(조용한 반올림 금지).
      const amountRaw = value("line_amount");
      if (!/^\d+$/.test(amountRaw)) {
        pushError("line_amount", "금액은 0 이상의 정수(원)여야 합니다.");
      } else if (/^\d+$/.test(quantityRaw) && quantity > 0) {
        const amount = Number.parseInt(amountRaw, 10);
        if (amount % quantity !== 0) {
          pushError(
            "line_amount",
            `금액 ${amount}원이 수량 ${quantity}로 나누어떨어지지 않아 단가를 계산할 수 없습니다. 단가 열을 넣어 주세요.`,
          );
        } else {
          unitPrice = amount / quantity;
          if (unitPrice > MAX_UNIT_PRICE) {
            pushError(
              "unit_price",
              `계산한 단가가 ${MAX_UNIT_PRICE.toLocaleString("ko-KR")}원을 넘습니다.`,
            );
          }
        }
      }
    } else if (!/^\d+$/.test(unitPriceRaw)) {
      pushError("unit_price", "단가는 0 이상의 정수(원)여야 합니다. (소수·쉼표·통화기호 불가)");
    } else {
      unitPrice = Number.parseInt(unitPriceRaw, 10);
      if (unitPrice > MAX_UNIT_PRICE) {
        pushError("unit_price", `단가는 ${MAX_UNIT_PRICE.toLocaleString("ko-KR")}원 이하여야 합니다.`);
      }
    }

    if (rowHasError) {
      return;
    }

    items.push({
      id: newId(),
      itemCode,
      productName,
      optionName,
      quantity,
      unitPrice,
    });
  });

  return {
    headerError: null,
    items,
    errors,
    warnings,
    dataRowCount: dataRows.length,
  };
}
