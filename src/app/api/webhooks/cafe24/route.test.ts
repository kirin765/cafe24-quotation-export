import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/cafe24/route";
import { store } from "@/lib/store";

const WEBHOOK_KEY = "webhook-test-key";

function request(body: unknown, apiKey: string | null): NextRequest {
  return new NextRequest("https://app.example.com/api/webhooks/cafe24", {
    method: "POST",
    headers: apiKey === null ? {} : { "x-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const uninstallPayload = (mallId: string) => ({
  event_no: 90077,
  resource: {
    mall_id: mallId,
    client_id: "1YEakgMICNlhoRCygIzUxA",
    app_name: "quotation-export",
    deleted_date: "2026-09-16T13:49:00+09:00",
  },
});

async function seedToken(mallId: string) {
  await store.put({
    mall_id: mallId,
    access_token: "access",
    refresh_token: "refresh",
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
  });
}

beforeEach(() => {
  process.env.CAFE24_WEBHOOK_API_KEY = WEBHOOK_KEY;
});

describe("Cafe24 웹훅", () => {
  it("인증정보가 없으면 401이고 토큰을 건드리지 않는다", async () => {
    await seedToken("samplemall");
    const res = await POST(request(uninstallPayload("samplemall"), null));
    expect(res.status).toBe(401);
    expect(await store.get("samplemall")).not.toBeNull();
    await store.delete("samplemall");
  });

  it("인증정보가 틀리면 401", async () => {
    const res = await POST(request(uninstallPayload("samplemall"), "wrong-key"));
    expect(res.status).toBe(401);
  });

  it("앱 삭제 이벤트(90077)를 받으면 토큰을 지운다", async () => {
    await seedToken("samplemall");
    const res = await POST(request(uninstallPayload("samplemall"), WEBHOOK_KEY));
    expect(res.status).toBe(200);
    expect(await store.get("samplemall")).toBeNull();
  });

  it("앱 만료 이벤트(90078)도 토큰을 지운다", async () => {
    await seedToken("samplemall");
    const payload = uninstallPayload("samplemall");
    const res = await POST(request({ ...payload, event_no: 90078 }, WEBHOOK_KEY));
    expect(res.status).toBe(200);
    expect(await store.get("samplemall")).toBeNull();
  });

  it("다른 이벤트는 무시하고 200으로 응답한다", async () => {
    await seedToken("samplemall");
    const res = await POST(
      request({ event_no: 90001, resource: { mall_id: "samplemall" } }, WEBHOOK_KEY),
    );
    expect(res.status).toBe(200);
    expect(await store.get("samplemall")).not.toBeNull();
    await store.delete("samplemall");
  });

  it("mall_id가 없으면 400", async () => {
    const res = await POST(request({ event_no: 90077, resource: {} }, WEBHOOK_KEY));
    expect(res.status).toBe(400);
  });

  it("본문이 JSON이 아니면 400", async () => {
    const res = await POST(
      new NextRequest("https://app.example.com/api/webhooks/cafe24", {
        method: "POST",
        headers: { "x-api-key": WEBHOOK_KEY },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });
});
