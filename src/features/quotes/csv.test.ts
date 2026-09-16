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

  it("단가·금액 열이 없으면 아무 행도 가져오지 않는다", () => {
    const result = parseItemCsv(`item_code,product_name,option_name\nA,상품,옵션\n`);
    expect(result.headerError).toMatch(/필수 열이 없습니다: unit_price/);
    expect(result.items).toHaveLength(0);
  });

  it("같은 뜻의 열이 중복되면 앞의 열을 쓰고 경고한다", () => {
    const result = parseItemCsv(`product_name,product_name,quantity,unit_price\n가,나,1,1000\n`);
    expect(result.headerError).toBeNull();
    expect(result.items[0].productName).toBe("가");
    expect(result.warnings.join(" ")).toContain("일부만 사용");
  });

  it("수량 열이 없으면 1로 채우고 경고한다(카페24 상품 목록 양식)", () => {
    const result = parseItemCsv(`상품코드,상품명,판매가\nP0000101,샘플 타월,5000\n`);
    expect(result.headerError).toBeNull();
    expect(result.errors).toHaveLength(0);
    expect(result.items[0]).toMatchObject({ quantity: 1, unitPrice: 5000 });
    expect(result.warnings.join(" ")).toContain("수량을 1로");
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

  it("카페24 상품 목록 양식(상품코드·상품명·공급가·판매가·옵션)을 읽는다", () => {
    const result = parseItemCsv(`상품코드,상품명,공급가,판매가,옵션,진열상태
P0000101,샘플 타월,3500.00,5000.00,화이트,T
P0000101,샘플 타월,3500.00,5000.00,네이비,T`);
    expect(result.headerError).toBeNull();
    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      itemCode: "P0000101",
      productName: "샘플 타월",
      optionName: "화이트",
      quantity: 1,
      unitPrice: 5000,
    });
  });

  it("일반 견적서 양식(품목·규격·수량·단가·공급가액·세액)을 읽고 세액은 무시한다", () => {
    const result = parseItemCsv(`품목,규격,수량,단가,공급가액,세액,비고
샘플 타월,화이트,10,5000,50000,5000,`);
    expect(result.headerError).toBeNull();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      productName: "샘플 타월",
      optionName: "화이트",
      quantity: 10,
      unitPrice: 5000,
    });
  });

  it("단가 열이 없으면 금액 ÷ 수량으로 단가를 계산하고 경고를 남긴다", () => {
    const result = parseItemCsv(`품명,규격,수량,공급가액
샘플 타월,화이트,10,50000`);
    expect(result.headerError).toBeNull();
    expect(result.items[0].unitPrice).toBe(5000);
    expect(result.warnings.join(" ")).toContain("금액 ÷ 수량");
  });

  it("금액이 수량으로 나누어떨어지지 않으면 조용히 반올림하지 않고 행 오류로 막는다", () => {
    const result = parseItemCsv(`품명,규격,수량,공급가액
샘플 타월,화이트,3,10000`);
    expect(result.items).toHaveLength(0);
    expect(result.errors[0]?.column).toBe("line_amount");
    expect(result.errors[0]?.message).toContain("나누어떨어지지");
  });

  it("같은 뜻의 열이 여럿이면 앞의 열을 쓰고 경고로 알린다", () => {
    const result = parseItemCsv(`상품명,품명,수량,단가
샘플 타월,무시됨,2,1000`);
    expect(result.headerError).toBeNull();
    expect(result.items[0].productName).toBe("샘플 타월");
    expect(result.warnings.join(" ")).toContain("일부만 사용");
  });

  it("소수점 표기(5000.00)와 천단위 쉼표(5,000)를 읽는다", () => {
    const result = parseItemCsv(`상품명,수량,판매가\n샘플 타월,10,5000.00\n샘플 컵,"1,200",3000.00\n`);
    expect(result.headerError).toBeNull();
    expect(result.errors).toHaveLength(0);
    expect(result.items[0]).toMatchObject({ quantity: 10, unitPrice: 5000 });
    expect(result.items[1]).toMatchObject({ quantity: 1200, unitPrice: 3000 });
  });

  it("소수 부분이 0이 아니면 조용히 반올림하지 않고 거부한다", () => {
    const result = parseItemCsv(`상품명,수량,판매가\n샘플 타월,10,5000.50\n`);
    expect(result.items).toHaveLength(0);
    expect(result.errors[0]?.column).toBe("unit_price");
  });

  it("공급가와 판매가가 함께 있으면 판매가를 쓴다(카페24 상품 엑셀)", () => {
    const result = parseItemCsv(`상품코드,상품명,공급가,판매가\nP0000101,샘플 타월,3500.00,5000.00\n`);
    expect(result.headerError).toBeNull();
    expect(result.items[0].unitPrice).toBe(5000);
    expect(result.warnings.join(" ")).toContain('unit_price은 "판매가" 사용');
  });

  it("빈 파일과 헤더만 있는 파일을 구분한다", () => {
    expect(parseItemCsv("").headerError).toBeTruthy();
    const headerOnly = parseItemCsv(`${HEADER}\n`);
    expect(headerOnly.headerError).toBeNull();
    expect(headerOnly.items).toHaveLength(0);
    expect(headerOnly.dataRowCount).toBe(0);
  });
});
