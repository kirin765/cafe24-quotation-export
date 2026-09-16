import postgres from "postgres";
import type { Token } from "./cafe24";

/**
 * 토큰 저장소. DATABASE_URL이 있으면 Postgres, 없으면 메모리(로컬 개발용).
 * 메모리 구현은 서버리스 인스턴스마다 갈리므로 운영에서는 절대 쓰면 안 된다.
 */
export interface TokenStore {
  get(mallId: string): Promise<Token | null>;
  put(token: Token): Promise<void>;
  /**
   * 내가 읽은 refresh_token이 아직 그대로일 때만 교체한다(compare-and-set).
   * 다른 인스턴스가 먼저 갱신했다면 false를 돌려주고, 호출부는 저장소의 최신 토큰을 다시 읽는다.
   * 이게 없으면 동시 요청이 각자 refresh를 호출해 나중 것이 앞 것을 덮어쓴다.
   */
  rotate(token: Token, expectedRefreshToken: string): Promise<boolean>;
  /** 앱 삭제·만료 시 토큰을 지운다. 지우지 않으면 재설치가 막힌다. */
  delete(mallId: string): Promise<void>;
  /** 저장소 종류를 진단·표시에 쓴다. */
  kind: "postgres" | "memory";
}

const memory = new Map<string, Token>();

const memoryStore: TokenStore = {
  kind: "memory",
  async get(mallId) {
    return memory.get(mallId) ?? null;
  },
  async put(token) {
    memory.set(token.mall_id, token);
  },
  async rotate(token, expectedRefreshToken) {
    const current = memory.get(token.mall_id);
    if (!current || current.refresh_token !== expectedRefreshToken) {
      return false;
    }
    memory.set(token.mall_id, token);
    return true;
  },
  async delete(mallId) {
    memory.delete(mallId);
  },
};

function pgStore(url: string): TokenStore {
  const sql = postgres(url, { max: 1 });
  let ready: Promise<void> | null = null;
  const init = () =>
    (ready ??= sql`
      create table if not exists cafe24_quotation_token (
        mall_id text primary key,
        access_token text not null,
        refresh_token text not null,
        expires_at timestamptz not null,
        updated_at timestamptz not null default now()
      )`.then(() => undefined));

  return {
    kind: "postgres",
    async get(mallId) {
      await init();
      const [row] = await sql<
        { mall_id: string; access_token: string; refresh_token: string; expires_at: Date }[]
      >`select mall_id, access_token, refresh_token, expires_at from cafe24_quotation_token where mall_id = ${mallId}`;
      if (!row) {
        return null;
      }
      return {
        mall_id: row.mall_id,
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expires_at: row.expires_at.toISOString(),
      };
    },
    async put(token) {
      await init();
      await sql`
        insert into cafe24_quotation_token (mall_id, access_token, refresh_token, expires_at)
        values (${token.mall_id}, ${token.access_token}, ${token.refresh_token}, ${token.expires_at})
        on conflict (mall_id) do update set
          access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          expires_at = excluded.expires_at,
          updated_at = now()`;
    },
    async rotate(token, expectedRefreshToken) {
      await init();
      const rows = await sql`
        update cafe24_quotation_token set
          access_token = ${token.access_token},
          refresh_token = ${token.refresh_token},
          expires_at = ${token.expires_at},
          updated_at = now()
        where mall_id = ${token.mall_id} and refresh_token = ${expectedRefreshToken}
        returning mall_id`;
      return rows.length > 0;
    },
    async delete(mallId) {
      await init();
      await sql`delete from cafe24_quotation_token where mall_id = ${mallId}`;
    },
  };
}

export const store: TokenStore = process.env.DATABASE_URL
  ? pgStore(process.env.DATABASE_URL)
  : memoryStore;
