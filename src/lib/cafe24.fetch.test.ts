import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  exchangeCode,
  fetchProductOptions,
  fetchProducts,
  refreshToken,
  type Token,
} from "./cafe24";

const MALL = "samplemall";
const BASE = `https://${MALL}.cafe24api.com/api/v2`;

type StubCall = { url: string; init: RequestInit };

function stubFetch(response: { status?: number; json?: unknown; text?: string }): StubCall[] {
  const calls: StubCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      const status = response.status ?? 200;
      const body = response.json !== undefined ? JSON.stringify(response.json) : (response.text ?? "{}");
      return new Response(body, { status, headers: { "Content-Type": "application/json" } });
    }),
  );
  return calls;
}

const token: Token = {
  mall_id: MALL,
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_at: "2026-09-16T15:00:00+09:00",
};

beforeEach(() => {
  process.env.CAFE24_CLIENT_ID = "client-id";
  process.env.CAFE24_CLIENT_SECRET = "client-secret";
  process.env.CAFE24_REDIRECT_URI = "https://app.example.com/api/auth/callback";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OAuth 토큰 요청", () => {
  it("인증 코드 교환은 Basic 인증 + authorization_code 그랜트로 보낸다", async () => {
    const calls = stubFetch({
      json: {
        access_token: "a",
        refresh_token: "r",
        expires_at: "2026-09-16T15:00:00.000",
        mall_id: MALL,
      },
    });

    const result = await exchangeCode(MALL, "auth-code");

    expect(calls[0].url).toBe(`${BASE}/oauth/token`);
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(headers.Authorization).toBe(
      "Basic " + Buffer.from("client-id:client-secret").toString("base64"),
    );
    const body = calls[0].init.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code");
    expect(body.get("redirect_uri")).toBe("https://app.example.com/api/auth/callback");
    expect(result.expires_at).toBe("2026-09-16T15:00:00.000+09:00");
  });

  it("갱신은 refresh_token 그랜트를 쓴다", async () => {
    const calls = stubFetch({
      json: {
        access_token: "a2",
        refresh_token: "r2",
        expires_at: "2026-09-16T17:00:00.000",
        mall_id: MALL,
      },
    });

    await refreshToken(MALL, "old-refresh");

    const body = calls[0].init.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("old-refresh");
  });

  it("실패 응답은 상태코드와 본문을 담아 던진다", async () => {
    stubFetch({ status: 401, text: "invalid_client" });
    await expect(exchangeCode(MALL, "bad")).rejects.toThrow(/401.*invalid_client/);
  });
});

describe("상품 조회", () => {
  it("페이지네이션·필드 지정·고정 버전 헤더로 목록을 요청한다", async () => {
    const calls = stubFetch({
      json: {
        products: [
          { product_no: 128, product_code: "P000000X", product_name: "샘플 타월", price: "5000", selling: "T" },
        ],
      },
    });

    const products = await fetchProducts(token, { keyword: "타월", limit: 20, offset: 40 });

    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe(`${BASE}/admin/products`);
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.get("offset")).toBe("40");
    expect(url.searchParams.get("fields")).toBe("product_no,product_code,product_name,price,display,selling");
    expect(url.searchParams.get("product_name")).toBe("타월");

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer access-token");
    expect(headers["X-Cafe24-Api-Version"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(products).toHaveLength(1);
    expect(products[0].price).toBe(5000);
  });

  it("limit은 1~100, offset은 0~5000으로 자른다", async () => {
    const calls = stubFetch({ json: { products: [] } });
    await fetchProducts(token, { limit: 9999, offset: 999999 });
    const url = new URL(calls[0].url);
    expect(url.searchParams.get("limit")).toBe("100");
    expect(url.searchParams.get("offset")).toBe("5000");
  });

  it("검색어가 없으면 product_name 파라미터를 붙이지 않는다", async () => {
    const calls = stubFetch({ json: { products: [] } });
    await fetchProducts(token, {});
    expect(new URL(calls[0].url).searchParams.has("product_name")).toBe(false);
  });

  it("옵션은 상품 하위 경로에서 조회한다", async () => {
    const calls = stubFetch({
      json: { options: [{ option_name: "색상", option_value: "화이트" }] },
    });
    const options = await fetchProductOptions(token, 128);
    expect(calls[0].url).toBe(`${BASE}/admin/products/128/options`);
    expect(options).toEqual([{ option_name: "색상", option_value: "화이트" }]);
  });

  it("권한이 없으면(403) 던진다", async () => {
    stubFetch({ status: 403, text: "insufficient scope" });
    await expect(fetchProducts(token, {})).rejects.toThrow(/403/);
  });
});
