// ============================================================
// apps/web/src/app/ciel/page.tsx
// CIEL-PUBLIC-V1-PAGES
// ------------------------------------------------------------
// /ciel sans cadence → redirige vers /ciel/aujourd-hui
// ============================================================

import { redirect } from "next/navigation";

export default function CielIndex() {
  redirect("/ciel/aujourd-hui");
}

// CIEL-PUBLIC-V1-PAGES index applied
