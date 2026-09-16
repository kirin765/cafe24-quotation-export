import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentMallId } from "@/features/quotes/server/session";
import { getVersion } from "@/features/quotes/server/repo";
import { VersionPrint } from "@/features/quotes/editor/VersionPrint";
import { NotInstalled } from "@/features/quotes/editor/NotInstalled";

export const metadata: Metadata = {
  title: "확정본 인쇄 — Cafe24 견적 내보내기",
};

export default async function QuoteVersionPrintPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const mallId = await currentMallId();
  if (!mallId) {
    return <NotInstalled what="확정본 인쇄" />;
  }
  const { versionId } = await params;

  const version = await getVersion(mallId, versionId);
  if (!version) {
    notFound();
  }

  return (
    <VersionPrint
      confirmedAt={version.summary.confirmedAt}
      doc={version.doc}
      draftId={version.draftId}
    />
  );
}
