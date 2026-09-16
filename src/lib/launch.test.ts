import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  issueSession,
  sessionMallFromCookies,
  verifyLaunch,
} from "./launch";

const SECRET = "test-client-secret";

function signedQuery(pairs: [string, string][], secret = SECRET): string {
  const signed = pairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const hmac = createHmac("sha256", secret).update(signed).digest("base64");
  const query = [...pairs, ["hmac", hmac]]
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return query;
}

function launchRequest(pairs: [string, string][], secret = SECRET) {
  return new NextRequest(`https://app.example.com/api/auth/install?${signedQuery(pairs, secret)}`);
}

const basePairs = (): [string, string][] => [
  ["auth_config", "1"],
  ["is_multi_shop", "F"],
  ["lang", "ko"],
  ["mall_id", "samplemall"],
  ["nation", "KR"],
  ["shop_no", "1"],
  ["timestamp", String(Math.floor(Date.now() / 1000))],
  ["user_id", "admin"],
  ["user_name", "대표 관리자"],
  ["user_type", "F"],
];

beforeAll(() => {
  process.env.CAFE24_CLIENT_SECRET = SECRET;
});

afterAll(() => {
  delete process.env.CAFE24_CLIENT_SECRET;
});

describe("launch HMAC 검증", () => {
  it("서명이 맞으면 mall_id를 돌려준다 (공백·한글 포함)", () => {
    expect(verifyLaunch(launchRequest(basePairs()))).toBe("samplemall");
  });

  it("서명이 틀리면 거부한다", () => {
    const signed = signedQuery(basePairs());
    const tampered = signed.replace("mall_id=samplemall", "mall_id=othermall");
    expect(verifyLaunch(new NextRequest(`https://app.example.com/api/auth/install?${tampered}`))).toBeNull();
  });

  it("타임스탬프가 ±2시간을 벗어나면 거부한다", () => {
    const stale = basePairs().map(([key, value]) =>
      key === "timestamp"
        ? ([key, String(Math.floor(Date.now() / 1000) - 3 * 3600)] as [string, string])
        : ([key, value] as [string, string]),
    );
    expect(verifyLaunch(launchRequest(stale))).toBeNull();
  });

  it("hmac·mall_id·timestamp가 없으면 거부한다", () => {
    expect(verifyLaunch(new NextRequest("https://app.example.com/api/auth/install"))).toBeNull();
  });

  it("다른 시크릿으로 서명하면 거부한다", () => {
    expect(verifyLaunch(launchRequest(basePairs(), "wrong-secret"))).toBeNull();
  });
});

describe("세션 쿠키", () => {
  it("발급한 세션에서 mall_id를 복원한다", () => {
    const value = issueSession("samplemall");
    expect(sessionMallFromCookies(value)).toBe("samplemall");
    expect(sessionMallFromCookies(`${SESSION_COOKIE}=${value}`)).toBe("samplemall");
    expect(sessionMallFromCookies(`other=1; ${SESSION_COOKIE}=${value}`)).toBe("samplemall");
  });

  it("값을 변조하면 거부한다", () => {
    const value = issueSession("samplemall");
    expect(sessionMallFromCookies(`${value}x`)).toBeNull();
    expect(sessionMallFromCookies("samplemall.9999999999.invalid")).toBeNull();
  });

  it("만료된 세션을 거부한다", () => {
    const body = `samplemall.${Math.floor(Date.now() / 1000) - 10}`;
    const hmac = createHmac("sha256", SECRET).update(body).digest("base64");
    expect(sessionMallFromCookies(`${body}.${hmac}`)).toBeNull();
  });

  it("빈 값은 null", () => {
    expect(sessionMallFromCookies(undefined)).toBeNull();
    expect(sessionMallFromCookies("")).toBeNull();
  });
});
