import type { Metadata } from "next";
import { currentMallId } from "@/features/quotes/server/session";
import { listDrafts } from "@/features/quotes/server/repo";
import { QuoteList } from "@/features/quotes/editor/QuoteList";
import { NotInstalled } from "@/features/quotes/editor/NotInstalled";

export const metadata: Metadata = {
  title: "견적 목록 — Cafe24 견적 내보내기",
};

export default async function QuotesPage() {
  const mallId = await currentMallId();
  if (!mallId) {
    return <NotInstalled what="견적 목록" />;
  }
  const drafts = await listDrafts(mallId);
  return <QuoteList initialDrafts={drafts} mallId={mallId} />;
}
