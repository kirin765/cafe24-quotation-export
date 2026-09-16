import { NextRequest, NextResponse } from "next/server";
import { fetchProductOptions } from "@/lib/cafe24";
import { sessionMall } from "@/lib/launch";
import { getValidToken } from "@/lib/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 상품 하나의 옵션 목록. 견적 행의 옵션명을 채우는 용도로만 쓴다. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productNo: string }> },
) {
  const mallId = sessionMall(req);
  if (!mallId) {
    return NextResponse.json({ error: "session required" }, { status: 401 });
  }

  const { productNo } = await params;
  const parsed = Number(productNo);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "invalid product_no" }, { status: 400 });
  }

  const token = await getValidToken(mallId);
  if (!token) {
    return NextResponse.json(
      { error: "token unavailable", message: "앱을 다시 실행해 토큰을 갱신해 주세요." },
      { status: 409 },
    );
  }

  try {
    const options = await fetchProductOptions(token, parsed);
    return NextResponse.json({ productNo: parsed, options }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[cafe24/product options] fetch failed", {
      mallId,
      productNo: parsed,
      message: (error as Error).message,
    });
    return NextResponse.json({ error: "cafe24 api error" }, { status: 502 });
  }
}
