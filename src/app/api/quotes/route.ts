import { NextRequest, NextResponse } from "next/server";
import { sessionMall } from "@/lib/launch";
import { createSampleDocument } from "@/fixtures/samples";
import {
  createDraft,
  isDatabaseUnavailable,
  listDrafts,
  type QuoteDraftSummary,
} from "@/features/quotes/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

export async function GET(req: NextRequest) {
  const mallId = sessionMall(req);
  if (!mallId) {
    return NextResponse.json({ error: "session required" }, { status: 401, headers: noStore });
  }
  try {
    const keyword = req.nextUrl.searchParams.get("q") ?? "";
    const drafts: QuoteDraftSummary[] = await listDrafts(mallId, keyword);
    return NextResponse.json({ mallId, drafts }, { headers: noStore });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(
        { error: "storage unavailable", message: "DATABASE_URL이 없어 저장 목록을 읽을 수 없습니다." },
        { status: 503, headers: noStore },
      );
    }
    console.error("[quotes] list failed", { message: (error as Error).message });
    return NextResponse.json({ error: "list failed" }, { status: 500, headers: noStore });
  }
}

export async function POST(req: NextRequest) {
  const mallId = sessionMall(req);
  if (!mallId) {
    return NextResponse.json({ error: "session required" }, { status: 401, headers: noStore });
  }

  let source: "empty" | "sample" = "empty";
  try {
    const body = (await req.json()) as { source?: string };
    if (body.source === "sample") {
      source = "sample";
    }
  } catch {
    source = "empty";
  }

  try {
    const draft = await createDraft(mallId, source === "sample" ? createSampleDocument() : undefined);
    return NextResponse.json({ draft }, { status: 201, headers: noStore });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(
        { error: "storage unavailable", message: "DATABASE_URL이 없어 견적을 저장할 수 없습니다." },
        { status: 503, headers: noStore },
      );
    }
    console.error("[quotes] create failed", { message: (error as Error).message });
    return NextResponse.json({ error: "create failed" }, { status: 500, headers: noStore });
  }
}
