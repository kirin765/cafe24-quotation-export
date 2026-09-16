import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cafe24 견적 내보내기 — 로컬 데모",
  description: "상품 목록을 편집 가능한 XLSX와 인쇄용 PDF로 만드는 로컬 데모입니다.",
};

const STEPS = [
  "합성 상품 10개 또는 CSV를 불러옵니다.",
  "상품명·옵션·수량·협의 단가를 수정합니다.",
  "수신 회사명, 유효기한, 납기·배송 조건, 가격 조건, 비고를 입력합니다.",
  "미리보기 합계를 확인합니다.",
  "같은 데이터로 XLSX를 내려받고, 인쇄 화면에서 PDF로 저장합니다.",
];

const NOT_INCLUDED = [
  "Cafe24 상품·옵션 API 연동, OAuth, 서버 저장",
  "견적 번호 관리, 버전 이력, 이전 견적 복제",
  "자동 부가세 계산, 전자서명, 자동 메일·SMS 발송",
  "버튼 하나로 PDF 파일을 직접 생성하는 기능(브라우저 인쇄 저장만 지원)",
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-xs font-semibold tracking-widest text-neutral-500">CAFE24 B2B</p>
      <h1 className="mt-2 text-2xl font-bold">견적 내보내기 — 로컬 데모</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-700">
        수신처·품목·수량·협의 단가로 견적을 작성하고, 편집 가능한 XLSX와 인쇄용 PDF를 만드는
        데모입니다. 서버·DB·Cafe24 연동 없이 합성 데이터로만 동작하며, 입력한 내용은 이 브라우저를
        벗어나지 않습니다.
      </p>

      <a
        className="mt-6 inline-block rounded bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
        href="/demo"
      >
        데모 시작하기
      </a>

      <section className="mt-10">
        <h2 className="text-sm font-bold">사용 흐름</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-neutral-700">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="mt-8 rounded border border-amber-300 bg-amber-50 p-4">
        <h2 className="text-sm font-bold text-amber-900">이 데모에 없는 것</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
          {NOT_INCLUDED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-amber-900">
          견적은 주문 전 제안입니다. 결제 완료나 주문 생성으로 표시하지 않으며, 법정 문서 적합성을
          보증하지 않습니다.
        </p>
      </section>
    </main>
  );
}
