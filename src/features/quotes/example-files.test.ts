import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseItemCsv } from "./csv";

/**
 * 실제 운영자가 가진 파일 형식을 흉내낸 예시(fixtures/examples)가 그대로 들어오는지 확인한다.
 * 실제 파일을 받기 전까지의 대체 검증이며, 받으면 그 파일로 같은 확인을 다시 한다.
 */
const dir = path.resolve(__dirname, "../../../fixtures/examples");
const read = (name: string) => fs.readFileSync(path.join(dir, name), "utf8");

describe("실제 형식 예시 파일", () => {
  it("카페24 상품 목록 양식", () => {
    const result = parseItemCsv(read("cafe24-product-export.csv"));
    expect(result.headerError).toBeNull();
    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(5);
    expect(result.items.map((item) => item.itemCode)).toEqual([
      "P0000101",
      "P0000101",
      "P0000102",
      "P0000103",
      "P0000104",
    ]);
    expect(result.items[0].unitPrice).toBe(3500);
    expect(result.items.filter((item) => item.optionName === "").length).toBe(1);
  });

  it("일반 견적서 양식", () => {
    const result = parseItemCsv(read("quote-standard.csv"));
    expect(result.headerError).toBeNull();
    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(3);
    expect(result.items[2]).toMatchObject({ productName: "샘플 에코백", quantity: 5, unitPrice: 4200 });
  });

  it("금액만 있는 견적서 양식(단가 환산 + 경고)", () => {
    const result = parseItemCsv(read("quote-amount-only.csv"));
    expect(result.headerError).toBeNull();
    expect(result.errors).toHaveLength(0);
    expect(result.items.map((item) => item.unitPrice)).toEqual([5000, 3000]);
    expect(result.warnings.join(" ")).toContain("금액 ÷ 수량");
  });

  it("BOM이 있는 파일", () => {
    const result = parseItemCsv(read("quote-bom.csv"));
    expect(result.headerError).toBeNull();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ productName: "샘플 타월", quantity: 3, unitPrice: 5000 });
  });
});
