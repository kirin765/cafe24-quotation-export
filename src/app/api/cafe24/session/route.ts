import { NextRequest, NextResponse } from "next/server";
import { API_VERSION, SCOPES } from "@/lib/cafe24";
import { sessionMall } from "@/lib/launch";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 브라우저가 "이 브라우저가 어느 몰의 앱 세션을 들고 있는가"만 확인하는 창구. */
export async function GET(req: NextRequest) {
  const mallId = sessionMall(req);
  return NextResponse.json(
    {
      mallId,
      installed: mallId !== null,
      storeKind: store.kind,
      scopes: SCOPES,
      apiVersion: API_VERSION,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
