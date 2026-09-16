import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { apiBase, authorizeUrl, SCOPES } from "@/lib/cafe24";
import { sessionCookie, verifyLaunch } from "@/lib/launch";
import { store } from "@/lib/store";
import { getValidToken } from "@/lib/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 저장된 토큰이 실제로 살아있는지 확인한다. Cafe24는 웹훅 유실을 경고하므로
 * 앱 삭제 웹훅(90077)이 빠진 채 재설치하면 낡은 토큰이 남아 재설치를 막는다.
 * 죽은 토큰은 재동의 OAuth 흐름으로 흘려보낸다.
 *
 * 다만 너무 민감하면 안 된다. 응답을 못 받은 것(네트워크·5xx)을 "죽었다"고 판단해
 * OAuth로 보내면 테스트 설치 한도(기본 5회)를 태운다. Cafe24가 명시적으로 거부한
 * 401/403에만 재동의로 흘린다.
 */
async function isTokenLive(mallId: string): Promise<boolean> {
  try {
    const token = await getValidToken(mallId);
    if (!token) {
      return false;
    }
    const res = await fetch(`${apiBase(mallId)}/admin/products?limit=1&fields=product_no`, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "X-Cafe24-Api-Version": process.env.CAFE24_API_VERSION ?? "2026-09-01",
      },
    });
    return !(res.status === 401 || res.status === 403);
  } catch {
    return true;
  }
}

/** Cafe24가 앱을 실행할 때 부르는 주소. hmac·timestamp 검증을 통과해야 들어올 수 있다. */
export async function GET(req: NextRequest) {
  const mallId = verifyLaunch(req);
  if (!mallId) {
    return NextResponse.json({ error: "invalid launch request" }, { status: 401 });
  }

  if ((await store.get(mallId)) && (await isTokenLive(mallId))) {
    const res = NextResponse.redirect(new URL("/demo", req.url));
    res.cookies.set(sessionCookie(mallId));
    return res;
  }

  console.info("[auth/install] authorize request", {
    mall_id: mallId,
    scope: SCOPES,
    raw_scopes_env: process.env.CAFE24_SCOPES ?? "(unset)",
    redirect_uri: process.env.CAFE24_REDIRECT_URI ?? "",
    api_version: process.env.CAFE24_API_VERSION ?? "2026-09-01",
    has_client_secret: !!process.env.CAFE24_CLIENT_SECRET,
  });

  const state = `${mallId}:${randomUUID()}`;
  const res = NextResponse.redirect(authorizeUrl(mallId, state));
  res.cookies.set("cq_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 3600,
    secure: true,
  });
  res.cookies.set("cq_mall", mallId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 3600,
    secure: true,
  });
  return res;
}
