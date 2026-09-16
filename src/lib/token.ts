import { refreshToken, normalizeExpiry, type Token } from "./cafe24";
import { store } from "./store";

const SKEW_MS = 5 * 60 * 1000;

const parseExpiry = (value: string) => Date.parse(normalizeExpiry(value));
const isFresh = (token: Token) => parseExpiry(token.expires_at) - Date.now() > SKEW_MS;

/** 같은 인스턴스 안에서 같은 몰의 갱신이 겹치면 하나만 수행하고 결과를 공유한다. */
const inflight = new Map<string, Promise<Token | null>>();

/**
 * 저장된 토큰을 꺼내되 만료가 임박하면 갱신해서 돌려준다.
 * Cafe24는 액세스 2시간 / 갱신 2주라 만료 5분 전에 미리 바꾼다.
 *
 * 갱신은 저장소의 refresh_token이 아직 같을 때만 반영한다(compare-and-set).
 * 다른 인스턴스가 먼저 갱신했다면 그 결과를 다시 읽어 쓴다.
 * 갱신 실패(리프레시 만료·권한 철회)는 재설치가 필요하다는 뜻이라 낡은 토큰을 돌려주지 않는다.
 */
export async function getValidToken(mallId: string): Promise<Token | null> {
  const token = await store.get(mallId);
  if (!token) {
    return null;
  }
  if (isFresh(token)) {
    return token;
  }

  const running = inflight.get(mallId);
  if (running) {
    return running;
  }

  const task = (async (): Promise<Token | null> => {
    try {
      const next = await refreshToken(mallId, token.refresh_token);
      if (await store.rotate(next, token.refresh_token)) {
        return next;
      }
      // 다른 인스턴스가 먼저 갱신했다. 내가 받은 토큰은 버리고 저장소 값을 쓴다.
      return await store.get(mallId);
    } catch {
      const latest = await store.get(mallId);
      return latest && isFresh(latest) ? latest : null;
    } finally {
      inflight.delete(mallId);
    }
  })();

  inflight.set(mallId, task);
  return task;
}
