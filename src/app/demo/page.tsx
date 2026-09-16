import type { Metadata } from "next";
import { QuoteDemoClient } from "@/features/quotes/demo/QuoteDemoClient";

export const metadata: Metadata = {
  title: "견적서 데모 — Cafe24 견적 내보내기",
};

export default function DemoPage() {
  return <QuoteDemoClient />;
}
