import { describe, expect, it } from "vitest";
import { parseCsv, parseItemCsv } from "./csv";
import { MAX_CSV_ROWS } from "./model";

const HEADER = "item_code,product_name,option_name,quantity,unit_price";

describe("CSV 파서", () => {
  it("BOM과 CRLF를 처리한다", () => {
    const rows = parseCsv(`\uFEFF${HEADER}\r\nA,상품,옵션,1,1000\r\n`);
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe("item_code");
    expect(rows[1][2]).toBe("옵션");
  });

  it("인용부호 안의 쉼표와 개행을 보존한다", () => {
    const rows = parseCsv(
      `${HEADER}\n"A-1","이름, 쉼표",\"따옴표\"\"포함\",2,"3000"\n"A-2","여러\n줄",옵션,3,4000\n`,
    );
    expect(rows).toHaveLength(3);
    expect(rows[1][1]).toBe("이름, 쉼표");
    expect(rows[1][2]).toBe('따옴표"포함');
    expect(rows[2][1]).toBe("여러\n줄");
  });
});

describe("품목 CSV 가져오기", () => {
  it("정상 행을 숫자로 변환한다", () => {
    const result = parseItemCsv(`${HEADER}\nSAMPLE-001,샘플 타월,화이트,10,5000\n`);
    expect(result.headerError).toBeNull();
    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      itemCode: "SAMPLE-001",
      productName: "샘플 타월",
      quantity: 10,
      unitPrice: 5000,
    });
  });

  it("품목 코드 앞자리 0을 문자열로 보존한다", () => {
    const result = parseItemCsv(`${HEADER}\n000123,상품,옵션,1,1000\n`);
    expect(result.items[0].itemCode).toBe("000123");
  });

  it("필수 열이 없으면 아무 행도 가져오지 않는다", () => {
    const result = parseItemCsv(`item_code,product_name,option_name\nA,상품,옵션\n`);
    expect(result.headerError).toContain("quantity");
    expect(result.items).toHaveLength(0);
  });

  it("중복 헤더를 거부한다", () => {
    const result = parseItemCsv(`product_name,product_name,quantity,unit_price\n가,나,1,1000\n`);
    expect(result.headerError).toContain("중복");
  });

  it("행별 오류를 줄 번호와 함께 모으고 유효 행만 통과시킨다", () => {
    const csv = [
      HEADER,
      "A-1,정상,옵션,10,5000",
      "A-2,,옵션,2,3000",
      "A-3,수량오류,옵션,0,3000",
      "A-4,단가오류,옵션,2,3.5",
      "A-5,쉼표,옵션,2,1000,extra",
    ].join("\n");
    const result = parseItemCsv(csv);
    expect(result.headerError).toBeNull();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].productName).toBe("정상");
    expect(result.errors.map((error) => error.line)).toEqual([3, 4, 5, 6]);
    expect(result.errors.every((error) => error.message.length > 0)).toBe(true);
  });

  it("데이터 행이 상한을 넘으면 거부한다", () => {
    const rows = [HEADER];
    for (let i = 0; i < MAX_CSV_ROWS + 1; i += 1) {
      rows.push(`A-${i},상품,옵션,1,1000`);
    }
    const result = parseItemCsv(rows.join("\n"));
    expect(result.headerError).toContain(`${MAX_CSV_ROWS}행`);
    expect(result.items).toHaveLength(0);
  });

  it("빈 파일과 헤더만 있는 파일을 구분한다", () => {
    expect(parseItemCsv("").headerError).toBeTruthy();
    const headerOnly = parseItemCsv(`${HEADER}\n`);
    expect(headerOnly.headerError).toBeNull();
    expect(headerOnly.items).toHaveLength(0);
    expect(headerOnly.dataRowCount).toBe(0);
  });
});
