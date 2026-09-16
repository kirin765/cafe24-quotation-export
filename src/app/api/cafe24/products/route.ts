import { NextRequest, NextResponse } from "next/server";
import { fetchProducts } from "@/lib/cafe24";
import { sessionMall } from "@/lib/launch";
import { getValidToken } from "@/lib/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;

/**
 * 설치된 몰의 상품 목록. 세션이 없으면 아무 것도 돌려주지 않는다.
 * 반환하는 price는 쿠폰·회원가·옵션 추가금 반영 전 판매가라
 * 협의 단가의 "제안값"으로만 쓰고 운영자가 확인해 확정한다.
 */
export async function GET(req: NextRequest) {
  const mallId = sessionMall(req);
  if (!mallId) {
    return NextResponse.json({ error: "session required" }, { status: 401 });
  }

  const token = await getValidToken(mallId);
  if (!token) {
    return NextResponse.json(
      { error: "token unavailable", message: "앱을 다시 실행해 토큰을 갱신해 주세요." },
      { status: 409 },
    );
  }

  const params = req.nextUrl.searchParams;
  const keyword = params.get("q") ?? undefined;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 40, 1), MAX_LIMIT);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);

  try {
    const products = await fetchProducts(token, { keyword, limit, offset });
    return NextResponse.json(
      {
        mallId,
        products,
        nextOffset: products.length === limit ? offset + limit : null,
        priceNote:
          "표시 단가는 쿠폰·회원가·옵션 추가금 반영 전 판매가입니다. 협의 단가로 쓰기 전에 확인하세요.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[cafe24/products] fetch failed", {
      mallId,
      message: (error as Error).message,
    });
    return NextResponse.json({ error: "cafe24 api error" }, { status: 502 });
  }
}
