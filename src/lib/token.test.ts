import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "./store";
import { getValidToken } from "./token";
import type { Token } from "./cafe24";

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

  it("동시에 여러 요청이 겹쳐도 갱신은 한 번만 호출한다", async () => {
    const calls = stubTokenResponse("2099-01-01T00:00:00.000");
    await store.put({
      mall_id: MALL,
      access_token: "expiring",
      refresh_token: "refresh",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });

    const results = await Promise.all([
      getValidToken(MALL),
      getValidToken(MALL),
      getValidToken(MALL),
    ]);

    expect(calls).toHaveLength(1);
    expect(results.every((token) => token?.access_token === "new-access")).toBe(true);
  });

  it("다른 인스턴스가 먼저 갱신했으면 내가 받은 토큰 대신 저장소 값을 쓴다", async () => {
    stubTokenResponse("2099-01-01T00:00:00.000", "stale-from-me");
    const winner: Token = {
      mall_id: MALL,
      access_token: "winner-access",
      refresh_token: "winner-refresh",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    };
    await store.put({
      mall_id: MALL,
      access_token: "expiring",
      refresh_token: "refresh",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });

    const rotate = vi.spyOn(store, "rotate").mockImplementation(async () => {
      // 경쟁 인스턴스가 먼저 저장한 상황을 흉내낸다.
      await store.put(winner);
      return false;
    });

    const token = await getValidToken(MALL);

    expect(rotate).toHaveBeenCalledTimes(1);
    expect(token?.access_token).toBe("winner-access");
    rotate.mockRestore();
  });

  it("갱신 실패해도 다른 인스턴스가 갱신해뒀으면 그 토큰을 쓴다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("invalid_grant", { status: 400 })));
    const update = {
      ...store,
      async get(mallId: string) {
        return {
          mall_id: mallId,
          access_token: "already-refreshed",
          refresh_token: "new-refresh",
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        } satisfies Token;
      },
    };
    const get = vi.spyOn(store, "get");
    get.mockResolvedValueOnce({
      mall_id: MALL,
      access_token: "expired",
      refresh_token: "refresh",
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    get.mockImplementation(update.get as typeof store.get);

    expect((await getValidToken(MALL))?.access_token).toBe("already-refreshed");
    get.mockRestore();
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
