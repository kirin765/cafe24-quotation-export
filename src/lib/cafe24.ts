const clientId = () => process.env.CAFE24_CLIENT_ID ?? "";
const clientSecret = () => process.env.CAFE24_CLIENT_SECRET ?? "";
const redirectUri = () => process.env.CAFE24_REDIRECT_URI ?? "";

/**
 * API 버전을 고정한다. 박지 않으면 Cafe24가 최신 버전으로 붙여 어느 날 조용히 깨진다.
 * 버전은 릴리스일로부터 1년간 유효하다. 2026-09-01은 2027-09-01까지 유효(2026-09-16 확인).
 * 만료 전에 CAFE24_API_VERSION으로 올린다.
 */
export const API_VERSION = process.env.CAFE24_API_VERSION ?? "2026-09-01";

export const DEFAULT_SCOPES = "mall.read_product";

/**
 * authorize의 scope는 개발자센터 앱 기본정보 > 권한관리에 선택한 항목만 요청할 수 있다.
 * 등록되지 않은 scope를 요청하면 "The scope added by Cafe24 Developers is invalid" 오류로
 * 설치가 막힌다. 이 앱은 상품 조회만 필요하므로 기본값은 mall.read_product 하나다.
 * (상품분류까지 쓰기로 하면 개발자센터 권한관리와 CAFE24_SCOPES를 함께 맞춘다.)
 */
export const SCOPES =
  (process.env.CAFE24_SCOPES ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)
    .join(",") || DEFAULT_SCOPES;

/**
 * 멀티쇼핑몰은 shop_no로 상품이 나뉜다. 기본 1(대표 몰)이며, 여러 몰을 쓰는 스토어는
 * CAFE24_SHOP_NO로 지정한다. 아직 테스트몰에서 멀티몰 동작을 확인하지는 못했다.
 */
export const SHOP_NO = Number(process.env.CAFE24_SHOP_NO ?? "1") || 1;

export const apiBase = (mallId: string) => `https://${mallId}.cafe24api.com/api/v2`;

export function authorizeUrl(mallId: string, state: string): string {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId(),
    state,
    redirect_uri: redirectUri(),
    scope: SCOPES,
  });
  return `${apiBase(mallId)}/oauth/authorize?${query}`;
}

export type Token = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  mall_id: string;
};

/**
 * Cafe24의 expires_at은 "2026-07-28T15:37:26.000"처럼 타임존 없는 KST다.
 * 그대로 저장하면 Postgres timestamptz가 UTC로 읽어 9시간 미래로 기록되고,
 * 만료된 토큰을 유효하다고 판단해 갱신을 건너뛴다.
 */
export function normalizeExpiry(value: string): string {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    return value;
  }
  return `${value.replace(" ", "T")}+09:00`;
}

async function tokenRequest(mallId: string, body: Record<string, string>): Promise<Token> {
  const res = await fetch(`${apiBase(mallId)}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64"),
    },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    throw new Error(`cafe24 token ${res.status}: ${await res.text()}`);
  }
  const token = (await res.json()) as Token;
  return { ...token, expires_at: normalizeExpiry(token.expires_at) };
}

export const exchangeCode = (mallId: string, code: string) =>
  tokenRequest(mallId, { grant_type: "authorization_code", code, redirect_uri: redirectUri() });

export const refreshToken = (mallId: string, refreshTokenValue: string) =>
  tokenRequest(mallId, { grant_type: "refresh_token", refresh_token: refreshTokenValue });

export async function callAdmin<T>(
  token: Token,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${apiBase(token.mall_id)}/admin${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      "X-Cafe24-Api-Version": API_VERSION,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`cafe24 admin ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export type Cafe24Product = {
  product_no: number;
  product_code: string;
  product_name: string;
  price: number;
  display: string;
  selling: string;
};

export type Cafe24ProductOption = {
  option_name: string;
  option_value: string;
};

const PRODUCT_FIELDS = "product_no,product_code,product_name,price,display,selling";
const PRODUCT_REQUEST_LIMIT = 100;
const PRODUCT_OFFSET_MAX = 5000;

function toText(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(toText(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 협의 단가의 출발점이 되는 상품 목록. 판매가(price)는 쿠폰·회원가·옵션 추가금이 반영되기
 * 전 값이라 최종 결제 금액과 다를 수 있다. UI에서 "제안 단가"로만 쓰고 운영자가 확정한다.
 */
export function mapProducts(payload: unknown): Cafe24Product[] {
  const list = (payload as { products?: unknown[] } | null)?.products;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    return {
      product_no: toNumber(item.product_no),
      product_code: toText(item.product_code),
      product_name: toText(item.product_name),
      price: toNumber(item.price),
      display: toText(item.display),
      selling: toText(item.selling),
    };
  });
}

export function mapProductOptions(payload: unknown): Cafe24ProductOption[] {
  const list = (payload as { options?: unknown[] } | null)?.options;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    return {
      option_name: toText(item.option_name),
      option_value: toText(item.option_value ?? item.option_text),
    };
  });
}

export async function fetchProducts(
  token: Token,
  options: { keyword?: string; limit?: number; offset?: number } = {},
): Promise<Cafe24Product[]> {
  const limit = Math.min(Math.max(options.limit ?? 40, 1), PRODUCT_REQUEST_LIMIT);
  const offset = Math.min(Math.max(options.offset ?? 0, 0), PRODUCT_OFFSET_MAX);
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    fields: PRODUCT_FIELDS,
  });
  if (SHOP_NO !== 1) {
    query.set("shop_no", String(SHOP_NO));
  }
  const keyword = options.keyword?.trim();
  if (keyword) {
    query.set("product_name", keyword);
  }
  const payload = await callAdmin<unknown>(token, `/products?${query}`);
  return mapProducts(payload);
}

export async function fetchProductOptions(
  token: Token,
  productNo: number,
): Promise<Cafe24ProductOption[]> {
  const payload = await callAdmin<unknown>(token, `/products/${productNo}/options`);
  return mapProductOptions(payload);
}
