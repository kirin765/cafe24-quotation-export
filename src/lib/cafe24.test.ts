import { describe, expect, it } from "vitest";
import {
  API_VERSION,
  DEFAULT_SCOPES,
  mapProductOptions,
  mapProducts,
  normalizeExpiry,
} from "./cafe24";

describe("토큰 만료시각 정규화", () => {
  it("타임존 없는 KST 문자열에 +09:00을 붙인다", () => {
    expect(normalizeExpiry("2026-07-28T15:37:26.000")).toBe("2026-07-28T15:37:26.000+09:00");
    expect(normalizeExpiry("2026-07-28 15:37:26")).toBe("2026-07-28T15:37:26+09:00");
  });

  it("이미 타임존이 있으면 그대로 둔다", () => {
    expect(normalizeExpiry("2026-07-28T15:37:26.000Z")).toBe("2026-07-28T15:37:26.000Z");
    expect(normalizeExpiry("2026-07-28T15:37:26+09:00")).toBe("2026-07-28T15:37:26+09:00");
  });

  it("+9시간 보정을 실제로 적용한다", () => {
    expect(Date.parse(normalizeExpiry("2026-07-28T15:37:26.000"))).toBe(
      Date.parse("2026-07-28T06:37:26.000Z"),
    );
  });
});

describe("상품 응답 매핑", () => {
  const payload = {
    products: [
      {
        product_no: 128,
        product_code: "P000000X",
        product_name: "샘플 타월",
        price: "5000",
        display: "T",
        selling: "T",
      },
      {
        product_no: 129,
        product_code: "P000000W",
        product_name: "샘플 컵",
        price: "3000",
      },
    ],
  };

  it("문자열 숫자를 숫자로 바꾸고 없는 필드는 빈 값으로 채운다", () => {
    const products = mapProducts(payload);
    expect(products).toHaveLength(2);
    expect(products[0]).toEqual({
      product_no: 128,
      product_code: "P000000X",
      product_name: "샘플 타월",
      price: 5000,
      display: "T",
      selling: "T",
    });
    expect(products[1]).toMatchObject({ product_no: 129, price: 3000, display: "", selling: "" });
  });

  it("products가 없거나 배열이 아니면 빈 배열", () => {
    expect(mapProducts(null)).toEqual([]);
    expect(mapProducts({})).toEqual([]);
    expect(mapProducts({ products: "nope" })).toEqual([]);
    expect(mapProducts(undefined)).toEqual([]);
  });
});

describe("옵션 응답 매핑", () => {
  it("option_value가 없으면 option_text로 대체한다", () => {
    const options = mapProductOptions({
      options: [
        { option_name: "색상", option_value: "화이트" },
        { option_name: "크기", option_text: "300ml" },
      ],
    });
    expect(options).toEqual([
      { option_name: "색상", option_value: "화이트" },
      { option_name: "크기", option_value: "300ml" },
    ]);
  });

  it("options가 없으면 빈 배열", () => {
    expect(mapProductOptions({})).toEqual([]);
    expect(mapProductOptions(null)).toEqual([]);
  });
});

describe("설정 기본값", () => {
  it("최소 권한 scope는 상품 읽기 하나", () => {
    expect(DEFAULT_SCOPES).toBe("mall.read_product");
  });

  it("API 버전을 고정한다", () => {
    expect(API_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
