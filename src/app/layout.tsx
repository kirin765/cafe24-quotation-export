import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cafe24 견적 내보내기 데모",
  description:
    "B2B 판매자가 합성 상품·CSV로 견적을 편집하고 XLSX와 인쇄용 PDF를 만드는 로컬 데모입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
