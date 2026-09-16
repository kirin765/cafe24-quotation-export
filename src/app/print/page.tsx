import type { Metadata } from "next";
import { PrintPreviewClient } from "@/features/quotes/print/PrintPreviewClient";

export const metadata: Metadata = {
  title: "인쇄 미리보기 — Cafe24 견적 내보내기",
};

export default function PrintPage() {
  return <PrintPreviewClient />;
}
