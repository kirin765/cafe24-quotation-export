import type { Metadata } from "next";
import { currentMallId } from "@/features/quotes/server/session";
import { getSupplier } from "@/features/quotes/server/repo";
import { SettingsForm } from "@/features/quotes/editor/SettingsForm";
import { NotInstalled } from "@/features/quotes/editor/NotInstalled";

export const metadata: Metadata = {
  title: "공급자 설정 — Cafe24 견적 내보내기",
};

export default async function SettingsPage() {
  const mallId = await currentMallId();
  if (!mallId) {
    return <NotInstalled what="공급자 설정" />;
  }
  const supplier = await getSupplier(mallId);
  return <SettingsForm initialSupplier={supplier} mallId={mallId} />;
}
