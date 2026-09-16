import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * 스토어 '앱 스크린샷' 필드용 이미지를 만든다.
 * 합성 데이터만 쓰고 촬영 후 만든 초안을 지운다. 실제 몰 상품·거래처는 들어가지 않는다.
 *
 *   1) 로컬에서 앱 실행 (DATABASE_URL 필요)
 *        export $(grep -E '^DATABASE_URL=' <(vercel env pull /dev/stdout --environment=production))
 *        CAFE24_CLIENT_ID=local CAFE24_CLIENT_SECRET=<secret> CAFE24_REDIRECT_URI=http://localhost:3133/api/auth/callback npm run start -- -p 3133
 *   2) node store-assets/render-screenshots.mjs
 */
const pw = await import("/home/giwan/Projects/reviewboost/node_modules/playwright/index.js");
const chromium = pw.chromium ?? pw.default?.chromium;

const BASE = process.env.BASE_URL ?? "http://localhost:3133";
const SECRET = process.env.CAFE24_CLIENT_SECRET ?? "";
const MALL = "__screenshot_mall__";
const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "store-assets", "screenshots");
fs.mkdirSync(outDir, { recursive: true });

if (!SECRET) {
  console.error("CAFE24_CLIENT_SECRET이 필요합니다(세션 쿠키 생성용).");
  process.exit(1);
}

const body = `${MALL}.${Math.floor(Date.now() / 1000) + 3600}`;
const cookieValue = `${body}.${createHmac("sha256", SECRET).update(body).digest("base64")}`;

const SYNTHETIC_PRODUCTS = [
  { product_no: 101, product_code: "P0000101", product_name: "샘플 타월", price: 5000, display: "T", selling: "T" },
  { product_no: 102, product_code: "P0000102", product_name: "샘플 컵", price: 3000, display: "T", selling: "T" },
  { product_no: 103, product_code: "P0000103", product_name: "샘플 에코백", price: 4200, display: "T", selling: "T" },
  { product_no: 104, product_code: "P0000104", product_name: "샘플 텀블러", price: 8900, display: "T", selling: "T" },
  { product_no: 105, product_code: "P0000105", product_name: "샘플 아로마 캔들", price: 6500, display: "T", selling: "T" },
];
const SYNTHETIC_OPTIONS = [
  { option_name: "색상", option_value: "화이트" },
  { option_name: "색상", option_value: "네이비" },
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1360, height: 900 },
  deviceScaleFactor: 2,
});
await context.addCookies([{ name: "cq_sess", value: cookieValue, domain: new URL(BASE).hostname, path: "/" }]);

const page = await context.newPage();
await page.route("**/api/cafe24/session", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      mallId: "samplemall",
      installed: true,
      storeKind: "postgres",
      scopes: "mall.read_product",
      apiVersion: "2026-09-01",
    }),
  }),
);
await page.route("**/api/cafe24/products/*/options", (route) =>
  route.fulfill({ contentType: "application/json", body: JSON.stringify({ options: SYNTHETIC_OPTIONS }) }),
);
await page.route("**/api/cafe24/products*", (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      mallId: "samplemall",
      products: SYNTHETIC_PRODUCTS,
      nextOffset: null,
      priceNote:
        "표시 단가는 쿠폰·회원가·옵션 추가금 반영 전 판매가입니다. 협의 단가로 쓰기 전에 확인하세요.",
    }),
  }),
);

const api = async (path, init = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      cookie: `cq_sess=${cookieValue}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  return res.json();
};

const created = [];
const shot = async (name, options = {}) => {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, ...options });
  console.log(`${name}  ${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
};

try {
  // 1) 데모 편집 화면 (서버 저장 없음, 합성 10품목)
  await page.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=미리보기 합계");
  await shot("01-demo-editor.png", { fullPage: true });

  // 2) 상품 선택기 (Cafe24 API 응답은 합성으로 대체)
  const sample = await api("/api/quotes", { method: "POST", body: { source: "sample" } });
  created.push(sample.draft.id);
  await page.goto(`${BASE}/quotes/${sample.draft.id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Cafe24 상품 불러오기");
  await page.waitForSelector("text=샘플 타월");
  await page.locator("tbody input[type=checkbox]").first().check();
  await page.getByRole("button", { name: /선택 1개 견적에 추가/ }).click();
  await page.waitForSelector("text=개 행을 추가했습니다");
  await page.locator("section:has-text('Cafe24 상품 불러오기')").first().screenshot({
    path: path.join(outDir, "02-product-picker.png"),
  });
  console.log("02-product-picker.png");

  // 3) 확정 → 확정본 인쇄(A4)
  const current = await api(`/api/quotes/${sample.draft.id}`);
  const confirmed = await api(`/api/quotes/${sample.draft.id}/confirm`, {
    method: "POST",
    body: { revision: current.draft.revision },
  });
  await page.goto(`${BASE}/quotes/versions/${confirmed.versionId}/print`, { waitUntil: "networkidle" });
  await page.waitForSelector("article");
  await page.locator("article").screenshot({ path: path.join(outDir, "03-print-a4.png") });
  console.log("03-print-a4.png");

  // 4) 목록 (초안 하나 더 만들어 두 줄)
  const second = await api("/api/quotes", { method: "POST", body: { source: "sample" } });
  created.push(second.draft.id);
  await page.goto(`${BASE}/quotes`, { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr");
  await shot("04-quotes-list.png");

  // 5) 확정 버전과 이력 (aside)
  await page.goto(`${BASE}/quotes/${sample.draft.id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=확정 버전 (1)");
  await page.locator("aside").screenshot({ path: path.join(outDir, "05-confirmed-versions.png") });
  console.log("05-confirmed-versions.png");

  // 6) 공급자 설정
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=공급자 표시 정보");
  await shot("06-settings.png");
} finally {
  for (const id of created) {
    await fetch(`${BASE}/api/quotes/${id}`, {
      method: "DELETE",
      headers: { cookie: `cq_sess=${cookieValue}` },
    });
  }
  await browser.close();
  console.log(`정리: 만든 초안 ${created.length}건 삭제`);
}
