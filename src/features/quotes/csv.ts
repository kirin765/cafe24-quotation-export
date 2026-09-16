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

export type CsvCellError = {
  line: number;
  column: string;
  message: string;
};

export type CsvParseResult = {
  headerError: string | null;
  items: QuoteItem[];
  errors: CsvCellError[];
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
      dataRowCount: 0,
    };
  }

  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { headerError: "CSV 파일이 비어 있습니다.", items: [], errors, dataRowCount: 0 };
  }

  const header = rows[0].map(normalizeHeader);
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return {
      headerError: `필수 열이 없습니다: ${missing.join(", ")}. 사용 가능한 열: ${CSV_COLUMNS.join(
        ", ",
      )}`,
      items: [],
      errors,
      dataRowCount: 0,
    };
  }

  const duplicates = header.filter((column, i) => header.indexOf(column) !== i);
  if (duplicates.length > 0) {
    return {
      headerError: `헤더에 중복된 열이 있습니다: ${[...new Set(duplicates)].join(", ")}`,
      items: [],
      errors,
      dataRowCount: 0,
    };
  }

  const columnIndex = new Map<string, number>();
  header.forEach((column, i) => columnIndex.set(column, i));

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_CSV_ROWS) {
    return {
      headerError: `CSV 데이터는 ${MAX_CSV_ROWS}행 이하여야 합니다. (현재 ${dataRows.length}행)`,
      items: [],
      errors,
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
    const quantityRaw = value("quantity");
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
    if (!/^\d+$/.test(unitPriceRaw)) {
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
    dataRowCount: dataRows.length,
  };
}
