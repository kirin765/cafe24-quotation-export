import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "cq_sess";
const SESSION_MAX_AGE = 2 * 3600;
const LAUNCH_TOLERANCE_SECONDS = 2 * 3600;

const secret = () => process.env.CAFE24_CLIENT_SECRET ?? "";

const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("base64");

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Cafe24가 앱을 실행할 때 붙여 보내는 파라미터를 검증한다. 심사 필수 항목이다.
 * - hmac: hmac을 제외한 모든 파라미터를 원래 순서대로 URL 인코딩한 쿼리스트링을
 *   클라이언트 시크릿으로 HMAC-SHA256 해싱한 base64 값과 같아야 한다.
 * - timestamp: 앱 실행 시점이 ±2시간을 벗어나면 Replay Attack으로 보고 무효 처리한다.
 * 규격: developers.cafe24.com/app/front/app/develop/manage/runappauth
 *
 * `req.nextUrl.search`를 그대로 쓰면 안 된다. Vercel/Next가 공백을 `%20` → `+`로
 * 정규화하는데 Cafe24는 `%20`으로 인코딩한 문자열에 서명한다. 그래서 파라미터를
 * URLSearchParams로 파싱한 뒤 encodeURIComponent로 다시 조립해 서명 원문을 복원한다.
 */
export function verifyLaunch(req: NextRequest): string | null {
  const params = req.nextUrl.searchParams;
  const hmac = params.get("hmac");
  const mallId = params.get("mall_id");
  const timestamp = Number(params.get("timestamp"));

  if (!hmac || !mallId || !timestamp) {
    return null;
  }
  if (Math.abs(Date.now() / 1000 - timestamp) >= LAUNCH_TOLERANCE_SECONDS) {
    return null;
  }

  const pairs: string[] = [];
  for (const [key, value] of params) {
    if (key === "hmac") {
      continue;
    }
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }

  if (!safeEqual(hmac, sign(pairs.join("&")))) {
    console.error("[launch] hmac mismatch", {
      hasClientSecret: secret().length > 0,
      mallId,
      timestamp,
    });
    return null;
  }

  return mallId;
}

export function issueSession(mallId: string): string {
  const body = `${mallId}.${Math.floor(Date.now() / 1000) + SESSION_MAX_AGE}`;
  return `${body}.${sign(body)}`;
}

export const sessionCookie = (mallId: string) =>
  ({
    name: SESSION_COOKIE,
    value: issueSession(mallId),
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  }) as const;

/** 쿼리의 mall_id는 믿지 않는다. 실행 검증을 통과해 발급된 세션에서만 몰을 얻는다. */
export function sessionMall(req: NextRequest): string | null {
  return sessionMallFromCookies(req.cookies.get(SESSION_COOKIE)?.value);
}

export function sessionMallFromCookies(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const match = value.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  const raw = match ? match[1] : value;
  if (!raw) {
    return null;
  }
  const cut = raw.lastIndexOf(".");
  if (cut === -1) {
    return null;
  }
  const body = raw.slice(0, cut);
  if (!safeEqual(raw.slice(cut + 1), sign(body))) {
    return null;
  }
  const [mallId, expiresAt] = body.split(".");
  if (!mallId || Number(expiresAt) < Date.now() / 1000) {
    return null;
  }
  return mallId;
}
