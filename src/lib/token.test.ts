import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "./store";
import { getValidToken } from "./token";

const MALL = "samplemall";

function stubTokenResponse(expiresAt: string, accessToken = "new-access") {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      calls.push(String(url));
      const body = (init.body as URLSearchParams).get("grant_type");
      expect(body).toBe("refresh_token");
      return new Response(
        JSON.stringify({
          access_token: accessToken,
          refresh_token: "new-refresh",
          expires_at: expiresAt,
          mall_id: MALL,
        }),
        { status: 200 },
      );
    }),
  );
  return calls;
}

beforeEach(() => {
  process.env.CAFE24_CLIENT_ID = "client-id";
  process.env.CAFE24_CLIENT_SECRET = "client-secret";
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await store.delete(MALL);
});

describe("토큰 수명 관리", () => {
  it("저장된 토큰이 없으면 null", async () => {
    expect(await getValidToken(MALL)).toBeNull();
  });

  it("만료가 넉넉하면 그대로 돌려주고 갱신하지 않는다", async () => {
    const calls = stubTokenResponse("2099-01-01T00:00:00.000");
    await store.put({
      mall_id: MALL,
      access_token: "still-valid",
      refresh_token: "refresh",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });

    const token = await getValidToken(MALL);

    expect(token?.access_token).toBe("still-valid");
    expect(calls).toHaveLength(0);
  });

  it("5분 안에 만료되면 갱신해 저장한다", async () => {
    stubTokenResponse("2099-01-01T00:00:00.000");
    await store.put({
      mall_id: MALL,
      access_token: "expiring",
      refresh_token: "refresh",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });

    const token = await getValidToken(MALL);

    expect(token?.access_token).toBe("new-access");
    expect((await store.get(MALL))?.access_token).toBe("new-access");
  });

  it("타임존 없는 KST 만료시각도 9시간 밀리지 않고 처리한다", async () => {
    const calls = stubTokenResponse("2099-01-01T00:00:00.000");
    const kst = new Date(Date.now() + 3600_000 + 9 * 3600_000);
    const kstString = kst.toISOString().slice(0, 23).replace("Z", "");
    await store.put({
      mall_id: MALL,
      access_token: "kst-token",
      refresh_token: "refresh",
      expires_at: kstString,
    });

    const token = await getValidToken(MALL);

    expect(token?.access_token).toBe("kst-token");
    expect(calls).toHaveLength(0);
  });

  it("갱신이 실패하면 낡은 토큰을 돌려주지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("invalid_grant", { status: 400 })),
    );
    await store.put({
      mall_id: MALL,
      access_token: "expired",
      refresh_token: "refresh",
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });

    expect(await getValidToken(MALL)).toBeNull();
  });
});
