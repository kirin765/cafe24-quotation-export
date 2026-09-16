import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionMallFromCookies } from "@/lib/launch";

/**
 * 서버 컴포넌트·라우트에서 현재 몰을 얻는다. 쿼리 파라미터의 mall_id는 신뢰하지 않는다.
 * 세션이 없으면 null이며, 호출부는 설치 안내를 보여준다.
 */
export async function currentMallId(): Promise<string | null> {
  const store = await cookies();
  return sessionMallFromCookies(store.get(SESSION_COOKIE)?.value);
}
