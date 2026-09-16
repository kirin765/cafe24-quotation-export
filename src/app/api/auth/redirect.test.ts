import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as callbackGET } from "@/app/api/auth/callback/route";
import { GET as installGET } from "@/app/api/auth/install/route";
import { SESSION_COOKIE } from "@/lib/launch";
import { store } from "@/lib/store";

/**
 * 앱을 실행했을 때 어디로 보내는지 고정한다.
 * /demo는 설치 없이 보는 미리보기 화면이라, 설치한 운영자를 그쪽에 두면
 * 저장·확정이 안 되는 줄 알고 오해한다(2026-09-16 실제로 /demo로 보내고 있었다).
 */
const SECRET = "redirect-test-secret";
const MALL = "samplemall";
const TARGET = "/quotes";

function launchUrl(): string {
  const pairs: [string, string][] = [
    ["mall_id", MALL],
    ["shop_no", "1"],
    ["timestamp", String(Math.floor(Date.now() / 1000))],
    ["user_id", "admin"],
    ["user_name", "대표 관리자"],
    ["user_type", "F"],
  ];
  const signed = pairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const hmac = createHmac("sha256", SECRET).update(signed).digest("base64");
  const query = [...pairs, ["hmac", hmac] as [string, string]]
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return `https://app.example.com/api/auth/install?${query}`;
}

beforeEach(() => {
  process.env.CAFE24_CLIENT_SECRET = SECRET;
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await store.delete(MALL);
  delete process.env.CAFE24_CLIENT_SECRET;
});

describe("앱 실행 목적지", () => {
  it("이미 설치된 몰이 다시 실행하면 견적 목록으로 간다", async () => {
    await store.put({
      mall_id: MALL,
      access_token: "live-access",
      refresh_token: "live-refresh",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });
    // isTokenLive가 호출하는 상품 조회는 살아 있다고 응답
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));

    const res = await installGET(new NextRequest(launchUrl()));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe(TARGET);
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBeTruthy();
  });

  it("처음 설치하는 몰은 OAuth 동의로 보낸다(목적지는 그대로 목록)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));

    const res = await installGET(new NextRequest(launchUrl()));

    const location = new URL(res.headers.get("location") ?? "");
    expect(location.origin).toBe(`https://${MALL}.cafe24api.com`);
    expect(location.pathname).toBe("/api/v2/oauth/authorize");
  });

  it("토큰 교환을 마치면 견적 목록으로 간다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_at: "2099-01-01T00:00:00.000",
            mall_id: MALL,
          }),
          { status: 200 },
        ),
      ),
    );

    const state = `${MALL}:state-uuid`;
    const request = new NextRequest(
      `https://app.example.com/api/auth/callback?code=auth-code&state=${encodeURIComponent(state)}`,
      { headers: { cookie: `cq_state=${encodeURIComponent(state)}; cq_mall=${MALL}` } },
    );

    const res = await callbackGET(request);

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe(TARGET);
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBeTruthy();
  });
});
