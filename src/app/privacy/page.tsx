export const metadata = {
  title: "개인정보처리방침 — 카페24 견적 내보내기",
  description: "수집 항목, 이용 목적, 보관·파기를 안내합니다.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-7">
      <h1 className="text-lg font-bold">개인정보처리방침</h1>
      <p className="mt-1 text-xs text-neutral-500">최종 수정 2026-09-16</p>

      <h2 className="mt-6 font-semibold">1. 수집하는 정보</h2>
      <ul className="mt-1 list-disc pl-5">
        <li>
          쇼핑몰 식별자(<code>mall_id</code>)와 카페24 접근·갱신 토큰
        </li>
        <li>
          이용자가 앱에서 입력한 견적 내용: <b>수신 회사명</b>, 유효기한, 납기·배송 조건, 가격 조건,
          비고, 품목(상품명·옵션·수량·단가), 조정 금액, 공급자 표시 정보
        </li>
        <li>
          카페24 상품 API에서 조회한 <b>상품명·품목 코드·판매가·옵션명</b>
        </li>
        <li>앱 동작 기록(문서 확정·복제·내보내기 같은 사건과 시각, 버전·건수·총액)</li>
      </ul>

      <h2 className="mt-6 font-semibold">2. 수집하지 않는 정보</h2>
      <p>
        구매자·회원의 실명, 연락처, 주소, 이메일은 수집하지 않습니다. 고객 식별자(Customer
        Identifier) 권한을 요청하지 않으며, 주문·회원 API를 호출하지 않습니다. 견적 이력에도 수신처
        회사명과 품목 본문을 남기지 않습니다.
      </p>

      <h2 className="mt-6 font-semibold">3. 이용 목적</h2>
      <p>
        이용자 본인의 쇼핑몰 상품을 골라 견적서를 작성하고, 같은 내용을 XLSX 파일과 인쇄용
        PDF(A4)로 내보내는 목적으로만 사용합니다. 다른 목적으로 사용하거나 광고에 쓰지 않습니다.
      </p>

      <h2 className="mt-6 font-semibold">4. 보관 및 파기</h2>
      <ul className="mt-1 list-disc pl-5">
        <li>카페24 토큰은 앱 삭제·만료 웹훅을 받으면 지체 없이 삭제합니다.</li>
        <li>토큰은 수명이 짧은 접근 토큰(2시간)과 갱신 토큰(2주)이며, 만료 전 자동 갱신합니다.</li>
        <li>
          견적 초안과 확정본은 이용자가 삭제하거나 앱 사용을 중단할 때까지 보관합니다. 삭제를
          요청하면 지체 없이 파기합니다.
        </li>
      </ul>

      <h2 className="mt-6 font-semibold">5. 보관 위치와 처리 위탁</h2>
      <p>
        데이터는 앱 운영을 위해 사용하는 클라우드(Vercel)와 관리형 데이터베이스(Neon Postgres)에
        암호화된 연결로 저장됩니다. 그 외 제3자에게 제공하지 않습니다.
      </p>

      <h2 className="mt-6 font-semibold">6. 이용자의 권리</h2>
      <p>
        앱에서 언제든 견적을 삭제할 수 있고, 쇼핑몰 관리자에서 앱을 삭제하면 저장된 토큰이
        제거됩니다. 보관 중인 데이터의 열람·삭제를 요청할 수 있습니다.
      </p>

      <h2 className="mt-6 font-semibold">7. 문의</h2>
      <p>kwan765@naver.com</p>
    </main>
  );
}
