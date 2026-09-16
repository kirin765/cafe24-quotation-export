import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/cafe24";
import { store } from "@/lib/store";
import { sessionCookie } from "@/lib/launch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

/**
 * OAuth 콜백은 브라우저가 직접 여는 화면이다. 실패해도 raw JSON이 아니라
 * 사람이 읽는 안내를 내보내 "서비스 화면으로 이동이 안 된다"고 오인하지 않게 한다.
 */
function errorPage(title: string, body: string, status = 400): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:64px auto;padding:0 24px;line-height:1.8;color:#222">
<h1 style="font-size:20px;margin-bottom:12px">${title}</h1>
<p style="font-size:15px">${body}</p>
<p style="margin-top:28px;font-size:13px;color:#888">카페24 관리자 &gt; 앱에서 다시 실행해 주세요.</p>
</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");
  const traceId = req.nextUrl.searchParams.get("trace_id");

  if (oauthError) {
    console.error("[auth/callback] oauth error", {
      error: oauthError,
      error_description: errorDescription,
      trace_id: traceId,
      state,
    });
    const isInstallLimit = /install limit for test purpose/i.test(errorDescription ?? "");
    const isScope = /scope/i.test(`${oauthError} ${errorDescription ?? ""}`);
    return errorPage(
      "앱 설치를 진행할 수 없습니다",
      isInstallLimit
        ? "카페24가 <strong>테스트용 설치 가능 횟수를 초과</strong>했다고 응답했습니다.<br>" +
          "앱이 판매종료(개발) 상태일 때 테스트 설치는 기본 5회로 제한됩니다.<br>" +
          "개발자센터 문의 게시판으로 추가 테스트 설치 횟수를 요청해 주세요."
        : isScope
          ? "카페24가 인증을 거부했습니다.<br>" +
            `<span style="color:#888">(${escapeHtml(errorDescription ?? oauthError)})</span><br>` +
            "이 앱이 요청한 권한(상품 조회)이 개발자센터의 " +
            "<strong>앱 기본정보 &gt; 권한관리</strong>에 선택되어 있는지 확인해 주세요."
          : `카페24가 인증을 거부했습니다.<br><span style="color:#888">(${escapeHtml(
              errorDescription ?? oauthError,
            )})</span>`,
    );
  }

  const expected = req.cookies.get("cq_state")?.value;
  const mallFromState =
    state && state.includes(":") ? state.slice(0, state.lastIndexOf(":")) : null;
  const mallId = req.cookies.get("cq_mall")?.value ?? mallFromState;

  if (!code || !mallId) {
    console.error("[auth/callback] missing code/mall", {
      hasCode: !!code,
      mallId,
      hasState: !!state,
    });
    return errorPage(
      "앱 설치를 완료하지 못했습니다",
      "카페24로부터 인증 코드를 받지 못했습니다.<br>카페24 관리자 &gt; 앱에서 다시 실행해 주세요.",
    );
  }
  if (!state || !expected || state !== expected) {
    return errorPage(
      "앱 설치를 완료하지 못했습니다",
      "보안 검증(state)이 일치하지 않아 요청을 거부했습니다.<br>카페24 관리자 &gt; 앱에서 다시 실행해 주세요.",
    );
  }

  let token;
  try {
    token = await exchangeCode(mallId, code);
    await store.put(token);
  } catch (error) {
    return errorPage(
      "앱 설치를 완료하지 못했습니다",
      `토큰 교환에 실패했습니다.<br><span style="color:#888">(${escapeHtml(
        (error as Error).message.slice(0, 200),
      )})</span>`,
    );
  }

  const res = NextResponse.redirect(new URL("/demo", req.url));
  res.cookies.set(sessionCookie(token.mall_id));
  res.cookies.delete("cq_state");
  res.cookies.delete("cq_mall");
  return res;
}
