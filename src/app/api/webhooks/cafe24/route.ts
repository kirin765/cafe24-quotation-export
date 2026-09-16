import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_UNINSTALLED_EVENT = 90077;
const APP_EXPIRED_EVENT = 90078;

/**
 * Cafe24 웹훅은 HMAC 서명이 아니라 개발자센터에서 발급한 고정 인증정보를
 * `X-API-Key` 헤더로 보낸다. 값이 없거나 다르면 아무 것도 하지 않고 401을 돌려준다.
 * 규격: developers.cafe24.com/app/front/app/develop/webhook/manage
 */
function verifyWebhook(req: NextRequest): boolean {
  const expected = process.env.CAFE24_WEBHOOK_API_KEY ?? "";
  const received = req.headers.get("x-api-key") ?? "";
  if (expected === "" || received === "") {
    return false;
  }
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

type WebhookPayload = {
  event_no?: number;
  resource?: {
    mall_id?: string;
    client_id?: string;
    app_name?: string;
    deleted_date?: string;
    expired_date?: string;
  };
};

export async function POST(req: NextRequest) {
  if (!verifyWebhook(req)) {
    console.error("[webhooks/cafe24] rejected: X-API-Key mismatch or unset", {
      hasEnvKey: !!process.env.CAFE24_WEBHOOK_API_KEY,
      traceId: req.headers.get("x-trace-id") ?? null,
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventNo = Number(payload.event_no);
  const mallId = payload.resource?.mall_id;

  if (!mallId) {
    return NextResponse.json({ error: "missing mall_id" }, { status: 400 });
  }

  if (eventNo === APP_UNINSTALLED_EVENT || eventNo === APP_EXPIRED_EVENT) {
    await store.delete(mallId);
    console.info("[webhooks/cafe24] token removed", { event_no: eventNo, mall_id: mallId });
  } else {
    console.info("[webhooks/cafe24] ignored event", { event_no: eventNo, mall_id: mallId });
  }

  return NextResponse.json({ ok: true });
}
