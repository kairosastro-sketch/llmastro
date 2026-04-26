"use client";
// natal-new-simplified-v1 — wrapper minimal autour de NatalForm
// Le double titre + double container ont été retirés (NatalForm gère son propre header).

import { useRouter } from "next/navigation";
import { NatalForm } from "@/components/natal/NatalForm";

export default function NatalNewPage() {
  const router = useRouter();
  return (
    <NatalForm
      onCancel={() => router.push("/dashboard/natal")}
      onSaved={(id) => router.push(`/dashboard/natal/${id}`)}
    />
  );
}
