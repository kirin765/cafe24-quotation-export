import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * 카페24 스토어 등록 폼의 스크린샷 규격에 맞춘 이미지를 만든다.
 *   PC     : 1920x1080 (1MB 이하, 3장 이상 권장)
 *   Mobile : 360x640  (1MB 이하, 3장 이상 권장)
 * 합성 데이터만 쓰고, 만든 초안은 끝나면 지운다.
 *
 *   1) 로컬에서 앱 실행 (DATABASE_URL 필요)
 *   2) node store-assets/render-registration-images.mjs
 */
const pw = await import("/home/giwan/Projects/reviewboost/node_modules/playwright/index.js");
const chromium = pw.chromium ?? pw.default?.chromium;

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const SECRET = process.env.CAFE24_CLIENT_SECRET ?? "local-test-secret";
const MALL = "__registration_mall__";
const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "store-assets", "registration");
fs.mkdirSync(outDir, { recursive: true });

const body = `${MALL}.${Math.floor(Date.now() / 1000) + 3600}`;
const cookieValue = `${body}.${createHmac("sha256", SECRET).update(body).digest("base64")}`;

const PRODUCTS = [
  { product_no: 101, product_code: "P0000101", product_name: "샘플 타월", price: 5000, display: "T", selling: "T" },
  { product_no: 102, product_code: "P0000102", product_name: "샘플 컵", price: 3000, display: "T", selling: "T" },
  { product_no: 103, product_code: "P0000103", product_name: "샘플 에코백", price: 4200, display: "T", selling: "T" },
  { product_no: 104, product_code: "P0000104", product_name: "샘플 텀블러", price: 8900, display: "T", selling: "T" },
];
const OPTIONS = [
  { option_name: "색상", option_value: "화이트" },
  { option_name: "색상", option_value: "네이비" },
];

const browser = await chromium.launch();
const context = await browser.newContext();
await context.addCookies([{ name: "cq_sess", value: cookieValue, domain: new URL(BASE).hostname, path: "/" }]);

const api = async (p, init = {}) => {
  const res = await fetch(`${BASE}${p}`, {
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
async function withPage(width, height, fn) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
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
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ options: OPTIONS }) }),
  );
  await page.route("**/api/cafe24/products*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ mallId: "samplemall", products: PRODUCTS, nextOffset: null }),
    }),
  );
  await fn(page);
  await page.close();
}

const shoot = async (page, name) => {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file });
  const kb = fs.statSync(file).size / 1024;
  console.log(`${name}  ${kb.toFixed(0)}KB${kb > 1024 ? "  ⚠ 1MB 초과" : ""}`);
};

try {
  const sample = await api("/api/quotes", { method: "POST", body: { source: "sample" } });
  created.push(sample.draft.id);
  const current = await api(`/api/quotes/${sample.draft.id}`);
  await api(`/api/quotes/${sample.draft.id}/confirm`, {
    method: "POST",
    body: { revision: current.draft.revision },
  });
  const versions = await api(`/api/quotes/${sample.draft.id}/versions`);
  const versionId = versions.versions[0].id;

  // PC 1920x1080 — 실제 사용 화면(저장 초안)을 쓴다. 데모는 '연습용' 문구가 있어 소개용에 맞지 않는다.
  await withPage(1920, 1080, async (page) => {
    await page.goto(`${BASE}/quotes/${sample.draft.id}`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Cafe24 상품 불러오기");
    await page.waitForSelector("text=샘플 타월");
    await shoot(page, "pc-01-editor.png");

    await page.locator("tbody input[type=checkbox]").first().check();
    await page.getByRole("button", { name: /선택 1개 견적에 추가/ }).click();
    await page.waitForSelector("text=개 행을 추가했습니다");
    await page.locator("h2:has-text('품목')").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shoot(page, "pc-02-items.png");

    await page.goto(`${BASE}/quotes`, { waitUntil: "networkidle" });
    await page.waitForSelector("table tbody tr");
    await shoot(page, "pc-03-quotes-list.png");

    await page.goto(`${BASE}/quotes/versions/${versionId}/print`, { waitUntil: "networkidle" });
    await page.waitForSelector("article");
    await shoot(page, "pc-04-print-a4.png");

    await page.goto(`${BASE}/quotes/${sample.draft.id}`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=확정 버전 (1)");
    await page.locator("aside").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shoot(page, "pc-05-confirmed-versions.png");
  });

  // Mobile 360x640
  await withPage(360, 640, async (page) => {
    await page.goto(`${BASE}/quotes/${sample.draft.id}`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=미리보기 합계");
    await shoot(page, "mobile-01-editor-top.png");

    await page.locator("h2:has-text('품목')").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shoot(page, "mobile-02-items.png");

    await page.locator("dt:has-text('견적 총액')").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shoot(page, "mobile-03-total.png");

    await page.goto(`${BASE}/quotes`, { waitUntil: "networkidle" });
    await page.waitForSelector("table tbody tr");
    await shoot(page, "mobile-04-quotes-list.png");
  });
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
