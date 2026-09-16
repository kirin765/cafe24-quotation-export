import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentMallId } from "@/features/quotes/server/session";
import { getDraft, listAuditEvents, listVersions } from "@/features/quotes/server/repo";
import { SavedQuoteEditor } from "@/features/quotes/editor/SavedQuoteEditor";
import { NotInstalled } from "@/features/quotes/editor/NotInstalled";

export const metadata: Metadata = {
  title: "견적 초안 — Cafe24 견적 내보내기",
};

export default async function QuoteDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const mallId = await currentMallId();
  if (!mallId) {
    return <NotInstalled what="견적 초안" />;
  }
  const { id } = await params;

  const draft = await getDraft(mallId, id);
  if (!draft) {
    notFound();
  }

  const [versions, audit] = await Promise.all([
    listVersions(mallId, id),
    listAuditEvents(mallId, id),
  ]);

  return (
    <SavedQuoteEditor initialAudit={audit} initialDraft={draft} initialVersions={versions} />
  );
}
