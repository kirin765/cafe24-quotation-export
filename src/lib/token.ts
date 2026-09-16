import { refreshToken, normalizeExpiry, type Token } from "./cafe24";
import { store } from "./store";

const SKEW_MS = 5 * 60 * 1000;

const parseExpiry = (value: string) => Date.parse(normalizeExpiry(value));

/**
 * 저장된 토큰을 꺼내되 만료가 임박하면 갱신해서 돌려준다.
 * Cafe24는 액세스 2시간 / 갱신 2주라 만료 5분 전에 미리 바꾼다.
 * 갱신 실패는 재설치가 필요하다는 뜻이므로 낡은 토큰을 돌려주지 않는다.
 */
export async function getValidToken(mallId: string): Promise<Token | null> {
  const token = await store.get(mallId);
  if (!token) {
    return null;
  }
  if (parseExpiry(token.expires_at) - Date.now() > SKEW_MS) {
    return token;
  }

  try {
    const next = await refreshToken(mallId, token.refresh_token);
    await store.put(next);
    return next;
  } catch {
    return null;
  }
}
