import fs from "node:fs";
import path from "node:path";

/**
 * 스토어 등록용 이미지를 만든다. 앱 서버가 필요 없다.
 *
 *   node store-assets/render-detail-images.mjs
 *
 * 620px 폭을 deviceScaleFactor 2로 렌더해 1240px PNG로 저장한다(카페24 상세 설명 이미지 폭 제한 1240px).
 * (순수익 앱 심사에서 텍스트 위주 상세 설명이 반려돼 이 방식으로 통과했다.)
 */
const pw = await import("/home/giwan/Projects/reviewboost/node_modules/playwright/index.js");
const chromium = pw.chromium ?? pw.default?.chromium;

const root = path.resolve(import.meta.dirname, "..");
const storeDir = path.join(root, "store-assets");
const publicDir = path.join(root, "public", "store");
fs.mkdirSync(publicDir, { recursive: true });

const FONT = '"Noto Sans CJK KR","Noto Sans KR","Noto Sans CJK JP",system-ui,sans-serif';

const base = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${FONT}; color: #111827; background: #ffffff; }
  .wrap { width: 620px; padding: 44px 40px; }
  .eyebrow { font-size: 15px; font-weight: 700; letter-spacing: .18em; color: #2563eb; }
  h1 { font-size: 44px; line-height: 1.24; letter-spacing: -.02em; margin-top: 14px; }
  h2 { font-size: 34px; line-height: 1.3; letter-spacing: -.02em; }
  p { font-size: 18px; line-height: 1.7; color: #4b5563; }
  .muted { color: #6b7280; font-size: 16px; }
  .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; background: #fff; }
  .card-dark { border-radius: 16px; padding: 24px; background: #111827; color: #f9fafb; }
  .row { display: flex; gap: 16px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .pill { display: inline-block; font-size: 14px; font-weight: 700; padding: 6px 12px; border-radius: 999px; }
  .step { font-size: 13px; font-weight: 800; color: #2563eb; }
  .label { font-size: 14px; font-weight: 700; color: #374151; }
  .value { font-size: 20px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 15px; }
  th, td { border-bottom: 1px solid #e5e7eb; padding: 9px 8px; text-align: left; }
  th { color: #6b7280; font-weight: 700; font-size: 13px; }
  .right { text-align: right; }
  .accent { color: #2563eb; }
  .danger { color: #b91c1c; }
`;

const images = {
  "detail-01": `
    <div class="wrap">
      <div class="eyebrow">카페24 견적 내보내기</div>
      <h1>상품을 고르고<br>협의 단가만 확인하세요.<br><span class="accent">견적서 파일</span>은 바로 나옵니다.</h1>
      <p style="margin-top:22px">카페24에 등록된 상품·옵션을 검색해 품목으로 가져오고,
      수량과 단가만 확인하면 편집 가능한 XLSX와 A4 인쇄용 PDF가 같은 내용으로 만들어집니다.</p>
      <div class="grid3" style="margin-top:36px">
        <div class="card"><div class="step">STEP 1</div><div class="value" style="margin-top:8px">상품 불러오기</div><p class="muted" style="margin-top:6px">상품명으로 검색, 옵션은 옵션별 행으로</p></div>
        <div class="card"><div class="step">STEP 2</div><div class="value" style="margin-top:8px">단가·수량 확인</div><p class="muted" style="margin-top:6px">판매가는 제안값, 운영자가 확정</p></div>
        <div class="card"><div class="step">STEP 3</div><div class="value" style="margin-top:8px">XLSX · PDF</div><p class="muted" style="margin-top:6px">품목·수량·단가·합계가 동일</p></div>
      </div>
      <div class="card-dark" style="margin-top:28px; display:flex; justify-content:space-between; align-items:center">
        <div><div style="font-size:14px; color:#9ca3af">견적 총액</div><div style="font-size:30px; font-weight:800">888,700원</div></div>
        <div style="text-align:right"><div style="font-size:14px; color:#9ca3af">품목 10행 · 부가세 별도</div><div style="font-size:16px; font-weight:700">확정 버전 v1</div></div>
      </div>
    </div>`,
  "detail-02": `
    <div class="wrap">
      <div class="eyebrow">이런 일, 반복하고 계셨나요</div>
      <h2 style="margin-top:14px">견적서 한 장에<br>상품 정보를 또 입력하는 시간</h2>
      <div class="grid2" style="margin-top:32px">
        <div class="card">
          <div class="pill" style="background:#fee2e2; color:#b91c1c">이전</div>
          <div style="margin-top:14px; font-size:18px; font-weight:700">상품명·옵션·단가를 손으로 다시 입력</div>
          <ul style="margin-top:12px; padding-left:20px; color:#4b5563; font-size:16px; line-height:1.8">
            <li>몰 관리자와 견적서를 오가며 값 대조</li>
            <li>품목 코드 앞자리 0이 사라짐</li>
            <li>수량·단가를 고치면 합계를 다시 계산</li>
            <li>내용이 바뀔 때마다 파일을 다시 만듦</li>
          </ul>
        </div>
        <div class="card" style="border-color:#bfdbfe; background:#f8fbff">
          <div class="pill" style="background:#dbeafe; color:#1d4ed8">이후</div>
          <div style="margin-top:14px; font-size:18px; font-weight:700">불러와서 확인하고 내보내기만</div>
          <ul style="margin-top:12px; padding-left:20px; color:#4b5563; font-size:16px; line-height:1.8">
            <li>상품 검색으로 품목 추가</li>
            <li>CSV 파일·붙여넣기도 그대로</li>
            <li>합계는 화면·XLSX·PDF가 같은 값</li>
            <li>확정하면 그 시점 내용이 버전으로 남음</li>
          </ul>
        </div>
      </div>
      <p class="muted" style="margin-top:28px">※ 편집은 하되, 확정한 견적은 나중에 상품 가격이 바뀌어도 값이 변하지 않습니다.</p>
    </div>`,
  "detail-03": `
    <div class="wrap">
      <div class="eyebrow">사용 흐름</div>
      <h2 style="margin-top:14px">네 단계면 거래처에 보낼 수 있습니다</h2>
      <div class="grid2" style="margin-top:28px">
        <div class="card"><div class="step">1</div><div class="value" style="margin-top:8px">앱 실행</div><p class="muted" style="margin-top:6px">카페24 관리자 > 앱에서 실행하면 몰 인증 후 견적 목록이 열립니다.</p></div>
        <div class="card"><div class="step">2</div><div class="value" style="margin-top:8px">품목 담기</div><p class="muted" style="margin-top:6px">상품을 검색해 추가하거나 CSV를 붙여넣습니다. 옵션이 있으면 옵션별 행이 생깁니다.</p></div>
        <div class="card"><div class="step">3</div><div class="value" style="margin-top:8px">단가·조건 확인</div><p class="muted" style="margin-top:6px">협의 단가, 배송비·할인, 유효기한, 납기 조건을 적습니다. 총액이 바로 보입니다.</p></div>
        <div class="card"><div class="step">4</div><div class="value" style="margin-top:8px">내보내기</div><p class="muted" style="margin-top:6px">XLSX를 내려받고, 인쇄 화면에서 ‘PDF로 저장’을 누릅니다.</p></div>
      </div>
      <div class="card" style="margin-top:24px">
        <div class="label">가져온 값은 그대로 두고, 확인한 단가만 고치면 됩니다</div>
        <table style="margin-top:10px">
          <thead><tr><th>상품명</th><th>옵션</th><th class="right">수량</th><th class="right">단가</th><th class="right">금액</th></tr></thead>
          <tbody>
            <tr><td>샘플 타월</td><td>화이트</td><td class="right">10</td><td class="right">5,000</td><td class="right">50,000</td></tr>
            <tr><td>샘플 컵</td><td>300ml</td><td class="right">20</td><td class="right">3,000</td><td class="right">60,000</td></tr>
          </tbody>
        </table>
      </div>
    </div>`,
  "detail-04": `
    <div class="wrap">
      <div class="eyebrow">확정 버전</div>
      <h2 style="margin-top:14px">확정한 견적은<br>나중에 바뀌지 않습니다</h2>
      <p style="margin-top:18px">보낸 견적서와 앱 안의 내용이 달라지면 곤란합니다.
      확정하면 그 시점의 공급자 정보·품목명·단가·합계를 <b>snapshot</b>으로 저장하고,
      이후 수정은 새 버전으로만 쌓입니다.</p>
      <div class="grid3" style="margin-top:30px">
        <div class="card"><div class="label">v1</div><div class="value" style="margin-top:6px">885,700원</div><p class="muted" style="margin-top:6px">확정 09-16 16:20</p></div>
        <div class="card"><div class="label">v2</div><div class="value" style="margin-top:6px">900,000원</div><p class="muted" style="margin-top:6px">수량 변경 후 다시 확정</p></div>
        <div class="card" style="border-color:#fca5a5"><div class="label">확정본</div><div class="value" style="margin-top:6px">수정 불가</div><p class="muted" style="margin-top:6px">인쇄·XLSX도 확정값</p></div>
      </div>
      <div class="card" style="margin-top:26px">
        <div class="label">다른 탭에서 먼저 저장했다면</div>
        <p class="muted" style="margin-top:6px">낡은 내용으로 덮어쓰지 않고 충돌을 알려 드립니다. 최신 내용을 불러와 비교한 뒤 저장하세요.</p>
      </div>
      <p class="muted" style="margin-top:24px">이전 견적을 복제해 새 견적을 만들 수도 있습니다. 이력에는 본문·수신처를 남기지 않습니다.</p>
    </div>`,
  "detail-05": `
    <div class="wrap">
      <div class="eyebrow">안전하게 쓰는 방법</div>
      <h2 style="margin-top:14px">필요한 정보만<br>필요한 만큼만 다룹니다</h2>
      <div class="grid2" style="margin-top:30px">
        <div class="card">
          <div class="value">고객 개인정보 미수집</div>
          <p class="muted" style="margin-top:8px">구매자 이름·연락처·주소를 조회하지 않습니다. 고객 식별자 권한도 요청하지 않습니다.</p>
        </div>
        <div class="card">
          <div class="value">필요한 권한 한 개</div>
          <p class="muted" style="margin-top:8px">상품 조회(<b>mall.read_product</b>)만 요청합니다. 상품을 만들거나 주문을 바꾸지 않습니다.</p>
        </div>
        <div class="card">
          <div class="value">수식 주입 방지</div>
          <p class="muted" style="margin-top:8px">XLSX의 텍스트는 문자열로만 기록해 <code>=</code>·<code>+</code>로 시작하는 상품명이 수식이 되지 않습니다.</p>
        </div>
        <div class="card">
          <div class="value">앱 삭제 시 토큰 파기</div>
          <p class="muted" style="margin-top:8px">삭제·만료 웹훅을 받으면 접근 토큰을 바로 지웁니다.</p>
        </div>
      </div>
      <div class="card-dark" style="margin-top:26px">
        <div style="font-size:20px; font-weight:800">견적은 주문 전 제안입니다</div>
        <p style="color:#d1d5db; margin-top:8px; font-size:16px">결제 완료·주문 생성으로 표시하지 않고, 세금계산서를 대신하지 않습니다.
        부가세는 자동 계산하지 않으며 ‘가격 조건’에 세금 포함 여부를 적어 둡니다.</p>
      </div>
      <p class="muted" style="margin-top:22px">문의 kwan765@naver.com · 개인정보처리방침 /privacy</p>
    </div>`,
};

const browser = await chromium.launch();

for (const [name, markup] of Object.entries(images)) {
  const page = await browser.newPage({ viewport: { width: 620, height: 520 }, deviceScaleFactor: 2 });
  await page.setContent(`<style>${base}</style>${markup}`, { waitUntil: "load" });
  const file = path.join(publicDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const { width, height } = await page.evaluate(() => ({
    width: document.body.scrollWidth,
    height: document.body.scrollHeight,
  }));
  console.log(`${name}.png  ${width * 2}x${height * 2}  ${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
  await page.close();
}
await browser.close();

// 아이콘과 배너
const icon = () => `
  <div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:18%;background:#111827;color:#fff;font-family:${FONT}">
    <div style="font-size:15%;font-weight:800;letter-spacing:.2em;color:#93c5fd">QUOTE</div>
    <div style="font-size:34%;font-weight:800;line-height:1.05">견적<br>내보내기</div>
  </div>`;

const banner = `
  <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 48px;background:#111827;color:#fff;font-family:${FONT}">
    <div>
      <div style="font-size:14px;font-weight:800;letter-spacing:.2em;color:#93c5fd">CAFE24 B2B</div>
      <div style="font-size:40px;font-weight:800;margin-top:10px;line-height:1.2">견적 내보내기</div>
      <div style="font-size:17px;color:#d1d5db;margin-top:10px">상품을 고르고 단가만 확인하면 XLSX · PDF 견적서가 바로</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:13px;color:#9ca3af">견적 총액</div>
      <div style="font-size:32px;font-weight:800">888,700원</div>
      <div style="font-size:13px;color:#9ca3af;margin-top:6px">v1 확정</div>
    </div>
  </div>`;

const browser2 = await chromium.launch();
for (const [file, size] of [
  ["icon-512.png", 512],
  ["icon-256.png", 256],
  ["icon-100.png", 100],
]) {
  const page = await browser2.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<style>*{margin:0;padding:0}body{width:${size}px;height:${size}px}</style>${icon()}`);
  await page.screenshot({ path: path.join(storeDir, file) });
  console.log(`${file}  ${size}x${size}`);
  await page.close();
}
{
  for (const [file, scale] of [
    ["banner-740x416.png", 1],
    ["banner-740x416@2x.png", 2],
  ]) {
    const page = await browser2.newPage({
      viewport: { width: 740, height: 416 },
      deviceScaleFactor: scale,
    });
    await page.setContent(`<style>*{margin:0;padding:0}body{width:740px;height:416px}</style>${banner}`);
    await page.screenshot({ path: path.join(storeDir, file) });
    console.log(`${file}  ${740 * scale}x${416 * scale}`);
    await page.close();
  }
}
await browser2.close();
